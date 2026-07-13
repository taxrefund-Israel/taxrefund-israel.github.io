from decimal import Decimal

from app.engine.tax_engine import calculate_case, score_color
from app.engine.schemas import CaseInput, PersonInput

Q = Decimal


def test_score_color_thresholds():
    assert score_color(Q(100), Q(95))[0] == "green"    # 5%
    assert score_color(Q(100), Q(85))[0] == "yellow"   # 15%
    assert score_color(Q(100), Q(70))[0] == "red"      # 30%
    assert score_color(Q(0), Q(0))[0] == "green"


def test_single_self_employed_case(params_2026):
    case = CaseInput(
        tax_year=2026,
        months_count=6,
        case_type="self_employed_only",
        primary=PersonInput(
            is_self_employed=True,
            business_revenue=Q(300000),
            business_cogs=Q(50000),
            business_expenses_allowed=Q(50000),
            advance_income_tax_amount=Q(30000),
            advance_ni_monthly=Q(2000),
        ),
    )
    res = calculate_case(case, params_2026)
    assert res["primary"]["business_taxable_income"] == 200000.0
    assert res["spouse"] is None
    assert "score_color" in res["primary"]


def test_couple_both_self_employed_separate(params_2026):
    case = CaseInput(
        tax_year=2026,
        months_count=12,
        case_type="couple_both_self_employed",
        primary=PersonInput(is_self_employed=True, business_revenue=Q(200000),
                            business_expenses_allowed=Q(50000)),
        spouse=PersonInput(is_self_employed=True, business_revenue=Q(150000),
                           business_expenses_allowed=Q(30000)),
        couple_advance_income_tax_pct=Q(10),
    )
    res = calculate_case(case, params_2026)
    assert res["spouse"] is not None
    assert res["combined"] is not None
    # combined revenue
    assert res["combined"]["combined_revenue"] == 350000.0
    # couple advance = 10% of 350,000 = 35,000 split by revenue
    # primary gets 35,000 * 200/350 = 20,000
    assert res["primary"]["income_tax_paid"] == 20000.0
    assert res["spouse"]["income_tax_paid"] == 15000.0


def test_couple_ni_calculated_separately(params_2026):
    # Each spouse's NI depends only on their own income (no shared ceiling)
    case = CaseInput(
        tax_year=2026, months_count=12, case_type="couple_both_self_employed",
        primary=PersonInput(is_self_employed=True, business_revenue=Q(120000)),
        spouse=PersonInput(is_self_employed=True, business_revenue=Q(120000)),
    )
    res = calculate_case(case, params_2026)
    # identical incomes → identical NI
    assert res["primary"]["ni_total_expected"] == res["spouse"]["ni_total_expected"]


def test_single_advance_pct_converted_to_amount(params_2026):
    # נישום יחיד עם אחוז מקדמות — צריך להתבטא כסכום ששולם
    case = CaseInput(
        tax_year=2026, months_count=6, case_type="self_employed_only",
        primary=PersonInput(
            is_self_employed=True,
            business_revenue=Q(300000),
            business_expenses_allowed=Q(100000),
            advance_income_tax_pct=Q(10),   # 10% מ-300,000 = 30,000
        ),
    )
    res = calculate_case(case, params_2026)
    p = res["primary"]
    assert p["income_tax_advance_from_pct"] == 30000.0
    assert p["income_tax_paid"] == 30000.0
    # אחוז מומלץ = מס צפוי / מחזור × 100
    expected_pct = round(p["income_tax_after_credits"] / 300000 * 100, 2)
    assert abs(p["income_tax_recommended_pct"] - expected_pct) < 0.05


def test_self_employed_and_employed_real_case(params_2026):
    # מקרה אמת (אביעד קלימי): גבר נשוי, 4 ילדים (2013,2017,2023,2023), 4 חודשים.
    # עסק 30,663 חייב, שכר 64,000. צפוי: 11.25 נק' זיכוי, מס ~6,560, ב"ל עצמאי ~5,519.
    from app.engine.schemas import ChildInfo
    case = CaseInput(
        tax_year=2026, months_count=4, case_type="self_employed_and_employed",
        primary=PersonInput(
            is_self_employed=True, is_employed=True,
            business_revenue=Q("34007"),
            business_expenses_allowed=Q("34007") - Q("30663"),  # → עסק חייב 30,663
            salary_gross_cumulative=Q(64000),
            salary_income_tax_paid=Q(0),
            advance_ni_monthly=Q(462),
            gender="male", marital_status="married",
            children=[ChildInfo(2013), ChildInfo(2017), ChildInfo(2023), ChildInfo(2023)],
        ),
    )
    p = calculate_case(case, params_2026)["primary"]
    assert p["credit_points_total"] == 11.25
    assert abs(p["income_tax_after_credits"] - 6560) < 5
    assert abs(p["ni_total_expected"] - 5519) < 5          # עצמאי בלבד (לא כולל ב"ל שכר)
    assert abs(p["ni_monthly_recommended"] - 1380) < 5


def test_employed_only_case(params_2026):
    case = CaseInput(
        tax_year=2026, months_count=4, case_type="employed_only",
        primary=PersonInput(
            is_employed=True,
            salary_gross_cumulative=Q(40000),
            salary_income_tax_paid=Q(3000),
            salary_ni_paid=Q(1500),
            salary_health_paid=Q(1000),
        ),
    )
    res = calculate_case(case, params_2026)
    assert res["primary"]["salary_taxable_income"] == 40000.0
    assert res["primary"]["income_tax_paid"] == 3000.0
