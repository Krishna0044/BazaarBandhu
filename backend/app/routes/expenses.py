from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.database.models import Expense
from app.schemas.expense import ExpenseCreate, ExpenseResponse
from typing import List

router = APIRouter(prefix="/api/expenses", tags=["Expenses"])

@router.get("", response_model=List[ExpenseResponse])
def get_expenses(db: Session = Depends(get_db)):
    return db.query(Expense).order_by(Expense.created_at.desc()).all()

@router.post("", response_model=ExpenseResponse)
def create_expense(expense: ExpenseCreate, db: Session = Depends(get_db)):
    db_expense = Expense(**expense.model_dump())
    db.add(db_expense)
    db.commit()
    db.refresh(db_expense)
    return db_expense