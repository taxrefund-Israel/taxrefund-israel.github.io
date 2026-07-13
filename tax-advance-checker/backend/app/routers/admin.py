import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, delete
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_admin
from app.security import hash_password
import app.models as m
from app.api_schemas import (
    UserCreate, UserUpdate, UserOut, TaxParamsBundle, AuditOut,
)

router = APIRouter(prefix="/admin", tags=["admin"])


# ---------------- Users ----------------

@router.get("/users", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db), admin: m.User = Depends(require_admin)):
    return db.scalars(select(m.User).order_by(m.User.created_at)).all()


@router.post("/users", response_model=UserOut, status_code=201)
def create_user(body: UserCreate, db: Session = Depends(get_db), admin: m.User = Depends(require_admin)):
    if db.scalar(select(m.User).where(m.User.email == body.email)):
        raise HTTPException(status_code=409, detail="אימייל כבר קיים")
    user = m.User(
        email=body.email, hashed_password=hash_password(body.password),
        full_name=body.full_name, role=body.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.put("/users/{user_id}", response_model=UserOut)
def update_user(user_id: uuid.UUID, body: UserUpdate, db: Session = Depends(get_db),
                admin: m.User = Depends(require_admin)):
    user = db.get(m.User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="משתמש לא נמצא")
    data = body.model_dump(exclude_unset=True)
    if "password" in data and data["password"]:
        user.hashed_password = hash_password(data.pop("password"))
    else:
        data.pop("password", None)
    for k, v in data.items():
        setattr(user, k, v)
    db.commit()
    db.refresh(user)
    return user


# ---------------- Tax parameters ----------------

@router.get("/tax-params/{tax_year}", response_model=TaxParamsBundle)
def get_tax_params(tax_year: int, db: Session = Depends(get_db), admin: m.User = Depends(require_admin)):
    brackets = db.scalars(select(m.TaxBracket).where(m.TaxBracket.tax_year == tax_year)
                          .order_by(m.TaxBracket.bracket_order)).all()
    ni = db.scalars(select(m.NIBracket).where(m.NIBracket.tax_year == tax_year)
                    .order_by(m.NIBracket.bracket_order)).all()
    ceilings = db.scalar(select(m.NICeilings).where(m.NICeilings.tax_year == tax_year))
    cp = db.scalar(select(m.CreditPoints).where(m.CreditPoints.tax_year == tax_year))
    if not brackets or not ni or ceilings is None or cp is None:
        raise HTTPException(status_code=404, detail=f"לא הוגדרו פרמטרים לשנת {tax_year}")
    return TaxParamsBundle(
        tax_year=tax_year,
        tax_brackets=[{"bracket_order": b.bracket_order, "income_from": b.income_from,
                       "income_to": b.income_to, "rate_pct": b.rate_pct} for b in brackets],
        ni_brackets=[{"bracket_order": b.bracket_order, "income_from": b.income_from,
                      "income_to": b.income_to, "employee_rate_pct": b.employee_rate_pct,
                      "self_employed_rate_pct": b.self_employed_rate_pct,
                      "health_rate_pct": b.health_rate_pct} for b in ni],
        ni_ceilings={"monthly_ceiling": ceilings.monthly_ceiling,
                     "annual_ceiling": ceilings.annual_ceiling,
                     "minimum_income": ceilings.minimum_income},
        credit_points={"credit_point_value": cp.credit_point_value,
                       "basic_points_single": cp.basic_points_single,
                       "basic_points_married_addition": cp.basic_points_married_addition,
                       "basic_points_female_addition": cp.basic_points_female_addition,
                       "child_points_by_age": cp.child_points_by_age},
    )


@router.put("/tax-params/{tax_year}", response_model=TaxParamsBundle)
def upsert_tax_params(tax_year: int, body: TaxParamsBundle, db: Session = Depends(get_db),
                      admin: m.User = Depends(require_admin)):
    # Replace all params for the year
    db.execute(delete(m.TaxBracket).where(m.TaxBracket.tax_year == tax_year))
    db.execute(delete(m.NIBracket).where(m.NIBracket.tax_year == tax_year))
    db.execute(delete(m.NICeilings).where(m.NICeilings.tax_year == tax_year))
    db.execute(delete(m.CreditPoints).where(m.CreditPoints.tax_year == tax_year))

    for b in body.tax_brackets:
        db.add(m.TaxBracket(tax_year=tax_year, **b.model_dump()))
    for b in body.ni_brackets:
        db.add(m.NIBracket(tax_year=tax_year, **b.model_dump()))
    db.add(m.NICeilings(tax_year=tax_year, **body.ni_ceilings.model_dump()))
    db.add(m.CreditPoints(tax_year=tax_year, **body.credit_points.model_dump()))
    db.commit()
    return get_tax_params(tax_year, db, admin)


@router.get("/tax-years", response_model=list[int])
def list_tax_years(db: Session = Depends(get_db), admin: m.User = Depends(require_admin)):
    rows = db.scalars(select(m.TaxBracket.tax_year).distinct()).all()
    return sorted(set(rows))


@router.get("/audit-log", response_model=list[AuditOut])
def audit_log(db: Session = Depends(get_db), admin: m.User = Depends(require_admin)):
    return db.scalars(select(m.CalculationAudit).order_by(m.CalculationAudit.timestamp.desc()).limit(500)).all()
