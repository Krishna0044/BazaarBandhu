
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from app.database.connection import get_db
from app.services.business_logic import (
    get_today_dashboard_stats,
    get_month_dashboard_stats,
    get_profit_adjustment,
    save_profit_adjustment,
)

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


class ProfitAdjustmentRequest(BaseModel):
    vendor_id: int = 1
    period_type: str
    period_start: str
    adjusted_profit: float
    note: Optional[str] = None


@router.get("/today")
def get_dashboard(db: Session = Depends(get_db)):
    stats = get_today_dashboard_stats(db, vendor_id=1)
    return {"success": True, "data": stats}


@router.get("/month")
def get_month_dashboard(db: Session = Depends(get_db)):
    stats = get_month_dashboard_stats(db, vendor_id=1)
    return {"success": True, "data": stats}


@router.get("/profit-adjustment")
def get_adjustment(
    period_type: str,
    period_start: str,
    db: Session = Depends(get_db)
):
    if period_type not in ("daily", "monthly"):
        raise HTTPException(
            status_code=400,
            detail="period_type must be daily or monthly"
        )

    adjustment = get_profit_adjustment(
        db, 1, period_type, period_start
    )

    if not adjustment:
        return {"success": True, "data": None}

    return {
        "success": True,
        "data": {
            "id": adjustment.id,
            "period_type": adjustment.period_type,
            "period_start": adjustment.period_start,
            "adjusted_profit": adjustment.adjusted_profit,
            "note": adjustment.note
        }
    }


@router.put("/profit-adjustment")
def update_adjustment(
    data: ProfitAdjustmentRequest,
    db: Session = Depends(get_db)
):
    try:
        adjustment = save_profit_adjustment(
            db=db,
            vendor_id=data.vendor_id,
            period_type=data.period_type,
            period_start=data.period_start,
            adjusted_profit=data.adjusted_profit,
            note=data.note
        )

        return {
            "success": True,
            "message": "Profit adjustment saved successfully",
            "data": {
                "id": adjustment.id,
                "period_type": adjustment.period_type,
                "period_start": adjustment.period_start,
                "adjusted_profit": adjustment.adjusted_profit,
                "note": adjustment.note
            }
        }

    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))

    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error))
