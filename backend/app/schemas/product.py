from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class ProductBase(BaseModel):
    product_name: str
    quantity: float
    unit: str = "kg"
    selling_price: float
    purchase_cost: Optional[float] = 0.0
    low_stock_threshold: Optional[float] = 5.0

class ProductCreate(ProductBase):
    vendor_id: int = 1

class ProductUpdate(BaseModel):
    product_name: Optional[str] = None
    quantity: Optional[float] = None
    unit: Optional[str] = None
    selling_price: Optional[float] = None
    purchase_cost: Optional[float] = None
    low_stock_threshold: Optional[float] = None

class ProductResponse(ProductBase):
    id: int
    vendor_id: int
    created_at: datetime

    class Config:
        from_attributes = True