
from sqlalchemy.orm import Session
from datetime import datetime, date, timedelta

from app.database.models import (
    Product,
    Sale,
    SaleItem,
    Expense,
    ProfitAdjustment,
)


def record_confirmed_sale(
    db: Session,
    vendor_id: int,
    items_data: list,
    language: str = "hi-IN"
):
    if not items_data:
        raise ValueError("No sale items provided.")

    try:
        total_sale_amount = 0.0
        products_by_id = {}

        # Validate products and calculate the sale amount.
        # There is deliberately NO stock availability check.
        for item in items_data:
            quantity = float(item["quantity"])
            unit_price = float(item["unit_price"])
            product_id = item["product_id"]

            if quantity <= 0:
                raise ValueError("Quantity must be greater than zero.")

            if unit_price <= 0:
                raise ValueError("Unit price must be greater than zero.")

            product = db.query(Product).filter(
                Product.id == product_id,
                Product.vendor_id == vendor_id
            ).first()

            if not product:
                raise ValueError(
                    f"Product ID {product_id} not found."
                )

            products_by_id[product_id] = product
            total_sale_amount += quantity * unit_price

        # Create the sale.
        new_sale = Sale(
            vendor_id=vendor_id,
            total_amount=round(total_sale_amount, 2),
            language=language
        )

        db.add(new_sale)
        db.flush()

        # Save individual sale items.
        # Inventory quantity is NOT changed.
        for item in items_data:
            product = products_by_id[item["product_id"]]
            quantity = float(item["quantity"])
            unit_price = float(item["unit_price"])

            sale_item = SaleItem(
                sale_id=new_sale.id,
                product_id=product.id,
                quantity=quantity,
                unit_price=unit_price,
                total_amount=round(quantity * unit_price, 2)
            )

            db.add(sale_item)

        db.commit()
        db.refresh(new_sale)

        return new_sale

    except Exception:
        db.rollback()
        raise


def get_period_stats(db: Session, vendor_id: int, start, end):
    sales = db.query(Sale).filter(
        Sale.vendor_id == vendor_id,
        Sale.created_at >= start,
        Sale.created_at < end
    ).all()

    expenses = db.query(Expense).filter(
        Expense.vendor_id == vendor_id,
        Expense.created_at >= start,
        Expense.created_at < end
    ).all()

    revenue = sum(s.total_amount for s in sales)
    total_expenses = sum(e.amount for e in expenses)

    calculated_profit = revenue - total_expenses

    return {
        "revenue": round(revenue, 2),
        "expenses": round(total_expenses, 2),
        "calculated_profit": round(calculated_profit, 2),
        "transactions": len(sales),
        "expense_count": len(expenses)
    }


def get_profit_adjustment(
    db: Session,
    vendor_id: int,
    period_type: str,
    period_start: str
):
    return db.query(ProfitAdjustment).filter(
        ProfitAdjustment.vendor_id == vendor_id,
        ProfitAdjustment.period_type == period_type,
        ProfitAdjustment.period_start == period_start
    ).first()


def save_profit_adjustment(
    db: Session,
    vendor_id: int,
    period_type: str,
    period_start: str,
    adjusted_profit: float,
    note: str = None
):
    if period_type not in ("daily", "monthly"):
        raise ValueError("Period type must be daily or monthly.")

    try:
        if period_type == "daily":
            date.fromisoformat(period_start)
        else:
            datetime.strptime(period_start, "%Y-%m")

        adjustment = get_profit_adjustment(
            db,
            vendor_id,
            period_type,
            period_start
        )

        if adjustment:
            adjustment.adjusted_profit = adjusted_profit
            adjustment.note = note
            adjustment.updated_at = datetime.utcnow()
        else:
            adjustment = ProfitAdjustment(
                vendor_id=vendor_id,
                period_type=period_type,
                period_start=period_start,
                adjusted_profit=adjusted_profit,
                note=note
            )
            db.add(adjustment)

        db.commit()
        db.refresh(adjustment)

        return adjustment

    except Exception:
        db.rollback()
        raise


def get_today_dashboard_stats(db: Session, vendor_id: int = 1):
    today = date.today()

    today_start = datetime.combine(today, datetime.min.time())
    tomorrow_start = datetime.combine(
        today + timedelta(days=1),
        datetime.min.time()
    )

    stats = get_period_stats(
        db, vendor_id, today_start, tomorrow_start
    )

    adjustment = get_profit_adjustment(
        db, vendor_id, "daily", today.isoformat()
    )

    products = db.query(Product).filter(
        Product.vendor_id == vendor_id
    ).all()

    return {
        "today_revenue": stats["revenue"],
        "today_expenses": stats["expenses"],
        "estimated_profit": stats["calculated_profit"],
        "manual_profit_adjustment": (
            round(adjustment.adjusted_profit, 2)
            if adjustment else None
        ),
        "adjusted_profit": (
            round(adjustment.adjusted_profit, 2)
            if adjustment else stats["calculated_profit"]
        ),
        "total_transactions": stats["transactions"],
        "total_products": len(products),
        "low_stock_count": sum(
            1 for p in products
            if p.quantity <= p.low_stock_threshold
        )
    }


def get_month_dashboard_stats(db: Session, vendor_id: int = 1):
    today = date.today()

    month_start_date = today.replace(day=1)

    if today.month == 12:
        next_month_date = date(today.year + 1, 1, 1)
    else:
        next_month_date = date(today.year, today.month + 1, 1)

    month_start = datetime.combine(
        month_start_date,
        datetime.min.time()
    )

    next_month_start = datetime.combine(
        next_month_date,
        datetime.min.time()
    )

    stats = get_period_stats(
        db, vendor_id, month_start, next_month_start
    )

    period_start = today.strftime("%Y-%m")

    adjustment = get_profit_adjustment(
        db, vendor_id, "monthly", period_start
    )

    return {
        "month": period_start,
        "monthly_revenue": stats["revenue"],
        "monthly_expenses": stats["expenses"],
        "estimated_profit": stats["calculated_profit"],
        "manual_profit_adjustment": (
            round(adjustment.adjusted_profit, 2)
            if adjustment else None
        ),
        "adjusted_profit": (
            round(adjustment.adjusted_profit, 2)
            if adjustment else stats["calculated_profit"]
        ),
        "total_transactions": stats["transactions"],
        "expense_count": stats["expense_count"]
    }
