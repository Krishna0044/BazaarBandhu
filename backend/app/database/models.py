
from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    DateTime,
    ForeignKey,
    create_engine,
    UniqueConstraint
)
from sqlalchemy.orm import declarative_base, relationship, sessionmaker
from datetime import datetime
from app.config import settings


Base = declarative_base()

engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)


class Vendor(Base):
    __tablename__ = "vendors"

    id = Column(Integer, primary_key=True, index=True)
    shop_name = Column(String, nullable=False)
    vendor_name = Column(String, nullable=True)
    preferred_language = Column(String, default="hi-IN")
    created_at = Column(DateTime, default=datetime.utcnow)

    products = relationship("Product", back_populates="vendor")
    sales = relationship("Sale", back_populates="vendor")
    expenses = relationship("Expense", back_populates="vendor")

    profit_adjustments = relationship(
        "ProfitAdjustment",
        back_populates="vendor"
    )


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=False)
    product_name = Column(String, nullable=False, index=True)
    quantity = Column(Float, nullable=False, default=0.0)
    unit = Column(String, nullable=False, default="kg")
    selling_price = Column(Float, nullable=False)
    purchase_cost = Column(Float, nullable=True, default=0.0)
    low_stock_threshold = Column(Float, default=5.0)
    created_at = Column(DateTime, default=datetime.utcnow)

    vendor = relationship("Vendor", back_populates="products")
    sale_items = relationship("SaleItem", back_populates="product")


class Sale(Base):
    __tablename__ = "sales"

    id = Column(Integer, primary_key=True, index=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=False)
    total_amount = Column(Float, nullable=False)
    language = Column(String, default="hi-IN")
    created_at = Column(DateTime, default=datetime.utcnow)

    vendor = relationship("Vendor", back_populates="sales")

    items = relationship(
        "SaleItem",
        back_populates="sale",
        cascade="all, delete-orphan"
    )


class SaleItem(Base):
    __tablename__ = "sale_items"

    id = Column(Integer, primary_key=True, index=True)
    sale_id = Column(Integer, ForeignKey("sales.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Float, nullable=False)
    unit_price = Column(Float, nullable=False)
    total_amount = Column(Float, nullable=False)

    sale = relationship("Sale", back_populates="items")
    product = relationship("Product", back_populates="sale_items")


class Expense(Base):
    __tablename__ = "expenses"

    id = Column(Integer, primary_key=True, index=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=False)
    category = Column(String, nullable=False)
    description = Column(String, nullable=True)
    amount = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    vendor = relationship("Vendor", back_populates="expenses")


class ProfitAdjustment(Base):
    __tablename__ = "profit_adjustments"

    id = Column(Integer, primary_key=True, index=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=False)

    period_type = Column(String, nullable=False)
    period_start = Column(String, nullable=False)

    adjusted_profit = Column(Float, nullable=False)
    note = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )

    vendor = relationship(
        "Vendor",
        back_populates="profit_adjustments"
    )

    __table_args__ = (
        UniqueConstraint(
            "vendor_id",
            "period_type",
            "period_start",
            name="uq_vendor_profit_period"
        ),
    )


def init_db():
    Base.metadata.create_all(bind=engine)
