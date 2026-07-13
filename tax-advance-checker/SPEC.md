# מסמך אפיון מלא — בדיקת מקדמות מס וביטוח לאומי
**גרסה:** 1.1 — **מאושר לפיתוח**  
**תאריך:** 2026-05-31  
**שנת מס:** 2026

---

## תוכן עניינים

1. [PRD — מסמך דרישות מוצר](#1-prd)
2. [ארכיטקטורת המערכת](#2-architecture)
3. [ERD — דיאגרמת ישויות](#3-erd)
4. [Database Schema](#4-database-schema)
5. [Tax Engine Design](#5-tax-engine)
6. [ממשק משתמש — מפת מסכים](#6-ui-screens)
7. [פרמטרי מס 2026](#7-tax-params-2026)
8. [שאלות פתוחות לאישור](#8-open-questions)

---

## 1. PRD — מסמך דרישות מוצר

### 1.1 מטרת המערכת

מערכת Web פנימית למשרד רואי חשבון לבדיקת התאמת מקדמות מס הכנסה וביטוח לאומי  
ששולמו בפועל לעומת החבות הצפויה — לתקופת ביניים במהלך שנת המס.

### 1.2 משתמשים ותפקידים

| תפקיד | הרשאות |
|--------|---------|
| **Admin** | ניהול משתמשים, עדכון פרמטרי מס, צפייה בכל הבדיקות, מחיקה |
| **Employee** | יצירת בדיקות, עריכת בדיקות שלהם, צפייה בכל הבדיקות, ייצוא דוחות |

### 1.3 תהליכי ליבה

#### תהליך 1 — פתיחת תיק בדיקה
```
1. עובד פותח בדיקה חדשה
2. מזין פרטי נישום (זהות, שם, סטטוס, שנה, חודשים)
3. בוחר סוג נישום
4. מערכת יוצרת case_id ייחודי
```

#### תהליך 2 — ייבוא מאזן בוחן
```
1. העלאת Excel / PDF
2. מנוע OCR/Parser מזהה שורות
3. מיפוי אוטומטי לקטגוריות (הכנסות / עלות מכר / הוצאות)
4. עובד בודק ומתקן מיפוי
5. הגדרת אחוז ניכוי לכל שורה
6. שמירת גרסה
```

#### תהליך 3 — ייבוא תלוש שכר
```
1. העלאת PDF תלוש שכר
2. חילוץ שדות מצטברים (ברוטו, מ"ה, ב"ל, בריאות)
3. אישור/תיקון ידני
4. שמירה
```

#### תהליך 4 — חישוב ומסך תוצאות
```
1. מנוע חוקים מחשב מס הכנסה + ביטוח לאומי
2. השוואה למקדמות שהוזנו
3. הצגת פערים + ציון צבעוני
4. ייצוא דוח PDF / Excel
```

### 1.4 סוגי נישומים — לוגיקה

| סוג | תיאור | מה נדרש |
|-----|--------|---------|
| `SELF_EMPLOYED_ONLY` | עצמאי בלבד | מאזן בוחן |
| `EMPLOYED_ONLY` | שכיר בלבד | תלושי שכר |
| `SELF_EMPLOYED_AND_EMPLOYED` | עצמאי + שכיר | מאזן + תלושים |
| `COUPLE_BOTH_SELF_EMPLOYED` | שני בני זוג עצמאיים | מאזן לכל אחד, חישוב משותף |
| `SELF_EMPLOYED_SPOUSE_SELF_EMPLOYED` | עצמאי כאשר בן/בת זוג גם עצמאי | זהה לסוג קודם, מאפשר הפרדה |

> **הערה:** `COUPLE_BOTH_SELF_EMPLOYED` ו-`SELF_EMPLOYED_SPOUSE_SELF_EMPLOYED` ייוצגו  
> באותו מודל נתונים — ה-case יכיל primary_taxpayer + spouse_taxpayer.

---

## 2. ארכיטקטורת המערכת

```
┌─────────────────────────────────────────────────────┐
│                   NGINX (reverse proxy)              │
├──────────────────────┬──────────────────────────────┤
│   Frontend           │   Backend                    │
│   Next.js 14         │   FastAPI (Python 3.12)      │
│   TypeScript         │   Uvicorn / Gunicorn         │
│   Tailwind CSS       │   SQLAlchemy ORM             │
│   Port 3000          │   Port 8000                  │
└──────────────────────┴──────────────────────┬────────┘
                                              │
                    ┌─────────────────────────┴────────┐
                    │         PostgreSQL 16             │
                    │         Port 5432                 │
                    └──────────────────────────────────┘
                    ┌─────────────────────────────────┐
                    │         MinIO (S3-compatible)    │
                    │         קבצים מועלים             │
                    │         Port 9000                │
                    └─────────────────────────────────┘
```

### תקשורת

- Frontend ↔ Backend: REST API + JWT Bearer tokens
- קבצים: multipart/form-data → Backend → MinIO
- Auth: JWT access token (15 min) + refresh token (7 days) — stored in httpOnly cookies
- אין OAuth חיצוני — login עם email + password בלבד

---

## 3. ERD — דיאגרמת ישויות

```
USERS
  id (PK)
  email (UNIQUE)
  hashed_password
  full_name
  role: ENUM(admin, employee)
  is_active
  created_at
  last_login

CASES
  id (PK)
  created_by (FK → USERS)
  taxpayer_id_number (ת.ז)
  taxpayer_name
  tax_year
  months_count (1–12)
  months_list (JSON: [1,2,3,4])
  marital_status: ENUM(single, married, divorced, widowed)
  gender: ENUM(male, female)
  case_type: ENUM(self_employed_only, employed_only, ...)
  has_spouse: BOOLEAN
  status: ENUM(draft, in_progress, complete)
  created_at
  updated_at

CHILDREN
  id (PK)
  case_id (FK → CASES)
  birth_year
  is_disabled: BOOLEAN

SPOUSE_INFO
  id (PK)
  case_id (FK → CASES, UNIQUE)
  id_number
  name
  gender
  birth_year
  is_self_employed: BOOLEAN

TRIAL_BALANCE_IMPORTS
  id (PK)
  case_id (FK → CASES)
  taxpayer_type: ENUM(primary, spouse)
  file_path (MinIO key)
  original_filename
  uploaded_at
  uploaded_by (FK → USERS)
  version (INT — increments per case)

TRIAL_BALANCE_LINES
  id (PK)
  import_id (FK → TRIAL_BALANCE_IMPORTS)
  account_code
  account_name
  debit_amount (NUMERIC 15,2)
  credit_amount (NUMERIC 15,2)
  net_amount (NUMERIC 15,2)
  category: ENUM(revenue, cost_of_goods, expense, other)
  deduction_pct (NUMERIC 5,2)  -- 0–100
  notes
  is_manually_overridden: BOOLEAN

PAYSLIP_IMPORTS
  id (PK)
  case_id (FK → CASES)
  taxpayer_type: ENUM(primary, spouse)
  file_path (MinIO key)
  original_filename
  uploaded_at
  uploaded_by (FK → USERS)
  version (INT)

PAYSLIP_DATA
  id (PK)
  import_id (FK → PAYSLIP_IMPORTS)
  gross_cumulative (NUMERIC 15,2)
  income_tax_cumulative (NUMERIC 15,2)
  national_insurance_cumulative (NUMERIC 15,2)
  health_insurance_cumulative (NUMERIC 15,2)
  is_manual_entry: BOOLEAN

ADVANCE_PAYMENTS
  id (PK)
  case_id (FK → CASES)
  taxpayer_type: ENUM(primary, spouse)
  payment_type: ENUM(income_tax_pct, income_tax_amount, national_insurance_monthly)
  advance_pct (NUMERIC 5,2)   -- אם באחוז
  advance_amount (NUMERIC 15,2) -- אם בסכום חודשי ממוצע
  notes

CALCULATION_RESULTS
  id (PK)
  case_id (FK → CASES)
  calculated_at
  calculated_by (FK → USERS)
  version (INT)
  result_json (JSONB)  -- כל תוצאות החישוב
  is_current: BOOLEAN

CALCULATION_AUDIT
  id (PK)
  case_id (FK → CASES)
  user_id (FK → USERS)
  action: ENUM(created, updated_line, uploaded_file, calculated, exported)
  details (JSONB)
  timestamp

-- טבלאות פרמטרי מס (מנוהלות ע"י Admin) --

TAX_BRACKETS
  id (PK)
  tax_year
  bracket_order (INT)
  income_from (NUMERIC 15,2)
  income_to (NUMERIC 15,2)  -- NULL = אין תקרה
  rate_pct (NUMERIC 5,2)

CREDIT_POINTS
  id (PK)
  tax_year
  credit_point_value (NUMERIC 10,2)  -- שווי נקודת זיכוי שנתית
  basic_points_single (NUMERIC 4,2)
  basic_points_female_addition (NUMERIC 4,2)
  child_points_by_age (JSONB)
  -- לדוגמה: {"0-5": 2.5, "6-17": 2.0, "18+": 1.0}

NI_BRACKETS  -- ביטוח לאומי
  id (PK)
  tax_year
  bracket_order (INT)
  income_from (NUMERIC 15,2)
  income_to (NUMERIC 15,2)
  employee_rate_pct (NUMERIC 5,2)
  self_employed_rate_pct (NUMERIC 5,2)
  health_rate_pct (NUMERIC 5,2)

NI_CEILINGS
  id (PK)
  tax_year
  monthly_ceiling (NUMERIC 15,2)    -- תקרה חודשית
  annual_ceiling (NUMERIC 15,2)     -- תקרה שנתית
  minimum_income (NUMERIC 15,2)     -- הכנסה מינימלית לחיוב

REPORTS
  id (PK)
  case_id (FK → CASES)
  calculation_id (FK → CALCULATION_RESULTS)
  report_type: ENUM(pdf, excel)
  file_path (MinIO key)
  generated_at
  generated_by (FK → USERS)
```

---

## 4. Database Schema — SQL מלא

```sql
-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums
CREATE TYPE user_role AS ENUM ('admin', 'employee');
CREATE TYPE marital_status AS ENUM ('single', 'married', 'divorced', 'widowed');
CREATE TYPE gender AS ENUM ('male', 'female');
CREATE TYPE case_type AS ENUM (
  'self_employed_only',
  'employed_only',
  'self_employed_and_employed',
  'couple_both_self_employed',
  'self_employed_spouse_self_employed'
);
CREATE TYPE case_status AS ENUM ('draft', 'in_progress', 'complete');
CREATE TYPE taxpayer_type AS ENUM ('primary', 'spouse');
CREATE TYPE line_category AS ENUM ('revenue', 'cost_of_goods', 'expense', 'other');
CREATE TYPE payment_type AS ENUM (
  'income_tax_pct',
  'income_tax_amount',
  'national_insurance_monthly'
);
CREATE TYPE audit_action AS ENUM (
  'created', 'updated_line', 'uploaded_file',
  'calculated', 'exported', 'deleted'
);
CREATE TYPE report_type AS ENUM ('pdf', 'excel');

-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  hashed_password VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role user_role NOT NULL DEFAULT 'employee',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login TIMESTAMPTZ
);

-- Cases
CREATE TABLE cases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_by UUID NOT NULL REFERENCES users(id),
  taxpayer_id_number VARCHAR(20) NOT NULL,
  taxpayer_name VARCHAR(255) NOT NULL,
  taxpayer_birth_year SMALLINT,
  tax_year SMALLINT NOT NULL,
  months_count SMALLINT NOT NULL CHECK (months_count BETWEEN 1 AND 12),
  months_list JSONB NOT NULL,  -- [1,2,3,...,n]
  marital_status marital_status NOT NULL,
  gender gender NOT NULL,
  case_type case_type NOT NULL,
  has_spouse BOOLEAN NOT NULL DEFAULT false,
  status case_status NOT NULL DEFAULT 'draft',
  extra_credit_points NUMERIC(5,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Children
CREATE TABLE children (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  birth_year SMALLINT NOT NULL,
  is_disabled BOOLEAN NOT NULL DEFAULT false
);

-- Spouse
CREATE TABLE spouse_info (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID NOT NULL UNIQUE REFERENCES cases(id) ON DELETE CASCADE,
  id_number VARCHAR(20),
  name VARCHAR(255),
  gender gender,
  birth_year SMALLINT,
  is_self_employed BOOLEAN NOT NULL DEFAULT false,
  is_employed BOOLEAN NOT NULL DEFAULT false,
  extra_credit_points NUMERIC(5,2) NOT NULL DEFAULT 0
);

-- Trial Balance Imports
CREATE TABLE trial_balance_imports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  taxpayer_type taxpayer_type NOT NULL DEFAULT 'primary',
  file_path VARCHAR(500),         -- NULL = הזנה ידנית
  original_filename VARCHAR(255),  -- NULL = הזנה ידנית
  source VARCHAR(20) NOT NULL DEFAULT 'file',  -- 'file' | 'manual'
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  uploaded_by UUID NOT NULL REFERENCES users(id),
  version SMALLINT NOT NULL DEFAULT 1
);

-- Trial Balance Lines
CREATE TABLE trial_balance_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  import_id UUID NOT NULL REFERENCES trial_balance_imports(id) ON DELETE CASCADE,
  account_code VARCHAR(50),
  account_name VARCHAR(500) NOT NULL,
  debit_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  credit_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  net_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  category line_category NOT NULL DEFAULT 'other',
  deduction_pct NUMERIC(5,2) NOT NULL DEFAULT 100
    CHECK (deduction_pct BETWEEN 0 AND 100),
  notes TEXT,
  is_manually_overridden BOOLEAN NOT NULL DEFAULT false
);

-- Payslip Imports
CREATE TABLE payslip_imports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  taxpayer_type taxpayer_type NOT NULL DEFAULT 'primary',
  file_path VARCHAR(500),         -- NULL = הזנה ידנית
  original_filename VARCHAR(255),  -- NULL = הזנה ידנית
  source VARCHAR(20) NOT NULL DEFAULT 'file',  -- 'file' | 'manual'
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  uploaded_by UUID NOT NULL REFERENCES users(id),
  version SMALLINT NOT NULL DEFAULT 1
);

-- Payslip Data
CREATE TABLE payslip_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  import_id UUID NOT NULL UNIQUE REFERENCES payslip_imports(id) ON DELETE CASCADE,
  gross_cumulative NUMERIC(15,2) NOT NULL DEFAULT 0,
  income_tax_cumulative NUMERIC(15,2) NOT NULL DEFAULT 0,
  national_insurance_cumulative NUMERIC(15,2) NOT NULL DEFAULT 0,
  health_insurance_cumulative NUMERIC(15,2) NOT NULL DEFAULT 0,
  is_manual_entry BOOLEAN NOT NULL DEFAULT false
);

-- Advance Payments
CREATE TABLE advance_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  taxpayer_type taxpayer_type NOT NULL DEFAULT 'primary',
  payment_type payment_type NOT NULL,
  advance_pct NUMERIC(5,2),
  advance_amount NUMERIC(15,2),
  notes TEXT
);

-- Calculation Results
CREATE TABLE calculation_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  calculated_by UUID NOT NULL REFERENCES users(id),
  version SMALLINT NOT NULL DEFAULT 1,
  result_json JSONB NOT NULL,
  is_current BOOLEAN NOT NULL DEFAULT true
);

-- Audit Trail
CREATE TABLE calculation_audit (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  action audit_action NOT NULL,
  details JSONB,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tax Brackets (income tax)
CREATE TABLE tax_brackets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tax_year SMALLINT NOT NULL,
  bracket_order SMALLINT NOT NULL,
  income_from NUMERIC(15,2) NOT NULL,
  income_to NUMERIC(15,2),  -- NULL = אין תקרה
  rate_pct NUMERIC(5,2) NOT NULL,
  UNIQUE (tax_year, bracket_order)
);

-- Credit Points
CREATE TABLE credit_points (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tax_year SMALLINT NOT NULL UNIQUE,
  credit_point_value NUMERIC(10,2) NOT NULL,
  basic_points_single NUMERIC(4,2) NOT NULL,
  basic_points_married_addition NUMERIC(4,2) NOT NULL DEFAULT 0,
  basic_points_female_addition NUMERIC(4,2) NOT NULL DEFAULT 0.5,
  child_points_by_age JSONB NOT NULL
  -- {"0": 2.5, "1": 2.5, "2": 2.5, ..., "5": 2.5, "6": 2.0, ..., "17": 1.0}
);

-- National Insurance Brackets
CREATE TABLE ni_brackets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tax_year SMALLINT NOT NULL,
  bracket_order SMALLINT NOT NULL,
  income_from NUMERIC(15,2) NOT NULL,
  income_to NUMERIC(15,2),
  employee_rate_pct NUMERIC(5,2) NOT NULL,
  self_employed_rate_pct NUMERIC(5,2) NOT NULL,
  health_rate_pct NUMERIC(5,2) NOT NULL,
  UNIQUE (tax_year, bracket_order)
);

-- National Insurance Ceilings
CREATE TABLE ni_ceilings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tax_year SMALLINT NOT NULL UNIQUE,
  monthly_ceiling NUMERIC(15,2) NOT NULL,
  annual_ceiling NUMERIC(15,2) NOT NULL,
  minimum_income NUMERIC(15,2) NOT NULL
);

-- Reports
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  calculation_id UUID NOT NULL REFERENCES calculation_results(id),
  report_type report_type NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  generated_by UUID NOT NULL REFERENCES users(id)
);

-- Indexes
CREATE INDEX idx_cases_taxpayer_id ON cases(taxpayer_id_number);
CREATE INDEX idx_cases_tax_year ON cases(tax_year);
CREATE INDEX idx_cases_created_by ON cases(created_by);
CREATE INDEX idx_trial_balance_lines_import ON trial_balance_lines(import_id);
CREATE INDEX idx_audit_case ON calculation_audit(case_id);
CREATE INDEX idx_audit_timestamp ON calculation_audit(timestamp DESC);
CREATE INDEX idx_calc_results_case ON calculation_results(case_id, is_current);
```

---

## 5. Tax Engine Design

### 5.1 עקרונות עיצוב

- כל הפרמטרים נטענים מ-DB — אפס hardcode בקוד
- חישוב תמיד שנתי → חלוקה יחסית לתקופה (`months_count / 12`)
- מנוע מחזיר `CalculationResult` מפורט ל-JSON
- כל פונקציה עוברת Unit Test

### 5.2 מבנה ה-Rules Engine

```python
# engine/tax_engine.py

@dataclass
class TaxInput:
    tax_year: int
    months_count: int             # 1–12
    case_type: CaseType
    
    # נישום ראשי
    business_revenue: Decimal     # מחזור עסקי
    business_cogs: Decimal        # עלות מכר מותרת
    business_expenses: Decimal    # הוצאות מותרות (אחרי תיאום)
    salary_gross_cumulative: Decimal
    salary_income_tax_paid: Decimal
    salary_ni_paid: Decimal
    salary_health_paid: Decimal
    
    marital_status: MaritalStatus
    gender: Gender
    birth_year: int
    children: List[ChildInfo]     # [{"birth_year": 2020, "is_disabled": False}]
    extra_credit_points: Decimal
    
    # מקדמות
    advance_income_tax_pct: Optional[Decimal]
    advance_income_tax_amount: Optional[Decimal]  # סכום שולם בפועל
    advance_ni_monthly: Optional[Decimal]
    
    # בן/בת זוג (אם רלוונטי)
    spouse: Optional[SpouseTaxInput]

@dataclass
class CalculationResult:
    # הכנסות
    business_revenue: Decimal
    business_cogs: Decimal
    business_expenses_accounting: Decimal
    business_expenses_allowed: Decimal
    tax_adjustment: Decimal
    
    # הכנסה חייבת
    business_taxable_income: Decimal
    salary_taxable_income: Decimal
    total_taxable_income: Decimal
    
    # נקודות זיכוי
    credit_points_total: Decimal
    credit_points_value_ils: Decimal
    
    # מס הכנסה
    income_tax_gross: Decimal
    income_tax_after_credits: Decimal
    income_tax_period: Decimal       # יחסי לתקופה
    income_tax_paid: Decimal         # שולם בפועל (תלוש + מקדמות)
    income_tax_gap: Decimal
    income_tax_coverage_pct: Decimal
    
    # ביטוח לאומי
    ni_expected: Decimal
    ni_health_expected: Decimal
    ni_total_expected: Decimal
    ni_paid: Decimal
    ni_gap: Decimal
    ni_monthly_recommended: Decimal
    ni_monthly_actual: Decimal
    
    # סיכום
    total_gap: Decimal
    score_color: str                 # "green" / "yellow" / "red"
    
    # בן/בת זוג
    spouse_result: Optional[SpouseCalculationResult]
    
    # breakdown מלא לדוח
    tax_bracket_breakdown: List[dict]
    ni_bracket_breakdown: List[dict]
```

### 5.3 מס הכנסה — אלגוריתם

```
1. חישוב הכנסה חייבת מעסק:
   business_taxable = revenue - cogs - allowed_expenses
   allowed_expenses = Σ (line.net_amount × line.deduction_pct / 100)

2. הכנסה חייבת כוללת:
   total_taxable = business_taxable + salary_gross_cumulative
   
   *** חשוב: השכר המצטבר הוא לתקופה (ינואר–חודש X)
   *** העסק: ממאזן בוחן שהוא גם לתקופה

3. חישוב מס שנתי (על בסיס הכנסה שנתית חזויה):
   projected_annual = total_taxable × (12 / months_count)
   
   tax_annual = apply_brackets(projected_annual, tax_brackets)

4. חישוב לתקופה:
   tax_period = tax_annual × (months_count / 12)

5. נקודות זיכוי:
   points = basic_points + gender_addition + child_points + extra_points
   credit_value = points × credit_point_value × (months_count / 12)

6. מס אחרי זיכויים:
   tax_after_credits = max(0, tax_period - credit_value)

7. מס ששולם בפועל:
   tax_paid = salary_income_tax_paid + advance_income_tax_paid
   (advance_income_tax_paid = pct × business_revenue or direct amount)

8. פער:
   gap = tax_after_credits - tax_paid
   coverage_pct = tax_paid / tax_after_credits × 100
```

### 5.4 ביטוח לאומי — אלגוריתם (מורכב)

```
מקרה א': עצמאי בלבד
─────────────────────
  ni_base = business_taxable_income (לתקופה)
  ni = apply_ni_brackets(ni_base, "self_employed", ni_ceilings)

מקרה ב': שכיר בלבד
────────────────────
  ni_paid = salary_ni_paid + salary_health_paid (מהתלוש)
  ni_expected = apply_ni_brackets(salary_gross, "employee", ni_ceilings)

מקרה ג': עצמאי + שכיר (הכי מורכב!)
─────────────────────────────────────
  שלב 1: הכנסת השכר ממצה קודם את המדרגה הנמוכה
  
  ceiling_annual = ni_ceilings.annual_ceiling × (months_count / 12)
  
  # מה שהשכר "כיסה" במדרגה הנמוכה
  salary_ni_base = min(salary_gross, ceiling_annual)
  salary_ni_calc = apply_ni_brackets(salary_ni_base, "employee", ceilings)
  
  # העצמאי מתחיל חישוב מאיפה שהשכר עצר
  remaining_ceiling = max(0, ceiling_annual - salary_ni_base)
  self_employed_ni_base = min(business_taxable, remaining_ceiling)
  self_employed_ni = apply_ni_brackets_offset(
    self_employed_ni_base,
    offset=salary_ni_base,  # המדרגה כבר נוצלה חלקית
    rates="self_employed"
  )
  
  ni_total_expected = salary_ni_calc + self_employed_ni

מקרה ד': בני זוג שניהם עצמאיים
──────────────────────────────────
  חישוב נפרד לכל אחד:
    primary_ni = apply_ni_brackets(primary_business_taxable, "self_employed")
    spouse_ni = apply_ni_brackets(spouse_business_taxable, "self_employed")
  
  אין שיתוף בתקרות בין בני הזוג (כל אחד לפי הכנסתו)
  
  תצוגה: נפרדת + מצטברת יחד

### apply_ni_brackets_offset(income, offset, rates):
  # מחשב ב"ל על income, כאשר offset כבר "נוצל" במדרגות
  remaining = income
  ni = 0
  for bracket in sorted_brackets:
    bracket_start = max(bracket.income_from, offset)
    bracket_end = bracket.income_to or infinity
    if bracket_start >= bracket_end: continue
    applicable = min(remaining, bracket_end - bracket_start)
    if applicable <= 0: continue
    rate = bracket.self_employed_rate_pct if rates == "self_employed" 
           else bracket.employee_rate_pct
    ni += applicable × rate / 100
    remaining -= applicable
    if remaining <= 0: break
  return ni
```

### 5.5 נקודות זיכוי — חישוב

```python
def calculate_credit_points(
  gender, marital_status, children, extra_points,
  credit_point_params, tax_year, months_count
):
  points = credit_point_params.basic_points_single  # 2.25 (2026)
  
  if gender == "female":
    points += credit_point_params.basic_points_female_addition  # 0.5
  
  if marital_status == "married":
    points += credit_point_params.basic_points_married_addition  # 0
    # (הנחה: הנקודה בגין פרנסת בן זוג מוזנת כנקודות ידניות אם רלוונטי)
  
  current_year = tax_year
  for child in children:
    age = current_year - child.birth_year
    # נקודות זיכוי לפי גיל (מ-child_points_by_age JSON)
    age_key = str(age)
    child_points = credit_point_params.child_points_by_age.get(age_key, 0)
    if child.is_disabled:
      child_points += 0.5  # תוספת לנכה
    points += child_points
  
  points += extra_points
  
  annual_value = points × credit_point_params.credit_point_value
  period_value = annual_value × (months_count / 12)
  return points, period_value
```

### 5.6 חישוב מקדמות מס הכנסה

```
אם advance_income_tax_pct מוזן:
  advance_paid = business_revenue × advance_pct / 100

אם advance_income_tax_amount מוזן:
  advance_paid = advance_income_tax_amount (סך שולם)

advance_paid_total = advance_paid + salary_income_tax_paid

gap = tax_after_credits - advance_paid_total
gap_pct = (gap / tax_after_credits) × 100

recommended_advance_pct = (tax_after_credits / business_revenue) × 100
```

---

## 6. ממשק משתמש — מפת מסכים

```
/ (login)
  ↓
/dashboard
  ├── /cases
  │     ├── /cases/new                  פתיחת תיק
  │     ├── /cases/[id]                 תצוגת תיק
  │     │     ├── /basic-info           פרטי נישום
  │     │     ├── /trial-balance        מאזן בוחן
  │     │     ├── /payslips             תלושי שכר
  │     │     ├── /advance-payments     מקדמות
  │     │     ├── /results              תוצאות + פערים
  │     │     └── /reports              ייצוא דוחות
  │     └── /cases/[id]/history         גרסאות קודמות
  │
  └── /admin (admin only)
        ├── /admin/users                ניהול משתמשים
        ├── /admin/tax-params           פרמטרי מס לפי שנה
        └── /admin/audit-log            לוג פעולות
```

### מסך תוצאות — מבנה

```
┌─────────────────────────────────────────────────────────┐
│  סיכום עסקי                                             │
│  מחזור: 500,000 ₪  |  עלות מכר: 100,000 ₪              │
│  הוצ' חשבונאיות: 200,000 ₪  |  תיאום: 40,000 ₪         │
│  הכנסה חייבת מעסק: 240,000 ₪                            │
├─────────────────────────────────────────────────────────┤
│  מס הכנסה                                              │
│  הכנסה חייבת כוללת: 320,000 ₪                          │
│  מס לתקופה: 68,000 ₪  |  זיכויים: 8,500 ₪              │
│  מס צפוי: 59,500 ₪                                      │
│  מס ששולם: 48,000 ₪                                     │
│  פער: 11,500 ₪  ███████████░░░░  [צהוב 19.3%]           │
├─────────────────────────────────────────────────────────┤
│  ביטוח לאומי + בריאות                                  │
│  חבות שנתית צפויה: 24,000 ₪                            │
│  שולם: 20,000 ₪                                         │
│  פער: 4,000 ₪  מקדמה מומלצת: 2,000 ₪/חודש              │
├─────────────────────────────────────────────────────────┤
│  [ייצא PDF]  [ייצא Excel]  [חשב מחדש]                  │
└─────────────────────────────────────────────────────────┘
```

---

## 7. פרמטרי מס 2026 (Seed Data)

### מדרגות מס הכנסה 2026 ✓ מאומת (כל-זכות)

| מדרגה | הכנסה שנתית | שיעור |
|--------|------------|-------|
| 1 | עד 84,120 ₪ | 10% |
| 2 | 84,121 – 120,720 ₪ | 14% |
| 3 | 120,721 – 228,000 ₪ | 20% |
| 4 | 228,001 – 301,200 ₪ | 31% |
| 5 | 301,201 – 560,280 ₪ | 35% |
| 6 | 560,281 – 721,560 ₪ | 47% |
| 7 | מעל 721,560 ₪ | 50% (47% + 3% מס יסף) |

> מדרגות 2026 לאחר הרחבה, מוקפאות לשנים 2026–2027.

### נקודות זיכוי 2026

| פרמטר | ערך |
|--------|-----|
| שווי נקודת זיכוי שנתית | 2,904 ₪ |
| נקודות בסיס (רווק/ה) | 2.25 |
| תוספת לאישה | 0.5 |
| ילד 0–5 | 2.5 נקודות |
| ילד 6–12 | 2.0 נקודות |
| ילד 13–17 | 1.0 נקודות |
| ילד 18 | 1.0 נקודות (שנת סיום) |

> **הערה:** יש לאשר עם רו"ח — נקודות ילדים משתנות לפי חוק ועשויות להיות שונות לגברים/נשים

### ביטוח לאומי + בריאות 2026 ✓ מאומת (btl.gov.il)

חלק העובד/עצמאי בלבד (ללא חלק המעסיק):

| מדרגה | הכנסה חודשית | ב"ל שכיר | ב"ל עצמאי | בריאות |
|--------|-------------|----------|-----------|--------|
| נמוכה | עד 7,703 ₪ | 1.04% | 4.47% | 3.23% |
| גבוהה | 7,703 – 51,910 ₪ | 7.0% | 12.83% | 5.17% |

| פרמטר | ערך |
|--------|-----|
| תקרה חודשית | 51,910 ₪ |
| תקרה שנתית | 622,920 ₪ |
| הכנסה מזערית (עצמאי) | 3,442 ₪/חודש |

> מדרגת ביניים 7,703 ₪ = 60% מהשכר הממוצע. דמי הבריאות זהים לשכיר ולעצמאי.

---

## 8. החלטות עיצוב — מאושרות

| # | נושא | החלטה |
|---|------|--------|
| 1 | ב"ל בני זוג עצמאיים | **חישוב נפרד** — כל אחד לפי הכנסתו |
| 2 | מקדמות מ"ה בני זוג | **אחוז אחד** מהמחזור המשותף (ראשי + בן/בת זוג) |
| 3 | נקודות זיכוי ילדים | לפי נתוני 2026, **יחסי לתקופה** |
| 4 | מאזן בוחן | **לתקופה הנבדקת בלבד** (ינואר–חודש X) |
| 5 | Parser/OCR | **pdfplumber פשוט** — אין דרישת OCR מתקדם |
| 6 | תלושי שכר | **סכומים מצטברים בלבד** (לא חודש-חודש) |
| 7 | מקדמות ב"ל | **סכום חודשי קבוע** לכל התקופה |
| 8 | שכר לבן/בת זוג | **לא נתמך** — אין מקרה מיוחד |
| 9 | זיכויים מיוחדים | **לא** — רק נקודות זיכוי ידניות |
| 10 | אימות | **email + password בלבד** — ללא 2FA |
| 11 | קלט נתונים | **הזנה ידנית מלאה** כחלופה לטעינת קבצים — בכל מסך |

### 8.1 הזנה ידנית — דרישה רוחבית

כל הנתונים ניתנים להזנה ידנית ישירה, ללא חובת העלאת קובץ:

- **מאזן בוחן** — הוספת שורות ידנית (קוד, שם חשבון, סכום, קטגוריה, % ניכוי).  
  טבלה עריכה (CRUD) — אפשר גם לטעון קובץ, גם להוסיף/לערוך/למחוק שורות ידנית.
- **תלושי שכר** — `is_manual_entry = true` כבר קיים ב-`payslip_data`.  
  טופס ידני: ברוטו מצטבר, מ"ה מצטבר, ב"ל מצטבר, בריאות מצטבר.
- **מקדמות** — תמיד ידני (אחוז או סכום).

> מבחינת מודל הנתונים: import עם `original_filename = NULL` ו-`file_path = NULL` מסמן  
> מקור ידני. אין צורך בשינוי סכמה — רק הפיכת השדות ל-nullable.

---

## סיכום טכנולוגי

| שכבה | טכנולוגיה | גרסה |
|------|-----------|-------|
| Frontend | Next.js + TypeScript + Tailwind | Next.js 14 |
| Backend | Python FastAPI | 0.115+ |
| ORM | SQLAlchemy | 2.0 |
| DB | PostgreSQL | 16 |
| Auth | JWT (python-jose) + bcrypt | — |
| Storage | MinIO | latest |
| PDF | ReportLab | — |
| Excel | openpyxl | — |
| PDF Parse | pdfplumber | — |
| Excel Parse | pandas + openpyxl | — |
| Containers | Docker + Docker Compose | — |
| Tests | pytest | — |

---

*מסמך זה מחכה לאישורך לפני תחילת פיתוח*
