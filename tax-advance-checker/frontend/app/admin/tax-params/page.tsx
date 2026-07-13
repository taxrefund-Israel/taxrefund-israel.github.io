"use client";

import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import { api } from "@/lib/api";

interface Bundle {
  tax_year: number;
  tax_brackets: { bracket_order: number; income_from: number; income_to: number | null; rate_pct: number }[];
  ni_brackets: { bracket_order: number; income_from: number; income_to: number | null; employee_rate_pct: number; self_employed_rate_pct: number; health_rate_pct: number }[];
  ni_ceilings: { monthly_ceiling: number; annual_ceiling: number; minimum_income: number };
  credit_points: { credit_point_value: number; basic_points_single: number; basic_points_married_addition: number; basic_points_female_addition: number; child_points_by_age: Record<string, number> };
}

export default function TaxParamsPage() {
  const [year, setYear] = useState(2026);
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [msg, setMsg] = useState("");

  const load = (y: number) =>
    api.get<Bundle>(`/admin/tax-params/${y}`).then(setBundle).catch((e) => { setBundle(null); setMsg(e.message); });
  useEffect(() => { load(year); }, [year]);

  async function save() {
    if (!bundle) return;
    setMsg("שומר...");
    try {
      await api.put(`/admin/tax-params/${year}`, bundle);
      setMsg("נשמר ✓ — חישובים חדשים ישתמשו בפרמטרים המעודכנים");
    } catch (e: any) { setMsg(e.message); }
  }

  const upTax = (i: number, k: string, v: number) =>
    setBundle((b) => b ? { ...b, tax_brackets: b.tax_brackets.map((x, j) => j === i ? { ...x, [k]: v } : x) } : b);
  const upNi = (i: number, k: string, v: number) =>
    setBundle((b) => b ? { ...b, ni_brackets: b.ni_brackets.map((x, j) => j === i ? { ...x, [k]: v } : x) } : b);

  return (
    <Shell>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">פרמטרי מס לפי שנה</h1>
        <div className="flex items-center gap-2">
          <label className="text-sm">שנת מס</label>
          <input className="input max-w-[100px]" type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
        </div>
      </div>
      {msg && <p className="text-sm text-slate-600 mb-3">{msg}</p>}

      {!bundle ? (
        <div className="card text-slate-400">לא הוגדרו פרמטרים לשנה זו</div>
      ) : (
        <div className="space-y-4">
          <div className="card">
            <h2 className="font-semibold mb-3">מדרגות מס הכנסה (שנתי)</h2>
            <table className="table-base">
              <thead><tr><th>מ-</th><th>עד</th><th>שיעור %</th></tr></thead>
              <tbody>
                {bundle.tax_brackets.map((b, i) => (
                  <tr key={i}>
                    <td><input className="input !py-1" type="number" value={b.income_from} onChange={(e) => upTax(i, "income_from", Number(e.target.value))} /></td>
                    <td><input className="input !py-1" type="number" value={b.income_to ?? ""} placeholder="∞" onChange={(e) => upTax(i, "income_to", e.target.value ? Number(e.target.value) : (null as any))} /></td>
                    <td><input className="input !py-1" type="number" value={b.rate_pct} onChange={(e) => upTax(i, "rate_pct", Number(e.target.value))} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card">
            <h2 className="font-semibold mb-3">מדרגות ביטוח לאומי + בריאות (חודשי)</h2>
            <table className="table-base">
              <thead><tr><th>מ-</th><th>עד</th><th>שכיר %</th><th>עצמאי %</th><th>בריאות %</th></tr></thead>
              <tbody>
                {bundle.ni_brackets.map((b, i) => (
                  <tr key={i}>
                    <td><input className="input !py-1" type="number" value={b.income_from} onChange={(e) => upNi(i, "income_from", Number(e.target.value))} /></td>
                    <td><input className="input !py-1" type="number" value={b.income_to ?? ""} placeholder="∞" onChange={(e) => upNi(i, "income_to", e.target.value ? Number(e.target.value) : (null as any))} /></td>
                    <td><input className="input !py-1" type="number" value={b.employee_rate_pct} onChange={(e) => upNi(i, "employee_rate_pct", Number(e.target.value))} /></td>
                    <td><input className="input !py-1" type="number" value={b.self_employed_rate_pct} onChange={(e) => upNi(i, "self_employed_rate_pct", Number(e.target.value))} /></td>
                    <td><input className="input !py-1" type="number" value={b.health_rate_pct} onChange={(e) => upNi(i, "health_rate_pct", Number(e.target.value))} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card grid grid-cols-1 md:grid-cols-3 gap-3">
            <h2 className="font-semibold md:col-span-3">תקרות ביטוח לאומי</h2>
            <div><label className="label">תקרה חודשית</label>
              <input className="input" type="number" value={bundle.ni_ceilings.monthly_ceiling} onChange={(e) => setBundle((b) => b ? { ...b, ni_ceilings: { ...b.ni_ceilings, monthly_ceiling: Number(e.target.value) } } : b)} /></div>
            <div><label className="label">תקרה שנתית</label>
              <input className="input" type="number" value={bundle.ni_ceilings.annual_ceiling} onChange={(e) => setBundle((b) => b ? { ...b, ni_ceilings: { ...b.ni_ceilings, annual_ceiling: Number(e.target.value) } } : b)} /></div>
            <div><label className="label">הכנסה מינימלית</label>
              <input className="input" type="number" value={bundle.ni_ceilings.minimum_income} onChange={(e) => setBundle((b) => b ? { ...b, ni_ceilings: { ...b.ni_ceilings, minimum_income: Number(e.target.value) } } : b)} /></div>
          </div>

          <div className="card grid grid-cols-1 md:grid-cols-3 gap-3">
            <h2 className="font-semibold md:col-span-3">נקודות זיכוי</h2>
            <div><label className="label">שווי נקודה (שנתי)</label>
              <input className="input" type="number" value={bundle.credit_points.credit_point_value} onChange={(e) => setBundle((b) => b ? { ...b, credit_points: { ...b.credit_points, credit_point_value: Number(e.target.value) } } : b)} /></div>
            <div><label className="label">נקודות בסיס</label>
              <input className="input" type="number" step="0.25" value={bundle.credit_points.basic_points_single} onChange={(e) => setBundle((b) => b ? { ...b, credit_points: { ...b.credit_points, basic_points_single: Number(e.target.value) } } : b)} /></div>
            <div><label className="label">תוספת לאישה</label>
              <input className="input" type="number" step="0.25" value={bundle.credit_points.basic_points_female_addition} onChange={(e) => setBundle((b) => b ? { ...b, credit_points: { ...b.credit_points, basic_points_female_addition: Number(e.target.value) } } : b)} /></div>
            <div className="md:col-span-3">
              <label className="label">נקודות זיכוי ילדים לפי גיל (JSON)</label>
              <textarea className="input font-mono text-xs" dir="ltr" rows={3}
                value={JSON.stringify(bundle.credit_points.child_points_by_age)}
                onChange={(e) => { try { const v = JSON.parse(e.target.value); setBundle((b) => b ? { ...b, credit_points: { ...b.credit_points, child_points_by_age: v } } : b); } catch {} }} />
            </div>
          </div>

          <button className="btn-primary" onClick={save}>שמור פרמטרים</button>
        </div>
      )}
    </Shell>
  );
}
