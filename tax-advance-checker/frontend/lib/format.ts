export const ils = (n: number) =>
  new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(n || 0);

export const num = (n: number, d = 0) =>
  new Intl.NumberFormat("he-IL", { maximumFractionDigits: d }).format(n || 0);

export const pct = (n: number) => `${num(n, 1)}%`;

export const CASE_TYPE_LABELS: Record<string, string> = {
  self_employed_only: "עצמאי בלבד",
  employed_only: "שכיר בלבד",
  self_employed_and_employed: "עצמאי + שכיר",
  couple_both_self_employed: "בני זוג עצמאיים",
  self_employed_spouse_self_employed: "עצמאי + בן/בת זוג עצמאי",
};

export const MARITAL_LABELS: Record<string, string> = {
  single: "רווק/ה",
  married: "נשוי/אה",
  divorced: "גרוש/ה",
  widowed: "אלמן/ה",
};

export const STATUS_LABELS: Record<string, string> = {
  draft: "טיוטה",
  in_progress: "בעבודה",
  complete: "הושלם",
};

export const CATEGORY_LABELS: Record<string, string> = {
  revenue: "הכנסות",
  expense: "הוצאות",
};

export const scoreColorClass = (c: string) =>
  c === "green" ? "bg-green-100 text-green-800 border-green-300"
  : c === "yellow" ? "bg-yellow-100 text-yellow-800 border-yellow-300"
  : "bg-red-100 text-red-800 border-red-300";

// סוגי הכרה בהוצאה — שם + שיעור הכרה
export const RECOGNITION_TYPES: { label: string; pct: number }[] = [
  { label: "מוכר במלואו (100%)", pct: 100 },
  { label: "כיבוד וביגוד (80%)", pct: 80 },
  { label: "אחר (66%)", pct: 66 },
  { label: "טלפון נייד (50%)", pct: 50 },
  { label: "רכב (45%)", pct: 45 },
  { label: "אחר (25%)", pct: 25 },
  { label: "לא מוכר (0%)", pct: 0 },
];
