import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
import app.models as m
import app.enums as e
from app.api_schemas import CaseCreate, CaseUpdate, CaseOut, AuditOut

router = APIRouter(prefix="/cases", tags=["cases"])


def _get_case(db: Session, case_id: uuid.UUID) -> m.Case:
    case = db.get(m.Case, case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="תיק לא נמצא")
    return case


@router.get("", response_model=list[CaseOut])
def list_cases(db: Session = Depends(get_db), user: m.User = Depends(get_current_user)):
    return db.scalars(select(m.Case).order_by(m.Case.created_at.desc())).all()


@router.post("", response_model=CaseOut, status_code=201)
def create_case(body: CaseCreate, db: Session = Depends(get_db), user: m.User = Depends(get_current_user)):
    case = m.Case(
        created_by=user.id,
        taxpayer_id_number=body.taxpayer_id_number,
        taxpayer_name=body.taxpayer_name,
        taxpayer_birth_year=body.taxpayer_birth_year,
        tax_year=body.tax_year,
        months_count=body.months_count,
        months_list=list(range(1, body.months_count + 1)),
        marital_status=body.marital_status,
        gender=body.gender,
        case_type=body.case_type,
        has_spouse=body.spouse is not None,
        extra_credit_points=body.extra_credit_points,
        notes=body.notes,
    )
    for ch in body.children:
        case.children.append(m.Child(birth_year=ch.birth_year, is_disabled=ch.is_disabled))
    if body.spouse is not None:
        case.spouse = m.SpouseInfo(**body.spouse.model_dump())
    db.add(case)
    db.flush()
    db.add(m.CalculationAudit(case_id=case.id, user_id=user.id, action=e.AuditAction.created,
                              details={"taxpayer": body.taxpayer_name}))
    db.commit()
    db.refresh(case)
    return case


@router.get("/{case_id}", response_model=CaseOut)
def get_case(case_id: uuid.UUID, db: Session = Depends(get_db), user: m.User = Depends(get_current_user)):
    return _get_case(db, case_id)


@router.put("/{case_id}", response_model=CaseOut)
def update_case(case_id: uuid.UUID, body: CaseUpdate, db: Session = Depends(get_db),
                user: m.User = Depends(get_current_user)):
    case = _get_case(db, case_id)
    data = body.model_dump(exclude_unset=True)
    children = data.pop("children", None)
    spouse = data.pop("spouse", None)
    for k, v in data.items():
        setattr(case, k, v)
    if "months_count" in data:
        case.months_list = list(range(1, data["months_count"] + 1))
    if children is not None:
        case.children.clear()
        for ch in children:
            case.children.append(m.Child(birth_year=ch["birth_year"], is_disabled=ch["is_disabled"]))
    if spouse is not None:
        if case.spouse is None:
            case.spouse = m.SpouseInfo(**spouse)
        else:
            for k, v in spouse.items():
                setattr(case.spouse, k, v)
        case.has_spouse = True
    db.commit()
    db.refresh(case)
    return case


@router.delete("/{case_id}", status_code=204)
def delete_case(case_id: uuid.UUID, db: Session = Depends(get_db), user: m.User = Depends(get_current_user)):
    case = _get_case(db, case_id)
    if user.role != e.UserRole.admin and case.created_by != user.id:
        raise HTTPException(status_code=403, detail="אין הרשאה למחוק תיק זה")
    db.delete(case)
    db.commit()


@router.get("/{case_id}/audit", response_model=list[AuditOut])
def case_audit(case_id: uuid.UUID, db: Session = Depends(get_db), user: m.User = Depends(get_current_user)):
    return db.scalars(
        select(m.CalculationAudit).where(m.CalculationAudit.case_id == case_id)
        .order_by(m.CalculationAudit.timestamp.desc())
    ).all()
