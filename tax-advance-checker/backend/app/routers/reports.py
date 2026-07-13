import uuid

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app import reports, storage
import app.models as m
import app.enums as e

router = APIRouter(prefix="/cases/{case_id}/reports", tags=["reports"])


def _current_calc(db: Session, case_id: uuid.UUID) -> m.CalculationResult:
    calc = db.scalar(
        select(m.CalculationResult).where(
            m.CalculationResult.case_id == case_id,
            m.CalculationResult.is_current == True,  # noqa: E712
        )
    )
    if calc is None:
        raise HTTPException(status_code=400, detail="יש לבצע חישוב לפני הפקת דוח")
    return calc


@router.get("/pdf")
def report_pdf(case_id: uuid.UUID, db: Session = Depends(get_db), user: m.User = Depends(get_current_user)):
    case = db.get(m.Case, case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="תיק לא נמצא")
    calc = _current_calc(db, case_id)
    data = reports.generate_pdf(case, calc.result_json)
    key = storage.upload(data, f"report_{case.taxpayer_id_number}.pdf", prefix=f"reports/{case_id}")
    db.add(m.Report(case_id=case_id, calculation_id=calc.id, report_type=e.ReportType.pdf,
                    file_path=key, generated_by=user.id))
    db.add(m.CalculationAudit(case_id=case_id, user_id=user.id, action=e.AuditAction.exported,
                              details={"type": "pdf"}))
    db.commit()
    return StreamingResponse(
        iter([data]), media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="report_{case.taxpayer_id_number}.pdf"'},
    )


@router.get("/excel")
def report_excel(case_id: uuid.UUID, db: Session = Depends(get_db), user: m.User = Depends(get_current_user)):
    case = db.get(m.Case, case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="תיק לא נמצא")
    calc = _current_calc(db, case_id)
    data = reports.generate_excel(case, calc.result_json)
    key = storage.upload(data, f"report_{case.taxpayer_id_number}.xlsx", prefix=f"reports/{case_id}")
    db.add(m.Report(case_id=case_id, calculation_id=calc.id, report_type=e.ReportType.excel,
                    file_path=key, generated_by=user.id))
    db.add(m.CalculationAudit(case_id=case_id, user_id=user.id, action=e.AuditAction.exported,
                              details={"type": "excel"}))
    db.commit()
    return StreamingResponse(
        iter([data]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="report_{case.taxpayer_id_number}.xlsx"'},
    )
