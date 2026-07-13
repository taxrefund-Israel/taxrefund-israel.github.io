import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app import storage, parsers
import app.models as m
import app.enums as e
from app.api_schemas import (
    TrialBalanceImportOut, ManualTrialBalanceIn, UpdateLinesIn,
    PayslipImportOut, PayslipDataIn,
)

router = APIRouter(prefix="/cases/{case_id}", tags=["imports"])


def _next_version(db: Session, model, case_id, taxpayer_type) -> int:
    rows = db.scalars(
        select(model).where(model.case_id == case_id, model.taxpayer_type == taxpayer_type)
    ).all()
    return (max((r.version for r in rows), default=0)) + 1


# ---------------- Trial balance ----------------

@router.post("/trial-balance/upload", response_model=TrialBalanceImportOut)
async def upload_trial_balance(
    case_id: uuid.UUID,
    taxpayer_type: e.TaxpayerType = Form(e.TaxpayerType.primary),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: m.User = Depends(get_current_user),
):
    data = await file.read()
    try:
        lines = parsers.parse_trial_balance(file.filename, data)
    except ValueError as ex:
        raise HTTPException(status_code=400, detail=str(ex))
    key = storage.upload(data, file.filename, prefix=f"trial-balance/{case_id}")
    imp = m.TrialBalanceImport(
        case_id=case_id, taxpayer_type=taxpayer_type, file_path=key,
        original_filename=file.filename, source="file", uploaded_by=user.id,
        version=_next_version(db, m.TrialBalanceImport, case_id, taxpayer_type),
    )
    for ln in lines:
        imp.lines.append(m.TrialBalanceLine(**ln))
    db.add(imp)
    db.add(m.CalculationAudit(case_id=case_id, user_id=user.id, action=e.AuditAction.uploaded_file,
                              details={"type": "trial_balance", "filename": file.filename, "lines": len(lines)}))
    db.commit()
    db.refresh(imp)
    return imp


@router.post("/trial-balance/manual", response_model=TrialBalanceImportOut)
def manual_trial_balance(case_id: uuid.UUID, body: ManualTrialBalanceIn,
                         db: Session = Depends(get_db), user: m.User = Depends(get_current_user)):
    imp = m.TrialBalanceImport(
        case_id=case_id, taxpayer_type=body.taxpayer_type, source="manual",
        uploaded_by=user.id,
        version=_next_version(db, m.TrialBalanceImport, case_id, body.taxpayer_type),
    )
    for ln in body.lines:
        imp.lines.append(m.TrialBalanceLine(**ln.model_dump()))
    db.add(imp)
    db.add(m.CalculationAudit(case_id=case_id, user_id=user.id, action=e.AuditAction.created,
                              details={"type": "trial_balance_manual", "lines": len(body.lines)}))
    db.commit()
    db.refresh(imp)
    return imp


@router.get("/trial-balance", response_model=list[TrialBalanceImportOut])
def list_trial_balance(case_id: uuid.UUID, db: Session = Depends(get_db),
                       user: m.User = Depends(get_current_user)):
    return db.scalars(
        select(m.TrialBalanceImport).where(m.TrialBalanceImport.case_id == case_id)
        .order_by(m.TrialBalanceImport.version.desc())
    ).all()


@router.put("/trial-balance/{import_id}/lines", response_model=TrialBalanceImportOut)
def update_lines(case_id: uuid.UUID, import_id: uuid.UUID, body: UpdateLinesIn,
                 db: Session = Depends(get_db), user: m.User = Depends(get_current_user)):
    imp = db.get(m.TrialBalanceImport, import_id)
    if imp is None or imp.case_id != case_id:
        raise HTTPException(status_code=404, detail="ייבוא לא נמצא")
    imp.lines.clear()
    db.flush()
    for ln in body.lines:
        d = ln.model_dump()
        d.pop("id", None)
        imp.lines.append(m.TrialBalanceLine(**d))
    db.add(m.CalculationAudit(case_id=case_id, user_id=user.id, action=e.AuditAction.updated_line,
                              details={"import_id": str(import_id), "lines": len(body.lines)}))
    db.commit()
    db.refresh(imp)
    return imp


# ---------------- Payslips ----------------

def _payslip_out(imp: m.PayslipImport) -> dict:
    d = imp.data
    return {
        "id": imp.id, "taxpayer_type": imp.taxpayer_type, "source": imp.source,
        "original_filename": imp.original_filename, "version": imp.version,
        "uploaded_at": imp.uploaded_at,
        "gross_cumulative": d.gross_cumulative if d else 0,
        "income_tax_cumulative": d.income_tax_cumulative if d else 0,
        "national_insurance_cumulative": d.national_insurance_cumulative if d else 0,
        "health_insurance_cumulative": d.health_insurance_cumulative if d else 0,
    }


@router.post("/payslip/upload", response_model=PayslipImportOut)
async def upload_payslip(
    case_id: uuid.UUID,
    taxpayer_type: e.TaxpayerType = Form(e.TaxpayerType.primary),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: m.User = Depends(get_current_user),
):
    data = await file.read()
    extracted = parsers.parse_payslip_pdf(data)
    key = storage.upload(data, file.filename, prefix=f"payslip/{case_id}")
    imp = m.PayslipImport(
        case_id=case_id, taxpayer_type=taxpayer_type, file_path=key,
        original_filename=file.filename, source="file", uploaded_by=user.id,
        version=_next_version(db, m.PayslipImport, case_id, taxpayer_type),
    )
    imp.data = m.PayslipData(
        gross_cumulative=extracted["gross_cumulative"],
        income_tax_cumulative=extracted["income_tax_cumulative"],
        national_insurance_cumulative=extracted["national_insurance_cumulative"],
        health_insurance_cumulative=extracted["health_insurance_cumulative"],
        is_manual_entry=False,
    )
    db.add(imp)
    db.add(m.CalculationAudit(case_id=case_id, user_id=user.id, action=e.AuditAction.uploaded_file,
                              details={"type": "payslip", "filename": file.filename}))
    db.commit()
    db.refresh(imp)
    return _payslip_out(imp)


@router.post("/payslip/manual", response_model=PayslipImportOut)
def manual_payslip(case_id: uuid.UUID, body: PayslipDataIn,
                   db: Session = Depends(get_db), user: m.User = Depends(get_current_user)):
    imp = m.PayslipImport(
        case_id=case_id, taxpayer_type=body.taxpayer_type, source="manual",
        uploaded_by=user.id,
        version=_next_version(db, m.PayslipImport, case_id, body.taxpayer_type),
    )
    imp.data = m.PayslipData(
        gross_cumulative=body.gross_cumulative,
        income_tax_cumulative=body.income_tax_cumulative,
        national_insurance_cumulative=body.national_insurance_cumulative,
        health_insurance_cumulative=body.health_insurance_cumulative,
        is_manual_entry=True,
    )
    db.add(imp)
    db.commit()
    db.refresh(imp)
    return _payslip_out(imp)


@router.get("/payslip", response_model=list[PayslipImportOut])
def list_payslips(case_id: uuid.UUID, db: Session = Depends(get_db),
                  user: m.User = Depends(get_current_user)):
    imps = db.scalars(
        select(m.PayslipImport).where(m.PayslipImport.case_id == case_id)
        .order_by(m.PayslipImport.version.desc())
    ).all()
    return [_payslip_out(i) for i in imps]
