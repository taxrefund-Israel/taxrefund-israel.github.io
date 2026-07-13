from decimal import Decimal

from app.engine.tax_engine import calculate_ni_for_person, _apply_ni_monthly
from app.engine.schemas import PersonInput

Q = Decimal

# Verified 2026 figures (btl.gov.il):
#   threshold 7,703 | ceiling 51,910
#   self-employed NI: 4.47% low / 12.83% high
#   health:           3.23% low / 5.17% high
#   employee NI:      1.04% low / 7.00% high


def test_ni_self_employed_low_bracket(params_2026):
    # monthly business income 5,000 (below 7,703) → all in low self bracket
    p = PersonInput(is_self_employed=True, business_revenue=Q(60000))  # 5,000/mo over 12
    res = calculate_ni_for_person(p, params_2026, 12)
    expected_monthly_ni = Q(5000) * Q("4.47") / Q(100)
    expected_monthly_health = Q(5000) * Q("3.23") / Q(100)
    assert res["ni_expected"] == (expected_monthly_ni * 12).quantize(Q("0.01"))
    assert res["health_expected"] == (expected_monthly_health * 12).quantize(Q("0.01"))


def test_ni_self_employed_crosses_brackets(params_2026):
    # monthly 10,000: 7,703 @ low + 2,297 @ high
    p = PersonInput(is_self_employed=True, business_revenue=Q(120000))  # 10,000/mo
    res = calculate_ni_for_person(p, params_2026, 12)
    low = Q(7703) * Q("4.47") / Q(100)
    high = (Q(10000) - Q(7703)) * Q("12.83") / Q(100)
    expected = (low + high) * 12
    assert res["ni_expected"] == expected.quantize(Q("0.01"))


def test_ni_salary_first_rule(params_2026):
    # Salary 6,000/mo consumes part of low bracket; self-employed 4,000/mo
    # starts at offset 6,000 → self: 1,703 @ low then 2,297 @ high.
    p = PersonInput(
        is_employed=True,
        is_self_employed=True,
        salary_gross_cumulative=Q(72000),   # 6,000/mo
        business_revenue=Q(48000),           # 4,000/mo
    )
    res = calculate_ni_for_person(p, params_2026, 12)
    se_low = (Q(7703) - Q(6000)) * Q("4.47") / Q(100)       # 1,703 in low
    se_high = (Q(10000) - Q(7703)) * Q("12.83") / Q(100)    # remainder in high
    se_health_low = (Q(7703) - Q(6000)) * Q("3.23") / Q(100)
    se_health_high = (Q(10000) - Q(7703)) * Q("5.17") / Q(100)
    se_monthly = se_low + se_high + se_health_low + se_health_high
    assert res["ni_self_employed_monthly"] == se_monthly.quantize(Q("0.01"))


def test_ni_monthly_ceiling(params_2026):
    # very high monthly income capped at 51,910
    p = PersonInput(is_self_employed=True, business_revenue=Q(1200000))  # 100,000/mo
    res = calculate_ni_for_person(p, params_2026, 12)
    low = Q(7703) * Q("4.47") / Q(100)
    high = (Q(51910) - Q(7703)) * Q("12.83") / Q(100)
    expected = (low + high) * 12
    assert res["ni_expected"] == expected.quantize(Q("0.01"))


def test_ni_offset_helper_no_double_charge(params_2026):
    # offset already at ceiling → nothing charged
    ni, health = _apply_ni_monthly(
        Q(5000), Q(51910), params_2026.ni_brackets, params_2026.ni_ceilings, "self_employed"
    )
    assert ni == Q(0)
    assert health == Q(0)


def test_ni_zero_income(params_2026):
    p = PersonInput(is_self_employed=True, business_revenue=Q(0))
    res = calculate_ni_for_person(p, params_2026, 12)
    assert res["ni_total_expected"] == Q(0)
