export type Role = "admin" | "employee";
export type MaritalStatus = "single" | "married" | "divorced" | "widowed";
export type Gender = "male" | "female";
export type CaseType =
  | "self_employed_only"
  | "employed_only"
  | "self_employed_and_employed"
  | "couple_both_self_employed"
  | "self_employed_spouse_self_employed";
export type CaseStatus = "draft" | "in_progress" | "complete";
export type TaxpayerType = "primary" | "spouse";
export type LineCategory = "revenue" | "cost_of_goods" | "expense" | "other";
export type PaymentType = "income_tax_pct" | "income_tax_amount" | "national_insurance_monthly";

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  is_active: boolean;
}

export interface Child { id?: string; birth_year: number; is_disabled: boolean; }

export interface Spouse {
  id?: string;
  id_number?: string;
  name?: string;
  gender?: Gender;
  birth_year?: number;
  is_self_employed: boolean;
  is_employed: boolean;
  extra_credit_points: number;
}

export interface Case {
  id: string;
  created_by: string;
  taxpayer_id_number: string;
  taxpayer_name: string;
  taxpayer_birth_year?: number;
  tax_year: number;
  months_count: number;
  months_list: number[];
  marital_status: MaritalStatus;
  gender: Gender;
  case_type: CaseType;
  has_spouse: boolean;
  status: CaseStatus;
  extra_credit_points: number;
  notes?: string;
  created_at: string;
  updated_at: string;
  children: Child[];
  spouse?: Spouse | null;
}

export interface TrialBalanceLine {
  id?: string;
  account_code?: string;
  account_name: string;
  debit_amount: number;
  credit_amount: number;
  net_amount: number;
  category: LineCategory;
  deduction_pct: number;
  notes?: string;
  is_manually_overridden: boolean;
}

export interface TrialBalanceImport {
  id: string;
  taxpayer_type: TaxpayerType;
  source: string;
  original_filename?: string;
  version: number;
  uploaded_at: string;
  lines: TrialBalanceLine[];
}

export interface PayslipImport {
  id: string;
  taxpayer_type: TaxpayerType;
  source: string;
  original_filename?: string;
  version: number;
  uploaded_at: string;
  gross_cumulative: number;
  income_tax_cumulative: number;
  national_insurance_cumulative: number;
  health_insurance_cumulative: number;
}

export interface AdvancePayment {
  id: string;
  taxpayer_type: TaxpayerType;
  payment_type: PaymentType;
  advance_pct?: number;
  advance_amount?: number;
  notes?: string;
}

export interface PersonResult {
  business_revenue: number;
  business_cogs: number;
  business_expenses_accounting: number;
  business_expenses_allowed: number;
  tax_adjustment: number;
  business_taxable_income: number;
  salary_taxable_income: number;
  total_taxable_income: number;
  projected_annual_income: number;
  credit_points_total: number;
  credit_points_value_ils: number;
  income_tax_after_credits: number;
  income_tax_paid: number;
  income_tax_advance_pct_used: number;
  income_tax_advance_from_pct: number;
  income_tax_recommended_pct: number;
  income_tax_gap: number;
  income_tax_coverage_pct: number;
  ni_expected: number;
  ni_health_expected: number;
  ni_total_expected: number;
  ni_paid: number;
  ni_gap: number;
  ni_monthly_recommended: number;
  ni_monthly_actual: number;
  total_gap: number;
  score_color: "green" | "yellow" | "red";
  total_gap_pct: number;
  tax_bracket_breakdown: any[];
}

export interface CalcResult {
  id: string;
  version: number;
  calculated_at: string;
  is_current: boolean;
  result_json: {
    tax_year: number;
    months_count: number;
    case_type: string;
    primary: PersonResult;
    spouse?: PersonResult | null;
    combined?: any;
  };
}
