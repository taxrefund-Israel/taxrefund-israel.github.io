"""Tax & National-Insurance rules engine.

All parameters are injected (TaxParams) — nothing about rates, brackets or
credit-point values is hard-coded here. The engine works in Decimal throughout
and rounds only for presentation.

Conventions
-----------
* Income-tax brackets are ANNUAL. Period figures are projected to a full year,
  taxed, then scaled back by months_count/12.
* National-insurance brackets are MONTHLY. Period figures are reduced to a
  monthly average, charged, then multiplied back by months_count.
* "business taxable income" = revenue - cogs - allowed_expenses.
"""
from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

from app.engine.schemas import (
    TaxParams, PersonInput, CaseInput, ChildInfo,
    TaxBracketParam, NIBracketParam, NICeilingsParam, CreditPointsParam,
)

Q = Decimal
ZERO = Q(0)
TWELVE = Q(12)


def _money(x: Decimal) -> Decimal:
    return Q(x).quantize(Q("0.01"), rounding=ROUND_HALF_UP)


# --------------------------------------------------------------------------- #
# Income tax                                                                   #
# --------------------------------------------------------------------------- #

def apply_tax_brackets(annual_income: Decimal, brackets: list[TaxBracketParam]) -> Decimal:
    """Progressive income tax on an annual taxable income."""
    if annual_income <= ZERO:
        return ZERO
    tax = ZERO
    for b in sorted(brackets, key=lambda x: x.bracket_order):
        lower = b.income_from
        upper = b.income_to if b.income_to is not None else annual_income
        if annual_income <= lower:
            break
        taxable_in_bracket = min(annual_income, upper) - lower
        if taxable_in_bracket <= ZERO:
            continue
        tax += taxable_in_bracket * b.rate_pct / Q(100)
    return tax


def tax_bracket_breakdown(annual_income: Decimal, brackets: list[TaxBracketParam]) -> list[dict]:
    rows = []
    for b in sorted(brackets, key=lambda x: x.bracket_order):
        lower = b.income_from
        upper = b.income_to if b.income_to is not None else annual_income
        if annual_income <= lower:
            taxable = ZERO
        else:
            taxable = max(ZERO, min(annual_income, upper) - lower)
        rows.append({
            "order": b.bracket_order,
            "from": float(lower),
            "to": float(b.income_to) if b.income_to is not None else None,
            "rate_pct": float(b.rate_pct),
            "taxable_amount": float(_money(taxable)),
            "tax": float(_money(taxable * b.rate_pct / Q(100))),
        })
    return rows


# --------------------------------------------------------------------------- #
# Credit points                                                               #
# --------------------------------------------------------------------------- #

def calculate_credit_points(
    person: PersonInput, params: CreditPointsParam, tax_year: int, months_count: int
) -> tuple[Decimal, Decimal]:
    """Returns (total_points, period_credit_value_ils)."""
    points = params.basic_points_single
    if person.gender == "female":
        points += params.basic_points_female_addition
    if person.marital_status == "married":
        points += params.basic_points_married_addition

    for child in person.children:
        age = tax_year - child.birth_year
        age_key = str(age)
        child_points = Q(str(params.child_points_by_age.get(age_key, 0)))
        # אם מקבלת 2 נק' לילד בגיל 6-17 (אב: 1) — כל-זכות, בתוקף מ-2024
        if person.gender == "female" and 6 <= age <= 17:
            child_points += Q(1)
        if child.is_disabled:
            child_points += Q("0.5")
        points += child_points

    points += person.extra_credit_points

    annual_value = points * params.credit_point_value
    period_value = annual_value * Q(months_count) / TWELVE
    return points, period_value


# --------------------------------------------------------------------------- #
# National insurance (monthly brackets)                                        #
# --------------------------------------------------------------------------- #

def _apply_ni_monthly(
    monthly_income: Decimal,
    offset: Decimal,
    brackets: list[NIBracketParam],
    ceilings: NICeilingsParam,
    mode: str,  # "employee" | "self_employed"
) -> tuple[Decimal, Decimal]:
    """National-insurance + health on a MONTHLY income, where `offset` (monthly)
    has already been consumed by other income (used for the salary-first rule).

    Returns (ni_amount, health_amount) for one month.
    """
    capped = min(monthly_income + offset, ceilings.monthly_ceiling) - offset
    capped = max(ZERO, capped)
    if capped <= ZERO:
        return ZERO, ZERO

    ni = ZERO
    health = ZERO
    remaining = capped
    for b in sorted(brackets, key=lambda x: x.bracket_order):
        lower = max(b.income_from, offset)
        upper = b.income_to if b.income_to is not None else (offset + capped)
        if upper <= lower:
            continue
        # how much of `remaining` falls inside this bracket window
        window = upper - lower
        amount = min(remaining, window)
        if amount <= ZERO:
            continue
        rate = b.self_employed_rate_pct if mode == "self_employed" else b.employee_rate_pct
        ni += amount * rate / Q(100)
        health += amount * b.health_rate_pct / Q(100)
        remaining -= amount
        if remaining <= ZERO:
            break
    return ni, health


def calculate_ni_for_person(
    person: PersonInput, params: TaxParams, months_count: int
) -> dict:
    """National insurance + health for a single person, honoring the
    salary-first rule when the person is both employed and self-employed."""
    ceilings = params.ni_ceilings
    brackets = params.ni_brackets
    months = Q(months_count)

    salary_monthly = ZERO
    if person.is_employed and months > 0:
        salary_monthly = person.salary_gross_cumulative / months

    business_taxable = (
        person.business_revenue - person.business_cogs - person.business_expenses_allowed
    )
    business_monthly = ZERO
    if person.is_self_employed and months > 0:
        business_monthly = max(ZERO, business_taxable) / months

    # Salary occupies the low bracket first.
    salary_ni, salary_health = (ZERO, ZERO)
    if salary_monthly > ZERO:
        salary_ni, salary_health = _apply_ni_monthly(
            salary_monthly, ZERO, brackets, ceilings, "employee"
        )

    # Self-employed income starts where salary left off (offset).
    offset = min(salary_monthly, ceilings.monthly_ceiling)
    se_ni, se_health = (ZERO, ZERO)
    if business_monthly > ZERO:
        se_ni, se_health = _apply_ni_monthly(
            business_monthly, offset, brackets, ceilings, "self_employed"
        )

    # מקדמות העצמאי מכסות רק את חבות העצמאי. ב"ל השכר מנוכה ע"י המעסיק בנפרד,
    # ולכן אינו חלק מבדיקת מקדמות העצמאי. השכר עדיין "ממצה" את המדרגה הנמוכה (offset).
    se_total = se_ni * months
    se_health_total = se_health * months

    return {
        "ni_expected": _money(se_total),
        "health_expected": _money(se_health_total),
        "ni_total_expected": _money(se_total + se_health_total),
        "ni_self_employed_monthly": _money(se_ni + se_health),
        "ni_salary_monthly": _money(salary_ni + salary_health),
        "ni_salary_period": _money((salary_ni + salary_health) * months),
        "business_taxable_monthly": _money(business_monthly),
        "salary_monthly": _money(salary_monthly),
    }


# --------------------------------------------------------------------------- #
# Full per-person calculation                                                  #
# --------------------------------------------------------------------------- #

def calculate_person(
    person: PersonInput,
    params: TaxParams,
    months_count: int,
    income_tax_paid_override: Optional[Decimal] = None,
) -> dict:
    months = Q(months_count)

    # --- Income ---
    business_taxable = max(
        ZERO,
        person.business_revenue - person.business_cogs - person.business_expenses_allowed,
    )
    tax_adjustment = person.business_expenses_accounting - person.business_expenses_allowed
    salary_taxable = person.salary_gross_cumulative
    total_taxable_period = business_taxable + salary_taxable

    # --- Income tax (annualize → tax → scale back) ---
    projected_annual = total_taxable_period * TWELVE / months if months > 0 else ZERO
    tax_annual = apply_tax_brackets(projected_annual, params.tax_brackets)
    tax_period = tax_annual * months / TWELVE

    points, credit_value = calculate_credit_points(
        person, params.credit_points, params.tax_year, months_count
    )
    tax_after_credits = max(ZERO, tax_period - credit_value)

    # --- Tax paid ---
    # מקדמות מס הכנסה = מחזור ההכנסות × אחוז המקדמות (לתקופה).
    advance_from_pct = person.business_revenue * person.advance_income_tax_pct / Q(100)
    if income_tax_paid_override is not None:
        # מסלול בני זוג — הסכום חושב כבר ברמת התיק לפי המחזור המשותף.
        income_tax_paid = income_tax_paid_override
    else:
        income_tax_paid = (
            person.salary_income_tax_paid
            + person.advance_income_tax_amount
            + advance_from_pct
        )

    tax_gap = tax_after_credits - income_tax_paid
    coverage = (
        (income_tax_paid / tax_after_credits * Q(100)) if tax_after_credits > ZERO else Q(100)
    )
    # אחוז המקדמות הרצוי = (מס צפוי פחות ניכוי מס מהשכר) / מחזור ההכנסות.
    # המקדמות צריכות לכסות רק את יתרת המס שלא נוכתה במקור ע"י המעסיק.
    remaining_tax = max(ZERO, tax_after_credits - person.salary_income_tax_paid)
    recommended_pct = (
        (remaining_tax / person.business_revenue * Q(100))
        if person.business_revenue > ZERO else ZERO
    )

    # --- National insurance (self-employed advances only) ---
    ni = calculate_ni_for_person(person, params, months_count)
    ni_paid = person.advance_ni_monthly * months  # מקדמות העצמאי בלבד
    ni_gap = ni["ni_total_expected"] - ni_paid
    ni_monthly_recommended = ni["ni_total_expected"] / months if months > 0 else ZERO

    total_gap = tax_gap + ni_gap

    return {
        # income
        "business_revenue": float(_money(person.business_revenue)),
        "business_cogs": float(_money(person.business_cogs)),
        "business_expenses_accounting": float(_money(person.business_expenses_accounting)),
        "business_expenses_allowed": float(_money(person.business_expenses_allowed)),
        "tax_adjustment": float(_money(tax_adjustment)),
        "business_taxable_income": float(_money(business_taxable)),
        "salary_taxable_income": float(_money(salary_taxable)),
        "total_taxable_income": float(_money(total_taxable_period)),
        "projected_annual_income": float(_money(projected_annual)),
        # income tax
        "credit_points_total": float(points),
        "credit_points_value_ils": float(_money(credit_value)),
        "income_tax_annual": float(_money(tax_annual)),
        "income_tax_period": float(_money(tax_period)),
        "income_tax_after_credits": float(_money(tax_after_credits)),
        "income_tax_paid": float(_money(income_tax_paid)),
        "income_tax_advance_pct_used": float(_money(person.advance_income_tax_pct)),
        "income_tax_advance_from_pct": float(_money(advance_from_pct)),
        "income_tax_recommended_pct": float(_money(recommended_pct)),
        "income_tax_gap": float(_money(tax_gap)),
        "income_tax_coverage_pct": float(_money(coverage)),
        "tax_bracket_breakdown": tax_bracket_breakdown(projected_annual, params.tax_brackets),
        # national insurance
        "ni_expected": float(ni["ni_expected"]),
        "ni_health_expected": float(ni["health_expected"]),
        "ni_total_expected": float(ni["ni_total_expected"]),
        "ni_paid": float(_money(ni_paid)),
        "ni_gap": float(_money(ni_gap)),
        "ni_monthly_recommended": float(_money(ni_monthly_recommended)),
        "ni_monthly_actual": float(_money(person.advance_ni_monthly)),
        # summary
        "total_gap": float(_money(total_gap)),
    }


# --------------------------------------------------------------------------- #
# Score                                                                        #
# --------------------------------------------------------------------------- #

def score_color(expected: Decimal, paid: Decimal) -> tuple[str, float]:
    """Color by |gap| / expected. green 0–10%, yellow 10–20%, red >20%."""
    expected = Q(str(expected))
    paid = Q(str(paid))
    if expected <= ZERO:
        return "green", 0.0
    gap_pct = abs(expected - paid) / expected * Q(100)
    if gap_pct <= Q(10):
        color = "green"
    elif gap_pct <= Q(20):
        color = "yellow"
    else:
        color = "red"
    return color, float(_money(gap_pct))


# --------------------------------------------------------------------------- #
# Case-level orchestration                                                     #
# --------------------------------------------------------------------------- #

def calculate_case(case: CaseInput, params: TaxParams) -> dict:
    """Top-level entry. Handles single taxpayer and self-employed couples.

    For couples both self-employed: income tax AND national insurance are
    computed SEPARATELY per spouse. The only joint element is the income-tax
    advance, which is a single percentage of the combined business revenue.
    """
    months = case.months_count

    # Couple advance: one pct of combined revenue, split is informational.
    couple_paid_primary = None
    couple_paid_spouse = None
    if case.couple_advance_income_tax_pct is not None and case.spouse is not None:
        pct = case.couple_advance_income_tax_pct
        combined_revenue = case.primary.business_revenue + case.spouse.business_revenue
        total_advance = combined_revenue * pct / Q(100)
        # attribute proportionally to each spouse's revenue
        if combined_revenue > ZERO:
            couple_paid_primary = (
                total_advance * case.primary.business_revenue / combined_revenue
                + case.primary.salary_income_tax_paid
            )
            couple_paid_spouse = (
                total_advance * case.spouse.business_revenue / combined_revenue
                + case.spouse.salary_income_tax_paid
            )
        else:
            couple_paid_primary = case.primary.salary_income_tax_paid
            couple_paid_spouse = case.spouse.salary_income_tax_paid

    primary = calculate_person(case.primary, params, months, couple_paid_primary)
    primary_color, primary_gap_pct = score_color(
        Q(str(primary["income_tax_after_credits"])) + Q(str(primary["ni_total_expected"])),
        Q(str(primary["income_tax_paid"])) + Q(str(primary["ni_paid"])),
    )
    primary["score_color"] = primary_color
    primary["total_gap_pct"] = primary_gap_pct

    result = {
        "tax_year": case.tax_year,
        "months_count": months,
        "case_type": case.case_type,
        "primary": primary,
        "spouse": None,
        "combined": None,
    }

    if case.spouse is not None:
        spouse = calculate_person(case.spouse, params, months, couple_paid_spouse)
        spouse_color, spouse_gap_pct = score_color(
            Q(str(spouse["income_tax_after_credits"])) + Q(str(spouse["ni_total_expected"])),
            Q(str(spouse["income_tax_paid"])) + Q(str(spouse["ni_paid"])),
        )
        spouse["score_color"] = spouse_color
        spouse["total_gap_pct"] = spouse_gap_pct
        result["spouse"] = spouse

        # combined picture
        comb_expected = (
            Q(str(primary["income_tax_after_credits"])) + Q(str(primary["ni_total_expected"]))
            + Q(str(spouse["income_tax_after_credits"])) + Q(str(spouse["ni_total_expected"]))
        )
        comb_paid = (
            Q(str(primary["income_tax_paid"])) + Q(str(primary["ni_paid"]))
            + Q(str(spouse["income_tax_paid"])) + Q(str(spouse["ni_paid"]))
        )
        comb_color, comb_gap_pct = score_color(comb_expected, comb_paid)
        result["combined"] = {
            "combined_revenue": float(_money(
                Q(str(case.primary.business_revenue)) + Q(str(case.spouse.business_revenue))
            )),
            "income_tax_expected": float(_money(
                Q(str(primary["income_tax_after_credits"])) + Q(str(spouse["income_tax_after_credits"]))
            )),
            "income_tax_paid": float(_money(
                Q(str(primary["income_tax_paid"])) + Q(str(spouse["income_tax_paid"]))
            )),
            "ni_expected": float(_money(
                Q(str(primary["ni_total_expected"])) + Q(str(spouse["ni_total_expected"]))
            )),
            "ni_paid": float(_money(Q(str(primary["ni_paid"])) + Q(str(spouse["ni_paid"])))),
            "total_expected": float(_money(comb_expected)),
            "total_paid": float(_money(comb_paid)),
            "total_gap": float(_money(comb_expected - comb_paid)),
            "score_color": comb_color,
            "total_gap_pct": comb_gap_pct,
        }

    return result
