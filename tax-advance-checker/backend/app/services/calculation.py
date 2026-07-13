"""Assemble engine inputs from DB rows, run the engine, persist the result."""
from __future__ import annotations

import uuid
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

import app.models as m
import app.enums as e
from app.engine.schemas import (
    TaxParams, TaxBracketParam, NIBracketParam, NICeilingsParam,
    CreditPointsParam, PersonInput, CaseInput, ChildInfo,
)
from app.engine.tax_engine import calculate_case

Q = Decimal


def load_tax_params(db: Session, tax_year: int) -> TaxParams:
    brackets = db.scalars(
        select(m.TaxBracket).where(m.TaxBracket.tax_year == tax_year)
    ).all()
    if not brackets:
        raise ValueError(f"לא הוגדרו מדרגות מס לשנת {tax_year}")
    ni = db.scalars(select(m.NIBracket).where(m.NIBracket.tax_year == tax_year)).all()
    ceilings = db.scalar(select(m.NICeilings).where(m.NICeilings.tax_year == tax_year))
    cp = db.scalar(select(m.CreditPoints).where(m.CreditPoints.tax_year == tax_year))
    if not ni or ceilings is None or cp is None:
        raise ValueError(f"חסרים פרמטרי ביטוח לאומי / נקודות זיכוי לשנת {tax_year}")

    return TaxParams(
        tax_year=tax_year,
        tax_brackets=[
            TaxBracketParam(b.bracket_order, b.income_from, b.income_to, b.rate_pct)
            for b in brackets
        ],
        ni_brackets=[
            NIBracketParam(b.bracket_order, b.income_from, b.income_to,
                           b.employee_rate_pct, b.self_employed_rate_pct, b.health_rate_pct)
            for b in ni
        ],
        ni_ceilings=NICeilingsParam(ceilings.monthly_ceiling, ceilings.annual_ceiling, ceilings.minimum_income),
        credit_points=CreditPointsParam(
            cp.credit_point_value, cp.basic_points_single,
            cp.basic_points_married_addition, cp.basic_points_female_addition,
            cp.child_points_by_age,
        ),
    )


def _aggregate_trial_balance(db: Session, case_id: uuid.UUID, taxpayer_type: e.TaxpayerType):
    """Latest import per taxpayer_type → (revenue, cogs, expenses_accounting, expenses_allowed)."""
    imp = db.scalar(
        select(m.TrialBalanceImport)
        .where(m.TrialBalanceImport.case_id == case_id,
               m.TrialBalanceImport.taxpayer_type == taxpayer_type)
        .order_by(m.TrialBalanceImport.version.desc())
    )
    revenue = cogs = exp_acc = exp_allowed = Q(0)
    if imp is None:
        return revenue, cogs, exp_acc, exp_allowed
    for ln in imp.lines:
        amount = abs(ln.net_amount)
        if ln.category == e.LineCategory.revenue:
            revenue += amount
        elif ln.category == e.LineCategory.cost_of_goods:
            cogs += amount
        elif ln.category == e.LineCategory.expense:
            exp_acc += amount
            exp_allowed += amount * ln.deduction_pct / Q(100)
    return revenue, cogs, exp_acc, exp_allowed


def _latest_payslip(db: Session, case_id: uuid.UUID, taxpayer_type: e.TaxpayerType):
    imp = db.scalar(
        select(m.PayslipImport)
        .where(m.PayslipImport.case_id == case_id,
               m.PayslipImport.taxpayer_type == taxpayer_type)
        .order_by(m.PayslipImport.version.desc())
    )
    if imp is None or imp.data is None:
        return Q(0), Q(0), Q(0), Q(0)
    d = imp.data
    return (d.gross_cumulative, d.income_tax_cumulative,
            d.national_insurance_cumulative, d.health_insurance_cumulative)


def _advances(db: Session, case_id: uuid.UUID, taxpayer_type: e.TaxpayerType):
    rows = db.scalars(
        select(m.AdvancePayment)
        .where(m.AdvancePayment.case_id == case_id,
               m.AdvancePayment.taxpayer_type == taxpayer_type)
    ).all()
    income_tax_amount = Q(0)
    ni_monthly = Q(0)
    couple_pct = None
    for r in rows:
        if r.payment_type == e.PaymentType.income_tax_amount and r.advance_amount:
            income_tax_amount += r.advance_amount
        elif r.payment_type == e.PaymentType.income_tax_pct and r.advance_pct is not None:
            couple_pct = r.advance_pct
        elif r.payment_type == e.PaymentType.national_insurance_monthly and r.advance_amount:
            ni_monthly = r.advance_amount
    return income_tax_amount, ni_monthly, couple_pct


def _build_person(db: Session, case: m.Case, taxpayer_type: e.TaxpayerType,
                  is_self_employed: bool, is_employed: bool,
                  gender: str, marital_status: str, birth_year, children, extra_points):
    revenue, cogs, exp_acc, exp_allowed = _aggregate_trial_balance(db, case.id, taxpayer_type)
    gross, it_paid, ni_paid, health_paid = _latest_payslip(db, case.id, taxpayer_type)
    it_amount, ni_monthly, couple_pct = _advances(db, case.id, taxpayer_type)
    person = PersonInput(
        is_self_employed=is_self_employed,
        is_employed=is_employed,
        business_revenue=revenue,
        business_cogs=cogs,
        business_expenses_accounting=exp_acc,
        business_expenses_allowed=exp_allowed,
        salary_gross_cumulative=gross,
        salary_income_tax_paid=it_paid,
        salary_ni_paid=ni_paid,
        salary_health_paid=health_paid,
        gender=gender,
        marital_status=marital_status,
        birth_year=birth_year,
        children=children,
        extra_credit_points=extra_points,
        advance_income_tax_amount=it_amount,
        advance_ni_monthly=ni_monthly,
    )
    return person, couple_pct


def build_case_input(db: Session, case: m.Case) -> CaseInput:
    children = [ChildInfo(c.birth_year, c.is_disabled) for c in case.children]
    primary_self = case.case_type in (
        e.CaseType.self_employed_only, e.CaseType.self_employed_and_employed,
        e.CaseType.couple_both_self_employed, e.CaseType.self_employed_spouse_self_employed,
    )
    primary_employed = case.case_type in (
        e.CaseType.employed_only, e.CaseType.self_employed_and_employed,
    )
    primary, couple_pct = _build_person(
        db, case, e.TaxpayerType.primary, primary_self, primary_employed,
        case.gender.value, case.marital_status.value, case.taxpayer_birth_year,
        children, case.extra_credit_points,
    )

    # נישום יחיד: אחוז המקדמות חל על המחזור שלו עצמו (לא מסלול בני זוג).
    if not (case.has_spouse and case.spouse is not None) and couple_pct is not None:
        primary.advance_income_tax_pct = couple_pct

    spouse_input = None
    if case.has_spouse and case.spouse is not None:
        sp = case.spouse
        spouse_input, sp_couple_pct = _build_person(
            db, case, e.TaxpayerType.spouse, sp.is_self_employed, sp.is_employed,
            sp.gender.value if sp.gender else "female",
            case.marital_status.value, sp.birth_year, [], sp.extra_credit_points,
        )
        couple_pct = couple_pct or sp_couple_pct

    return CaseInput(
        tax_year=case.tax_year,
        months_count=case.months_count,
        case_type=case.case_type.value,
        primary=primary,
        spouse=spouse_input,
        couple_advance_income_tax_pct=couple_pct,
    )


def run_calculation(db: Session, case: m.Case, user_id: uuid.UUID) -> m.CalculationResult:
    params = load_tax_params(db, case.tax_year)
    case_input = build_case_input(db, case)
    result = calculate_case(case_input, params)

    # version + mark previous as not current
    prev = db.scalars(
        select(m.CalculationResult).where(m.CalculationResult.case_id == case.id)
    ).all()
    for p in prev:
        p.is_current = False
    next_version = (max((p.version for p in prev), default=0)) + 1

    calc = m.CalculationResult(
        case_id=case.id, calculated_by=user_id, version=next_version,
        result_json=result, is_current=True,
    )
    db.add(calc)
    db.add(m.CalculationAudit(
        case_id=case.id, user_id=user_id, action=e.AuditAction.calculated,
        details={"version": next_version, "score": result["primary"].get("score_color")},
    ))
    db.commit()
    db.refresh(calc)
    return calc
