from pydantic import BaseModel
from typing import List, Optional

class SaleItemCreate(BaseModel):
    product_id: int
    quantity: float
    unit_price: float

class SaleCreate(BaseModel):
    vendor_id: int = 1
    language: str = "hi-IN"
    items: List[SaleItemCreate]

class ParsedSaleIntent(BaseModel):
    product_name: Optional[str] = None
    matched_product_id: Optional[int] = None
    quantity: Optional[float] = None
    unit: Optional[str] = "kg"
    unit_price: Optional[float] = None
    total_amount: Optional[float] = None
    requires_confirmation: bool = True
    stock_available: Optional[float] = None
    error_message: Optional[str] = None