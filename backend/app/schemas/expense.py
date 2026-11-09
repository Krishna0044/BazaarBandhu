from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class ExpenseCreate(BaseModel):
    vendor_id: int = 1
    category: str
    description: Optional[str] = ""
    amount: float

class ExpenseResponse(BaseModel):
    id: int
    vendor_id: int
    category: str
    description: Optional[str]
    amount: float
    created_at: datetime

    class Config:
        from_attributes = True