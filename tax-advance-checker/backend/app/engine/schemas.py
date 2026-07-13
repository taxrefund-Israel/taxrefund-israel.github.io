"""Pure-Python data structures for the tax engine.

The engine is intentionally decoupled from the DB layer: it receives plain
dataclasses (assembled from DB rows by the API layer) and returns a
serializable result. This keeps the rules engine unit-testable in isolation.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal
from typing import Optional

Q = Decimal


@dataclass
class TaxBracketParam:
    bracket_order: int
    income_from: Decimal
    income_to: Optional[Decimal]  # None = no ceiling
    rate_pct: Decimal


@dataclass
class NIBracketParam:
    bracket_order: int
    income_from: Decimal
    income_to: Optional[Decimal]
    employee_rate_pct: Decimal
    self_employed_rate_pct: Decimal
    health_rate_pct: Decimal


@dataclass
class NICeilingsParam:
    monthly_ceiling: Decimal
    annual_ceiling: Decimal
    minimum_income: Decimal


@dataclass
class CreditPointsParam:
    credit_point_value: Decimal
    basic_points_single: Decimal
    basic_points_married_addition: Decimal
    basic_points_female_addition: Decimal
    child_points_by_age: dict  # {"0": 1.5, "1": 2.5, ...}


@dataclass
class TaxParams:
    tax_year: int
    tax_brackets: list[TaxBracketParam]
    ni_brackets: list[NIBracketParam]
    ni_ceilings: NICeilingsParam
    credit_points: CreditPointsParam


@dataclass
class ChildInfo:
    birth_year: int
    is_disabled: bool = False


@dataclass
class PersonInput:
    """Inputs for one taxpayer (primary or spouse)."""
    is_self_employed: bool = False
    is_employed: bool = False

    # עסק (לתקופה הנבדקת)
    business_revenue: Decimal = Q(0)
    business_cogs: Decimal = Q(0)
    business_expenses_accounting: Decimal = Q(0)
    business_expenses_allowed: Decimal = Q(0)  # אחרי תיאום מס

    # שכר (מצטבר לתקופה)
    salary_gross_cumulative: Decimal = Q(0)
    salary_income_tax_paid: Decimal = Q(0)
    salary_ni_paid: Decimal = Q(0)
    salary_health_paid: Decimal = Q(0)

    # פרטים אישיים (לנקודות זיכוי)
    gender: str = "male"  # male | female
    marital_status: str = "single"
    birth_year: Optional[int] = None
    children: list[ChildInfo] = field(default_factory=list)
    extra_credit_points: Decimal = Q(0)

    # מקדמות
    advance_income_tax_pct: Decimal = Q(0)      # אחוז מקדמות מהמחזור (נישום יחיד)
    advance_income_tax_amount: Decimal = Q(0)   # סכום ששולם בפועל לתקופה
    advance_ni_monthly: Decimal = Q(0)          # מקדמה חודשית קבועה ששולמה


@dataclass
class CaseInput:
    tax_year: int
    months_count: int  # 1–12
    case_type: str
    primary: PersonInput
    spouse: Optional[PersonInput] = None

    # מקדמות מ"ה לבני זוג: אחוז אחד מהמחזור המשותף.
    # אם מוזן — גובר על advance_income_tax_amount של כל אחד בנפרד.
    couple_advance_income_tax_pct: Optional[Decimal] = None
