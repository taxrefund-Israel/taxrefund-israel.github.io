import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
import app.models as m
from app.api_schemas import AdvancePaymentIn, AdvancePaymentOut

router = APIRouter(prefix="/cases/{case_id}/advances", tags=["advances"])


@router.get("", response_model=list[AdvancePaymentOut])
def list_advances(case_id: uuid.UUID, db: Session = Depends(get_db),
                  user: m.User = Depends(get_current_user)):
    return db.scalars(select(m.AdvancePayment).where(m.AdvancePayment.case_id == case_id)).all()


@router.post("", response_model=AdvancePaymentOut, status_code=201)
def add_advance(case_id: uuid.UUID, body: AdvancePaymentIn, db: Session = Depends(get_db),
                user: m.User = Depends(get_current_user)):
    ap = m.AdvancePayment(case_id=case_id, **body.model_dump())
    db.add(ap)
    db.commit()
    db.refresh(ap)
    return ap


@router.delete("/{advance_id}", status_code=204)
def delete_advance(case_id: uuid.UUID, advance_id: uuid.UUID, db: Session = Depends(get_db),
                   user: m.User = Depends(get_current_user)):
    ap = db.get(m.AdvancePayment, advance_id)
    if ap is None or ap.case_id != case_id:
        raise HTTPException(status_code=404, detail="מקדמה לא נמצאה")
    db.delete(ap)
    db.commit()
