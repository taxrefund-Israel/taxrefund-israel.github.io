import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, EmailStr, ConfigDict

import app.enums as e


# ---------- Auth ----------
class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: "UserOut"


class RefreshRequest(BaseModel):
    refresh_token: str


# ---------- Users ----------
class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    email: EmailStr
    full_name: str
    role: e.UserRole
    is_active: bool


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: e.UserRole = e.UserRole.employee


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    password: Optional[str] = None
    role: Optional[e.UserRole] = None
    is_active: Optional[bool] = None


# ---------- Children / Spouse ----------
class ChildIn(BaseModel):
    birth_year: int
    is_disabled: bool = False


class ChildOut(ChildIn):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID


class SpouseIn(BaseModel):
    id_number: Optional[str] = None
    name: Optional[str] = None
    gender: Optional[e.Gender] = None
    birth_year: Optional[int] = None
    is_self_employed: bool = False
    is_employed: bool = False
    extra_credit_points: Decimal = Decimal(0)


class SpouseOut(SpouseIn):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID


# ---------- Cases ----------
class CaseCreate(BaseModel):
    taxpayer_id_number: str
    taxpayer_name: str
    taxpayer_birth_year: Optional[int] = None
    tax_year: int
    months_count: int
    marital_status: e.MaritalStatus
    gender: e.Gender
    case_type: e.CaseType
    extra_credit_points: Decimal = Decimal(0)
    notes: Optional[str] = None
    children: list[ChildIn] = []
    spouse: Optional[SpouseIn] = None


class CaseUpdate(BaseModel):
    taxpayer_name: Optional[str] = None
    taxpayer_birth_year: Optional[int] = None
    months_count: Optional[int] = None
    marital_status: Optional[e.MaritalStatus] = None
    gender: Optional[e.Gender] = None
    case_type: Optional[e.CaseType] = None
    status: Optional[e.CaseStatus] = None
    extra_credit_points: Optional[Decimal] = None
    notes: Optional[str] = None
    children: Optional[list[ChildIn]] = None
    spouse: Optional[SpouseIn] = None


class CaseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    created_by: uuid.UUID
    taxpayer_id_number: str
    taxpayer_name: str
    taxpayer_birth_year: Optional[int]
    tax_year: int
    months_count: int
    months_list: list
    marital_status: e.MaritalStatus
    gender: e.Gender
    case_type: e.CaseType
    has_spouse: bool
    status: e.CaseStatus
    extra_credit_points: Decimal
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime
    children: list[ChildOut] = []
    spouse: Optional[SpouseOut] = None


# ---------- Trial balance ----------
class TrialBalanceLineIn(BaseModel):
    account_code: Optional[str] = None
    account_name: str
    debit_amount: Decimal = Decimal(0)
    credit_amount: Decimal = Decimal(0)
    net_amount: Decimal = Decimal(0)
    category: e.LineCategory = e.LineCategory.other
    deduction_pct: Decimal = Decimal(100)
    notes: Optional[str] = None
    is_manually_overridden: bool = False


class TrialBalanceLineOut(TrialBalanceLineIn):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID


class TrialBalanceImportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    taxpayer_type: e.TaxpayerType
    source: str
    original_filename: Optional[str]
    version: int
    uploaded_at: datetime
    lines: list[TrialBalanceLineOut] = []


class ManualTrialBalanceIn(BaseModel):
    taxpayer_type: e.TaxpayerType = e.TaxpayerType.primary
    lines: list[TrialBalanceLineIn]


class UpdateLinesIn(BaseModel):
    lines: list[TrialBalanceLineOut]


# ---------- Payslip ----------
class PayslipDataIn(BaseModel):
    taxpayer_type: e.TaxpayerType = e.TaxpayerType.primary
    gross_cumulative: Decimal = Decimal(0)
    income_tax_cumulative: Decimal = Decimal(0)
    national_insurance_cumulative: Decimal = Decimal(0)
    health_insurance_cumulative: Decimal = Decimal(0)


class PayslipImportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    taxpayer_type: e.TaxpayerType
    source: str
    original_filename: Optional[str]
    version: int
    uploaded_at: datetime
    gross_cumulative: Decimal = Decimal(0)
    income_tax_cumulative: Decimal = Decimal(0)
    national_insurance_cumulative: Decimal = Decimal(0)
    health_insurance_cumulative: Decimal = Decimal(0)


# ---------- Advance payments ----------
class AdvancePaymentIn(BaseModel):
    taxpayer_type: e.TaxpayerType = e.TaxpayerType.primary
    payment_type: e.PaymentType
    advance_pct: Optional[Decimal] = None
    advance_amount: Optional[Decimal] = None
    notes: Optional[str] = None


class AdvancePaymentOut(AdvancePaymentIn):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID


# ---------- Calculation ----------
class CalculationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    version: int
    calculated_at: datetime
    is_current: bool
    result_json: dict


# ---------- Tax params (admin) ----------
class TaxBracketIn(BaseModel):
    bracket_order: int
    income_from: Decimal
    income_to: Optional[Decimal] = None
    rate_pct: Decimal


class NIBracketIn(BaseModel):
    bracket_order: int
    income_from: Decimal
    income_to: Optional[Decimal] = None
    employee_rate_pct: Decimal
    self_employed_rate_pct: Decimal
    health_rate_pct: Decimal


class NICeilingsIn(BaseModel):
    monthly_ceiling: Decimal
    annual_ceiling: Decimal
    minimum_income: Decimal


class CreditPointsIn(BaseModel):
    credit_point_value: Decimal
    basic_points_single: Decimal
    basic_points_married_addition: Decimal = Decimal(0)
    basic_points_female_addition: Decimal = Decimal("0.5")
    child_points_by_age: dict


class TaxParamsBundle(BaseModel):
    tax_year: int
    tax_brackets: list[TaxBracketIn]
    ni_brackets: list[NIBracketIn]
    ni_ceilings: NICeilingsIn
    credit_points: CreditPointsIn


class AuditOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    case_id: uuid.UUID
    user_id: uuid.UUID
    action: e.AuditAction
    details: Optional[dict]
    timestamp: datetime


TokenResponse.model_rebuild()
