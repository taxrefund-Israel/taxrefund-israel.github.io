from decimal import Decimal

from app.engine.tax_engine import apply_tax_brackets, calculate_credit_points, calculate_person
from app.engine.schemas import PersonInput, ChildInfo

Q = Decimal


def test_brackets_first_bracket(params_2026):
    # 50,000 → entirely in 10% bracket
    tax = apply_tax_brackets(Q(50000), params_2026.tax_brackets)
    assert tax == Q(5000)


def test_brackets_second_bracket(params_2026):
    # 100,000: 84,120*10% + (100,000-84,120)*14%
    expected = Q(84120) * Q("0.10") + (Q(100000) - Q(84120)) * Q("0.14")
    tax = apply_tax_brackets(Q(100000), params_2026.tax_brackets)
    assert tax == expected


def test_brackets_zero_income(params_2026):
    assert apply_tax_brackets(Q(0), params_2026.tax_brackets) == Q(0)
    assert apply_tax_brackets(Q(-500), params_2026.tax_brackets) == Q(0)


def test_brackets_top_bracket(params_2026):
    # 700,000 reaches the 47% bracket
    tax = apply_tax_brackets(Q(700000), params_2026.tax_brackets)
    # sanity: above the 560,280 threshold tax
    base = apply_tax_brackets(Q(560280), params_2026.tax_brackets)
    assert tax == base + (Q(700000) - Q(560280)) * Q("0.47")


def test_credit_points_single_male(params_2026):
    p = PersonInput(gender="male", marital_status="single")
    points, value = calculate_credit_points(p, params_2026.credit_points, 2026, 12)
    assert points == Q("2.25")
    assert value == Q("2.25") * Q(2904)


def test_credit_points_female_addition(params_2026):
    p = PersonInput(gender="female", marital_status="single")
    points, _ = calculate_credit_points(p, params_2026.credit_points, 2026, 12)
    assert points == Q("2.75")  # 2.25 + 0.5


def test_mother_gets_2_points_for_child_6_to_17(params_2026):
    # אם: 2 נק' לילד בגיל 6-17 | אב: 1 נק' (כל-זכות 2026)
    child = [ChildInfo(birth_year=2018)]  # גיל 8 ב-2026
    mom = PersonInput(gender="female", children=child)
    dad = PersonInput(gender="male", children=child)
    mom_pts, _ = calculate_credit_points(mom, params_2026.credit_points, 2026, 12)
    dad_pts, _ = calculate_credit_points(dad, params_2026.credit_points, 2026, 12)
    assert mom_pts == Q("2.25") + Q("0.5") + Q("2")   # 4.75
    assert dad_pts == Q("2.25") + Q("1")               # 3.25


def test_credit_points_with_children(params_2026):
    # child born 2022 → age 4 in 2026 → 2.5 points
    p = PersonInput(gender="male", children=[ChildInfo(birth_year=2022)])
    points, _ = calculate_credit_points(p, params_2026.credit_points, 2026, 12)
    assert points == Q("2.25") + Q("2.5")


def test_credit_points_prorated_period(params_2026):
    p = PersonInput(gender="male")
    _, value_full = calculate_credit_points(p, params_2026.credit_points, 2026, 12)
    _, value_half = calculate_credit_points(p, params_2026.credit_points, 2026, 6)
    assert value_half == value_full / 2


def test_disabled_child_extra_point(params_2026):
    p = PersonInput(children=[ChildInfo(birth_year=2022, is_disabled=True)])
    points, _ = calculate_credit_points(p, params_2026.credit_points, 2026, 12)
    assert points == Q("2.25") + Q("2.5") + Q("0.5")


def test_person_self_employed_period_proration(params_2026):
    # 4 months, business taxable 100,000 for the period
    p = PersonInput(
        is_self_employed=True,
        business_revenue=Q(150000),
        business_cogs=Q(20000),
        business_expenses_allowed=Q(30000),
        business_expenses_accounting=Q(40000),
    )
    res = calculate_person(p, params_2026, months_count=4)
    assert res["business_taxable_income"] == 100000.0
    assert res["tax_adjustment"] == 10000.0  # 40k accounting - 30k allowed
    # projected annual = 100,000 * 12/4 = 300,000
    assert res["projected_annual_income"] == 300000.0


def test_coverage_pct_full(params_2026):
    p = PersonInput(
        is_self_employed=True,
        business_revenue=Q(100000),
        advance_income_tax_amount=Q(100000),  # overpaid
    )
    res = calculate_person(p, params_2026, months_count=12)
    assert res["income_tax_coverage_pct"] >= 100.0
