import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.services.calculation import run_calculation
import app.models as m
from app.api_schemas import CalculationOut

router = APIRouter(prefix="/cases/{case_id}/calculations", tags=["calculations"])


@router.post("/run", response_model=CalculationOut)
def run(case_id: uuid.UUID, db: Session = Depends(get_db), user: m.User = Depends(get_current_user)):
    case = db.get(m.Case, case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="תיק לא נמצא")
    try:
        return run_calculation(db, case, user.id)
    except ValueError as ex:
        raise HTTPException(status_code=400, detail=str(ex))


@router.get("/current", response_model=CalculationOut)
def current(case_id: uuid.UUID, db: Session = Depends(get_db), user: m.User = Depends(get_current_user)):
    calc = db.scalar(
        select(m.CalculationResult).where(
            m.CalculationResult.case_id == case_id, m.CalculationResult.is_current == True  # noqa: E712
        )
    )
    if calc is None:
        raise HTTPException(status_code=404, detail="טרם בוצע חישוב")
    return calc


@router.get("", response_model=list[CalculationOut])
def history(case_id: uuid.UUID, db: Session = Depends(get_db), user: m.User = Depends(get_current_user)):
    return db.scalars(
        select(m.CalculationResult).where(m.CalculationResult.case_id == case_id)
        .order_by(m.CalculationResult.version.desc())
    ).all()
