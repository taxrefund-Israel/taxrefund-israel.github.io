import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    String, Boolean, SmallInteger, Numeric, ForeignKey, Text,
    DateTime, func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.dbtypes import GUID, JSONType, PortableEnum as SAEnum
import app.enums as e


def _uuid_pk():
    return mapped_column(GUID(as_uuid=True), primary_key=True, default=uuid.uuid4)


class User(Base):
    __tablename__ = "users"
    id: Mapped[uuid.UUID] = _uuid_pk()
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[e.UserRole] = mapped_column(
        SAEnum(e.UserRole, name="user_role"), default=e.UserRole.employee, nullable=False
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_login: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Case(Base):
    __tablename__ = "cases"
    id: Mapped[uuid.UUID] = _uuid_pk()
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    taxpayer_id_number: Mapped[str] = mapped_column(String(20), nullable=False)
    taxpayer_name: Mapped[str] = mapped_column(String(255), nullable=False)
    taxpayer_birth_year: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    tax_year: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    months_count: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    months_list: Mapped[list] = mapped_column(JSONType, nullable=False)
    marital_status: Mapped[e.MaritalStatus] = mapped_column(
        SAEnum(e.MaritalStatus, name="marital_status"), nullable=False
    )
    gender: Mapped[e.Gender] = mapped_column(SAEnum(e.Gender, name="gender"), nullable=False)
    case_type: Mapped[e.CaseType] = mapped_column(SAEnum(e.CaseType, name="case_type"), nullable=False)
    has_spouse: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    status: Mapped[e.CaseStatus] = mapped_column(
        SAEnum(e.CaseStatus, name="case_status"), default=e.CaseStatus.draft, nullable=False
    )
    extra_credit_points: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    children: Mapped[list["Child"]] = relationship(cascade="all, delete-orphan", back_populates="case")
    spouse: Mapped["SpouseInfo | None"] = relationship(cascade="all, delete-orphan", back_populates="case", uselist=False)


class Child(Base):
    __tablename__ = "children"
    id: Mapped[uuid.UUID] = _uuid_pk()
    case_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("cases.id", ondelete="CASCADE"), nullable=False)
    birth_year: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    is_disabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    case: Mapped["Case"] = relationship(back_populates="children")


class SpouseInfo(Base):
    __tablename__ = "spouse_info"
    id: Mapped[uuid.UUID] = _uuid_pk()
    case_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("cases.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    id_number: Mapped[str | None] = mapped_column(String(20), nullable=True)
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    gender: Mapped[e.Gender | None] = mapped_column(SAEnum(e.Gender, name="gender"), nullable=True)
    birth_year: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    is_self_employed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_employed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    extra_credit_points: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0, nullable=False)
    case: Mapped["Case"] = relationship(back_populates="spouse")


class TrialBalanceImport(Base):
    __tablename__ = "trial_balance_imports"
    id: Mapped[uuid.UUID] = _uuid_pk()
    case_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("cases.id", ondelete="CASCADE"), nullable=False)
    taxpayer_type: Mapped[e.TaxpayerType] = mapped_column(
        SAEnum(e.TaxpayerType, name="taxpayer_type"), default=e.TaxpayerType.primary, nullable=False
    )
    file_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    original_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    source: Mapped[str] = mapped_column(String(20), default="file", nullable=False)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    uploaded_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    version: Mapped[int] = mapped_column(SmallInteger, default=1, nullable=False)
    lines: Mapped[list["TrialBalanceLine"]] = relationship(cascade="all, delete-orphan", back_populates="import_")


class TrialBalanceLine(Base):
    __tablename__ = "trial_balance_lines"
    id: Mapped[uuid.UUID] = _uuid_pk()
    import_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("trial_balance_imports.id", ondelete="CASCADE"), nullable=False
    )
    account_code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    account_name: Mapped[str] = mapped_column(String(500), nullable=False)
    debit_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0, nullable=False)
    credit_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0, nullable=False)
    net_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0, nullable=False)
    category: Mapped[e.LineCategory] = mapped_column(
        SAEnum(e.LineCategory, name="line_category"), default=e.LineCategory.other, nullable=False
    )
    deduction_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=100, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_manually_overridden: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    import_: Mapped["TrialBalanceImport"] = relationship(back_populates="lines")


class PayslipImport(Base):
    __tablename__ = "payslip_imports"
    id: Mapped[uuid.UUID] = _uuid_pk()
    case_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("cases.id", ondelete="CASCADE"), nullable=False)
    taxpayer_type: Mapped[e.TaxpayerType] = mapped_column(
        SAEnum(e.TaxpayerType, name="taxpayer_type"), default=e.TaxpayerType.primary, nullable=False
    )
    file_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    original_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    source: Mapped[str] = mapped_column(String(20), default="file", nullable=False)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    uploaded_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    version: Mapped[int] = mapped_column(SmallInteger, default=1, nullable=False)
    data: Mapped["PayslipData | None"] = relationship(cascade="all, delete-orphan", back_populates="import_", uselist=False)


class PayslipData(Base):
    __tablename__ = "payslip_data"
    id: Mapped[uuid.UUID] = _uuid_pk()
    import_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("payslip_imports.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    gross_cumulative: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0, nullable=False)
    income_tax_cumulative: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0, nullable=False)
    national_insurance_cumulative: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0, nullable=False)
    health_insurance_cumulative: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0, nullable=False)
    is_manual_entry: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    import_: Mapped["PayslipImport"] = relationship(back_populates="data")


class AdvancePayment(Base):
    __tablename__ = "advance_payments"
    id: Mapped[uuid.UUID] = _uuid_pk()
    case_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("cases.id", ondelete="CASCADE"), nullable=False)
    taxpayer_type: Mapped[e.TaxpayerType] = mapped_column(
        SAEnum(e.TaxpayerType, name="taxpayer_type"), default=e.TaxpayerType.primary, nullable=False
    )
    payment_type: Mapped[e.PaymentType] = mapped_column(SAEnum(e.PaymentType, name="payment_type"), nullable=False)
    advance_pct: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    advance_amount: Mapped[Decimal | None] = mapped_column(Numeric(15, 2), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class CalculationResult(Base):
    __tablename__ = "calculation_results"
    id: Mapped[uuid.UUID] = _uuid_pk()
    case_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("cases.id", ondelete="CASCADE"), nullable=False)
    calculated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    calculated_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    version: Mapped[int] = mapped_column(SmallInteger, default=1, nullable=False)
    result_json: Mapped[dict] = mapped_column(JSONType, nullable=False)
    is_current: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class CalculationAudit(Base):
    __tablename__ = "calculation_audit"
    id: Mapped[uuid.UUID] = _uuid_pk()
    case_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("cases.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    action: Mapped[e.AuditAction] = mapped_column(SAEnum(e.AuditAction, name="audit_action"), nullable=False)
    details: Mapped[dict | None] = mapped_column(JSONType, nullable=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class TaxBracket(Base):
    __tablename__ = "tax_brackets"
    id: Mapped[uuid.UUID] = _uuid_pk()
    tax_year: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    bracket_order: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    income_from: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    income_to: Mapped[Decimal | None] = mapped_column(Numeric(15, 2), nullable=True)
    rate_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)


class CreditPoints(Base):
    __tablename__ = "credit_points"
    id: Mapped[uuid.UUID] = _uuid_pk()
    tax_year: Mapped[int] = mapped_column(SmallInteger, unique=True, nullable=False)
    credit_point_value: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    basic_points_single: Mapped[Decimal] = mapped_column(Numeric(4, 2), nullable=False)
    basic_points_married_addition: Mapped[Decimal] = mapped_column(Numeric(4, 2), default=0, nullable=False)
    basic_points_female_addition: Mapped[Decimal] = mapped_column(Numeric(4, 2), default=0.5, nullable=False)
    child_points_by_age: Mapped[dict] = mapped_column(JSONType, nullable=False)


class NIBracket(Base):
    __tablename__ = "ni_brackets"
    id: Mapped[uuid.UUID] = _uuid_pk()
    tax_year: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    bracket_order: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    income_from: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    income_to: Mapped[Decimal | None] = mapped_column(Numeric(15, 2), nullable=True)
    employee_rate_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    self_employed_rate_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    health_rate_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)


class NICeilings(Base):
    __tablename__ = "ni_ceilings"
    id: Mapped[uuid.UUID] = _uuid_pk()
    tax_year: Mapped[int] = mapped_column(SmallInteger, unique=True, nullable=False)
    monthly_ceiling: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    annual_ceiling: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    minimum_income: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)


class Report(Base):
    __tablename__ = "reports"
    id: Mapped[uuid.UUID] = _uuid_pk()
    case_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("cases.id", ondelete="CASCADE"), nullable=False)
    calculation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("calculation_results.id"), nullable=False)
    report_type: Mapped[e.ReportType] = mapped_column(SAEnum(e.ReportType, name="report_type"), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    generated_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
