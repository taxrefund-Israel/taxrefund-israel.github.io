"""Seed reference data (tax parameters 2026) and the initial admin user.

Idempotent: safe to run on every container start.
"""
from decimal import Decimal

from app.database import SessionLocal
from app.config import settings
from app.security import hash_password
import app.models as m
import app.enums as e

TAX_YEAR = 2026


# נקודות זיכוי ילדים 2026 — לפי גיל הילד (key = גיל בשנים)
# מבוסס על מדרגות זיכוי ילדים נהוגות; ניתן לעדכון מלא דרך מסך ה-Admin.
CHILD_POINTS_BY_AGE = {
    "0": 2.5, "1": 4.5, "2": 4.5, "3": 3.5, "4": 2.5, "5": 2.5,
    "6": 1.0, "7": 1.0, "8": 1.0, "9": 1.0, "10": 1.0, "11": 1.0,
    "12": 1.0, "13": 1.0, "14": 1.0, "15": 1.0, "16": 1.0, "17": 1.0,
    "18": 1.0,
}

# מדרגות מס הכנסה 2026 (שנתי) — order, from, to, rate%
# מקור: כל-זכות (מדרגות 2026 לאחר הרחבה, מוקפאות 2026–2027).
# המדרגה העליונה 50% = 47% + 3% מס יסף מעל 721,560 ₪.
TAX_BRACKETS = [
    (1, 0, 84120, 10),
    (2, 84120, 120720, 14),
    (3, 120720, 228000, 20),
    (4, 228000, 301200, 31),
    (5, 301200, 560280, 35),
    (6, 560280, 721560, 47),
    (7, 721560, None, 50),
]

# מדרגות ביטוח לאומי + בריאות 2026 (חודשי) — order, from, to, emp%, self%, health%
# מקור: ביטוח לאומי (btl.gov.il) — חלק העובד / עצמאי.
# מדרגה נמוכה: עד 7,703 ₪ (60% מהשכר הממוצע) | תקרה: 51,910 ₪.
# שכיר (חלק העובד):   ב"ל 1.04% / 7.0%   |  בריאות 3.23% / 5.17%
# עצמאי:               ב"ל 4.47% / 12.83% |  בריאות 3.23% / 5.17%
NI_BRACKETS = [
    (1, 0, 7703, 1.04, 4.47, 3.23),
    (2, 7703, 51910, 7.00, 12.83, 5.17),
]

NI_CEILINGS = {
    "monthly_ceiling": Decimal("51910"),
    "annual_ceiling": Decimal("622920"),   # 51,910 × 12
    "minimum_income": Decimal("3442"),     # הכנסה מזערית לעצמאי (חודשי)
}


def seed():
    db = SessionLocal()
    try:
        # --- Admin user ---
        existing = db.query(m.User).filter(m.User.email == settings.seed_admin_email).first()
        if not existing:
            db.add(m.User(
                email=settings.seed_admin_email,
                hashed_password=hash_password(settings.seed_admin_password),
                full_name=settings.seed_admin_name,
                role=e.UserRole.admin,
                is_active=True,
            ))

        # --- Tax brackets ---
        if not db.query(m.TaxBracket).filter(m.TaxBracket.tax_year == TAX_YEAR).first():
            for order, frm, to, rate in TAX_BRACKETS:
                db.add(m.TaxBracket(
                    tax_year=TAX_YEAR, bracket_order=order,
                    income_from=Decimal(str(frm)),
                    income_to=Decimal(str(to)) if to is not None else None,
                    rate_pct=Decimal(str(rate)),
                ))

        # --- Credit points ---
        if not db.query(m.CreditPoints).filter(m.CreditPoints.tax_year == TAX_YEAR).first():
            db.add(m.CreditPoints(
                tax_year=TAX_YEAR,
                credit_point_value=Decimal("2904"),
                basic_points_single=Decimal("2.25"),
                basic_points_married_addition=Decimal("0"),
                basic_points_female_addition=Decimal("0.5"),
                child_points_by_age=CHILD_POINTS_BY_AGE,
            ))

        # --- NI brackets ---
        if not db.query(m.NIBracket).filter(m.NIBracket.tax_year == TAX_YEAR).first():
            for order, frm, to, emp, slf, health in NI_BRACKETS:
                db.add(m.NIBracket(
                    tax_year=TAX_YEAR, bracket_order=order,
                    income_from=Decimal(str(frm)),
                    income_to=Decimal(str(to)) if to is not None else None,
                    employee_rate_pct=Decimal(str(emp)),
                    self_employed_rate_pct=Decimal(str(slf)),
                    health_rate_pct=Decimal(str(health)),
                ))

        # --- NI ceilings ---
        if not db.query(m.NICeilings).filter(m.NICeilings.tax_year == TAX_YEAR).first():
            db.add(m.NICeilings(tax_year=TAX_YEAR, **NI_CEILINGS))

        db.commit()
        print("[OK] Seed complete (tax year 2026 + admin user)")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
