"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { CalcResult, PersonResult } from "@/lib/types";
import { ils, num, pct, scoreColorClass } from "@/lib/format";

export default function ResultsTab({ caseId }: { caseId: string }) {
  const [calc, setCalc] = useState<CalcResult | null>(null);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const loadCurrent = () =>
    api.get<CalcResult>(`/cases/${caseId}/calculations/current`).then(setCalc).catch(() => setCalc(null));
  useEffect(() => { loadCurrent(); }, [caseId]);

  async function run() {
    setLoading(true); setMsg("");
    try {
      const res = await api.post<CalcResult>(`/cases/${caseId}/calculations/run`);
      setCalc(res);
      setMsg("החישוב בוצע ✓");
    } catch (err: any) { setMsg(err.message); }
    finally { setLoading(false); }
  }

  function download(kind: "pdf" | "excel") {
    api.raw(`/cases/${caseId}/reports/${kind}`).then(async (res) => {
      if (!res.ok) { setMsg("שגיאה בהפקת דוח"); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `report.${kind === "pdf" ? "pdf" : "xlsx"}`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  return (
    <div className="space-y-4">
      <div className="card flex items-center gap-3 flex-wrap">
        <button className="btn-primary" onClick={run} disabled={loading}>
          {loading ? "מחשב..." : "חשב מחדש"}
        </button>
        {calc && (
          <>
            <button className="btn-secondary" onClick={() => download("pdf")}>ייצא PDF</button>
            <button className="btn-secondary" onClick={() => download("excel")}>ייצא Excel</button>
            <span className="text-sm text-slate-400">גרסה {calc.version}</span>
          </>
        )}
        {msg && <span className="text-sm text-slate-500">{msg}</span>}
      </div>

      {!calc && <div className="card text-slate-400 text-center py-10">טרם בוצע חישוב — לחץ "חשב מחדש"</div>}

      {calc && (
        <>
          <PersonResultCard title="נישום ראשי" p={calc.result_json.primary} months={calc.result_json.months_count} />
          {calc.result_json.spouse && (
            <PersonResultCard title="בן/בת זוג" p={calc.result_json.spouse} months={calc.result_json.months_count} />
          )}
          {calc.result_json.combined && <CombinedCard c={calc.result_json.combined} />}
        </>
      )}
    </div>
  );
}

function ScoreBadge({ color, gapPct }: { color: string; gapPct: number }) {
  const label = color === "green" ? "תקין" : color === "yellow" ? "פער בינוני" : "פער גבוה";
  return (
    <span className={`border rounded-full px-3 py-1 text-sm font-semibold ${scoreColorClass(color)}`}>
      {label} ({pct(gapPct)})
    </span>
  );
}

function GapSummary({ title, rows, good }: { title: string; rows: [string, string][]; good: boolean }) {
  const cls = good
    ? "bg-green-50 border-green-300 text-green-900"
    : "bg-red-50 border-red-300 text-red-900";
  return (
    <div className={`rounded-xl border-2 p-4 ${cls}`}>
      <div className="font-bold mb-2 flex items-center justify-between">
        <span>{title}</span>
        <span className="text-sm">{good ? "✓ תקין / עודף" : "✗ חוסר — להגדיל מקדמה"}</span>
      </div>
      {rows.map(([label, value], i) => (
        <div key={i} className={`flex justify-between py-1 ${i === rows.length - 1 ? "font-bold border-t border-current/20 mt-1 pt-2" : ""}`}>
          <span className="opacity-80">{label}</span>
          <span>{value}</span>
        </div>
      ))}
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between py-1.5 border-b border-slate-100 ${strong ? "font-bold" : ""}`}>
      <span className="text-slate-600">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function PersonResultCard({ title, p, months }: { title: string; p: PersonResult; months: number }) {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">{title}</h2>
        <ScoreBadge color={p.score_color} gapPct={p.total_gap_pct} />
      </div>

      {/* סיכום צבעוני ברור */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
        <GapSummary
          title="מס הכנסה — מקדמות"
          good={p.income_tax_advance_pct_used >= p.income_tax_recommended_pct}
          rows={[
            ["אחוז מקדמות קיים", pct(p.income_tax_advance_pct_used)],
            ["אחוז מקדמות מומלץ", pct(p.income_tax_recommended_pct)],
            ["פער בכסף", ils(p.income_tax_paid - p.income_tax_after_credits)],
          ]}
        />
        <GapSummary
          title="ביטוח לאומי + בריאות"
          good={p.ni_monthly_actual >= p.ni_monthly_recommended}
          rows={[
            ["חבות צפויה (לתקופה)", ils(p.ni_total_expected)],
            ["שולם בפועל (לתקופה)", ils(p.ni_paid)],
            ["מקדמה חודשית מומלצת", ils(p.ni_monthly_recommended)],
            ["מקדמה חודשית קיימת", ils(p.ni_monthly_actual)],
            ["פער חודשי", ils(p.ni_monthly_actual - p.ni_monthly_recommended)],
            ["פער לתקופה", ils(p.ni_paid - p.ni_total_expected)],
          ]}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <h3 className="font-semibold text-brand mb-2">הכנסה עסקית</h3>
          <Row label="מחזור עסקי" value={ils(p.business_revenue)} />
          <Row label="עלות מכר" value={ils(p.business_cogs)} />
          <Row label="הוצאות חשבונאיות" value={ils(p.business_expenses_accounting)} />
          <Row label="תיאום מס" value={ils(p.tax_adjustment)} />
          <Row label="הכנסה חייבת מעסק" value={ils(p.business_taxable_income)} strong />
          <Row label="הכנסה חייבת משכר" value={ils(p.salary_taxable_income)} />
          <Row label="הכנסה חייבת כוללת" value={ils(p.total_taxable_income)} strong />
        </div>
        <div>
          <h3 className="font-semibold text-brand mb-2">מס הכנסה</h3>
          <Row label="נקודות זיכוי" value={num(p.credit_points_total, 2)} />
          <Row label="שווי זיכויים" value={ils(p.credit_points_value_ils)} />
          <Row label="מס צפוי (לתקופה)" value={ils(p.income_tax_after_credits)} strong />
          <Row label="אחוז מקדמות שהוזן" value={pct(p.income_tax_advance_pct_used)} />
          <Row label="מס ששולם (מקדמות)" value={ils(p.income_tax_paid)} />
          <Row label="פער מס" value={ils(p.income_tax_gap)} strong />
          <Row label="אחוז כיסוי מס" value={pct(p.income_tax_coverage_pct)} />
          <Row label="אחוז מקדמות מומלץ" value={pct(p.income_tax_recommended_pct)} strong />
        </div>
        <div>
          <h3 className="font-semibold text-brand mb-2">ביטוח לאומי + בריאות</h3>
          <Row label="ביטוח לאומי צפוי" value={ils(p.ni_expected)} />
          <Row label="דמי בריאות צפוי" value={ils(p.ni_health_expected)} />
          <Row label="סך חבות צפויה" value={ils(p.ni_total_expected)} strong />
          <Row label="שולם בפועל" value={ils(p.ni_paid)} />
          <Row label="פער ב״ל" value={ils(p.ni_gap)} strong />
          <Row label="מקדמה חודשית מומלצת" value={ils(p.ni_monthly_recommended)} />
          <Row label="מקדמה חודשית בפועל" value={ils(p.ni_monthly_actual)} />
        </div>
      </div>
      <div className={`mt-4 p-3 rounded-lg border text-center font-bold ${scoreColorClass(p.score_color)}`}>
        פער כולל: {ils(p.total_gap)}
      </div>
    </div>
  );
}

function CombinedCard({ c }: { c: any }) {
  return (
    <div className="card bg-slate-50">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">תמונת מצב משותפת — בני זוג</h2>
        <ScoreBadge color={c.score_color} gapPct={c.total_gap_pct} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        <GapSummary
          title="מס הכנסה — כולל"
          good={c.income_tax_paid >= c.income_tax_expected}
          rows={[
            ["מס צפוי כולל", ils(c.income_tax_expected)],
            ["מס ששולם כולל", ils(c.income_tax_paid)],
            ["פער בכסף", ils(c.income_tax_paid - c.income_tax_expected)],
          ]}
        />
        <GapSummary
          title="ביטוח לאומי — כולל"
          good={c.ni_paid >= c.ni_expected}
          rows={[
            ["ב״ל צפוי כולל", ils(c.ni_expected)],
            ["ב״ל ששולם כולל", ils(c.ni_paid)],
            ["פער בכסף", ils(c.ni_paid - c.ni_expected)],
          ]}
        />
      </div>
      <Row label="מחזור משותף" value={ils(c.combined_revenue)} strong />
    </div>
  );
}
