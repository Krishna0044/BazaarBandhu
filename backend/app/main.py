from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database.models import init_db, SessionLocal, Product, Vendor
from app.routes import voice, sales, products, expenses, dashboard

app = FastAPI(title="BazaarBandhu Backend API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(voice.router)
app.include_router(sales.router)
app.include_router(products.router)
app.include_router(expenses.router)
app.include_router(dashboard.router)

@app.on_event("startup")
def startup_event():
    init_db()
    db = SessionLocal()
    if not db.query(Vendor).first():
        vendor = Vendor(shop_name="Rahul Vegetable Store", vendor_name="Rahul Kumar", preferred_language="hi-IN")
        db.add(vendor)
        db.commit()

        initial_products = [
            Product(vendor_id=1, product_name="Tomato", quantity=20.0, unit="kg", selling_price=30.0, purchase_cost=20.0),
            Product(vendor_id=1, product_name="Potato", quantity=50.0, unit="kg", selling_price=25.0, purchase_cost=15.0),
            Product(vendor_id=1, product_name="Onion", quantity=30.0, unit="kg", selling_price=40.0, purchase_cost=30.0)
        ]
        db.add_all(initial_products)
        db.commit()
    db.close()

@app.get("/health")
def health_check():
    return {"status": "ok", "app": "BazaarBandhu Backend"}