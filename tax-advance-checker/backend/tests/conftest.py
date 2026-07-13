from decimal import Decimal

import pytest

from app.engine.schemas import (
    TaxParams, TaxBracketParam, NIBracketParam, NICeilingsParam, CreditPointsParam,
)

Q = Decimal


@pytest.fixture
def params_2026() -> TaxParams:
    tax_brackets = [
        TaxBracketParam(1, Q(0), Q(84120), Q(10)),
        TaxBracketParam(2, Q(84120), Q(120720), Q(14)),
        TaxBracketParam(3, Q(120720), Q(228000), Q(20)),
        TaxBracketParam(4, Q(228000), Q(301200), Q(31)),
        TaxBracketParam(5, Q(301200), Q(560280), Q(35)),
        TaxBracketParam(6, Q(560280), Q(721560), Q(47)),
        TaxBracketParam(7, Q(721560), None, Q(50)),
    ]
    ni_brackets = [
        NIBracketParam(1, Q(0), Q(7703), Q("1.04"), Q("4.47"), Q("3.23")),
        NIBracketParam(2, Q(7703), Q(51910), Q("7.00"), Q("12.83"), Q("5.17")),
    ]
    ceilings = NICeilingsParam(Q(51910), Q(622920), Q(3442))
    credit = CreditPointsParam(
        credit_point_value=Q(2904),
        basic_points_single=Q("2.25"),
        basic_points_married_addition=Q(0),
        basic_points_female_addition=Q("0.5"),
        child_points_by_age={
            "0": 2.5, "1": 4.5, "2": 4.5, "3": 3.5, "4": 2.5, "5": 2.5,
            "6": 1.0, "7": 1.0, "8": 1.0, "9": 1.0, "10": 1.0, "11": 1.0,
            "12": 1.0, "13": 1.0, "14": 1.0, "15": 1.0, "16": 1.0, "17": 1.0,
        },
    )
    return TaxParams(2026, tax_brackets, ni_brackets, ceilings, credit)
