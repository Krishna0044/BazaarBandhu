
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.database.connection import get_db
from app.services.sales_parser import parse_sales_intent
from app.services.business_logic import record_confirmed_sale
from app.database.models import Sale, SaleItem, Product

router = APIRouter(prefix="/api/sales", tags=["Sales"])


def serialize_sale(sale):
    return {
        "id": sale.id,
        "vendor_id": sale.vendor_id,
        "total_amount": sale.total_amount,
        "language": sale.language,
        "created_at": sale.created_at.isoformat() if sale.created_at else None,
        "items": [
            {
                "id": item.id,
                "product_id": item.product_id,
                "product_name": (
                    item.product.product_name if item.product else "Unknown"
                ),
                "quantity": item.quantity,
                "unit_price": item.unit_price,
                "total_amount": item.total_amount
            }
            for item in sale.items
        ]
    }


@router.post("/parse")
def parse_voice_sale(data: dict, db: Session = Depends(get_db)):
    transcript = data.get("transcript", "")

    if not transcript:
        raise HTTPException(
            status_code=400,
            detail="Transcript is required"
        )

    parsed = parse_sales_intent(transcript, db, vendor_id=1)

    return {"success": True, "data": parsed}


@router.post("")
def create_sale(data: dict, db: Session = Depends(get_db)):
    try:
        sale = record_confirmed_sale(
            db=db,
            vendor_id=data.get("vendor_id", 1),
            items_data=data.get("items", []),
            language=data.get("language", "hi-IN")
        )

        return {
            "success": True,
            "sale_id": sale.id,
            "message": "Sale recorded successfully"
        }

    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))

    except Exception as error:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(error))


# GET SALES HISTORY
@router.get("")
def get_sales(
    vendor_id: int = 1,
    db: Session = Depends(get_db)
):
    sales = (
        db.query(Sale)
        .options(
            joinedload(Sale.items).joinedload(SaleItem.product)
        )
        .filter(Sale.vendor_id == vendor_id)
        .order_by(Sale.created_at.desc())
        .all()
    )

    return {
        "success": True,
        "data": [serialize_sale(sale) for sale in sales]
    }


# EDIT AN EXISTING SALE
@router.put("/{sale_id}")
def update_sale(
    sale_id: int,
    data: dict,
    db: Session = Depends(get_db)
):
    vendor_id = data.get("vendor_id", 1)

    sale = (
        db.query(Sale)
        .options(joinedload(Sale.items))
        .filter(
            Sale.id == sale_id,
            Sale.vendor_id == vendor_id
        )
        .first()
    )

    if not sale:
        raise HTTPException(
            status_code=404,
            detail="Sale not found"
        )

    items_data = data.get("items")

    if not isinstance(items_data, list) or not items_data:
        raise HTTPException(
            status_code=400,
            detail="At least one sale item is required"
        )

    try:
        new_items = []
        total_amount = 0.0

        for item_data in items_data:
            product_id = item_data.get("product_id")
            quantity = float(item_data.get("quantity", 0))
            unit_price = float(item_data.get("unit_price", 0))

            if quantity <= 0 or unit_price < 0:
                raise ValueError(
                    "Quantity must be positive and price cannot be negative"
                )

            product = (
                db.query(Product)
                .filter(
                    Product.id == product_id,
                    Product.vendor_id == vendor_id
                )
                .first()
            )

            if not product:
                raise ValueError(
                    f"Product {product_id} not found for this vendor"
                )

            item_total = round(quantity * unit_price, 2)
            total_amount += item_total

            new_items.append(
                SaleItem(
                    product_id=product.id,
                    quantity=quantity,
                    unit_price=unit_price,
                    total_amount=item_total
                )
            )

        # Replace old sale items; do not change product stock.
        sale.items.clear()

        for item in new_items:
            sale.items.append(item)

        sale.total_amount = round(total_amount, 2)

        if "language" in data:
            sale.language = data["language"]

        db.commit()
        db.refresh(sale)

        return {
            "success": True,
            "message": "Sale updated successfully",
            "data": serialize_sale(sale)
        }

    except ValueError as error:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(error))

    except Exception as error:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(error))


# DELETE AN EXISTING SALE
@router.delete("/{sale_id}")
def delete_sale(
    sale_id: int,
    vendor_id: int = 1,
    db: Session = Depends(get_db)
):
    sale = (
        db.query(Sale)
        .filter(
            Sale.id == sale_id,
            Sale.vendor_id == vendor_id
        )
        .first()
    )

    if not sale:
        raise HTTPException(
            status_code=404,
            detail="Sale not found"
        )

    try:
        db.delete(sale)
        db.commit()

        return {
            "success": True,
            "message": "Sale and its items deleted successfully"
        }

    except Exception as error:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(error))
