from enum import Enum


class UserRole(str, Enum):
    admin = "admin"
    employee = "employee"


class MaritalStatus(str, Enum):
    single = "single"
    married = "married"
    divorced = "divorced"
    widowed = "widowed"


class Gender(str, Enum):
    male = "male"
    female = "female"


class CaseType(str, Enum):
    self_employed_only = "self_employed_only"
    employed_only = "employed_only"
    self_employed_and_employed = "self_employed_and_employed"
    couple_both_self_employed = "couple_both_self_employed"
    self_employed_spouse_self_employed = "self_employed_spouse_self_employed"


class CaseStatus(str, Enum):
    draft = "draft"
    in_progress = "in_progress"
    complete = "complete"


class TaxpayerType(str, Enum):
    primary = "primary"
    spouse = "spouse"


class LineCategory(str, Enum):
    revenue = "revenue"
    cost_of_goods = "cost_of_goods"
    expense = "expense"
    other = "other"


class PaymentType(str, Enum):
    income_tax_pct = "income_tax_pct"
    income_tax_amount = "income_tax_amount"
    national_insurance_monthly = "national_insurance_monthly"


class AuditAction(str, Enum):
    created = "created"
    updated_line = "updated_line"
    uploaded_file = "uploaded_file"
    calculated = "calculated"
    exported = "exported"
    deleted = "deleted"


class ReportType(str, Enum):
    pdf = "pdf"
    excel = "excel"
