"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { TrialBalanceImport, TrialBalanceLine, TaxpayerType } from "@/lib/types";
import { CATEGORY_LABELS, RECOGNITION_TYPES, ils } from "@/lib/format";

export default function TrialBalanceTab({ caseId, hasSpouse }: { caseId: string; hasSpouse: boolean }) {
  const [taxpayer, setTaxpayer] = useState<TaxpayerType>("primary");
  const [imports, setImports] = useState<TrialBalanceImport[]>([]);
  const [lines, setLines] = useState<TrialBalanceLine[]>([]);
  const [importId, setImportId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const reload = () =>
    api.get<TrialBalanceImport[]>(`/cases/${caseId}/trial-balance`).then((imps) => {
      setImports(imps);
      const current = imps.find((i) => i.taxpayer_type === taxpayer);
      if (current) { setLines(current.lines); setImportId(current.id); }
      else { setLines([]); setImportId(null); }
    });

  useEffect(() => { reload(); }, [caseId, taxpayer]);

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    form.append("taxpayer_type", taxpayer);
    setMsg("מעלה ומנתח...");
    try {
      const imp = await api.upload<TrialBalanceImport>(`/cases/${caseId}/trial-balance/upload`, form);
      setLines(imp.lines); setImportId(imp.id);
      setMsg(`נטענו ${imp.lines.length} שורות`);
      reload();
    } catch (err: any) { setMsg(err.message); }
    if (fileRef.current) fileRef.current.value = "";
  }

  function updateLine(i: number, patch: Partial<TrialBalanceLine>) {
    setLines((arr) => arr.map((l, j) => {
      if (j !== i) return l;
      const next = { ...l, ...patch, is_manually_overridden: true };
      // הכנסה — כל הסכום רלוונטי, אין משמעות לאחוז מוכר
      if (next.category === "revenue") next.deduction_pct = 100;
      return next;
    }));
  }
  function addLine() {
    setLines((arr) => [...arr, {
      account_name: "", debit_amount: 0, credit_amount: 0, net_amount: 0,
      category: "expense", deduction_pct: 100, is_manually_overridden: true,
    }]);
  }

  async function save() {
    setMsg("שומר...");
    try {
      if (importId) {
        await api.put(`/cases/${caseId}/trial-balance/${importId}/lines`, { lines });
      } else {
        const imp = await api.post<TrialBalanceImport>(`/cases/${caseId}/trial-balance/manual`,
          { taxpayer_type: taxpayer, lines });
        setImportId(imp.id);
      }
      setMsg("נשמר ✓");
      reload();
    } catch (err: any) { setMsg(err.message); }
  }

  const allowed = (l: TrialBalanceLine) => Math.abs(l.net_amount) * (l.deduction_pct / 100);
  const totals = lines.reduce((acc, l) => {
    const a = Math.abs(l.net_amount);
    if (l.category === "revenue") acc.revenue += a;
    else if (l.category === "expense") { acc.expAcc += a; acc.expAllowed += allowed(l); }
    return acc;
  }, { revenue: 0, expAcc: 0, expAllowed: 0 });

  return (
    <div className="space-y-4">
      {hasSpouse && (
        <div className="flex gap-2">
          {(["primary", "spouse"] as TaxpayerType[]).map((t) => (
            <button key={t} onClick={() => setTaxpayer(t)}
              className={taxpayer === t ? "btn-primary" : "btn-secondary"}>
              {t === "primary" ? "נישום ראשי" : "בן/בת זוג"}
            </button>
          ))}
        </div>
      )}

      <div className="card">
        <div className="flex items-center gap-3 flex-wrap">
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.pdf" onChange={onUpload} className="hidden" id="tb-file" />
          <label htmlFor="tb-file" className="btn-primary cursor-pointer">העלה קובץ (Excel/PDF)</label>
          <button className="btn-secondary" onClick={addLine}>+ הוסף שורה ידנית</button>
          <button className="btn-primary" onClick={save}>שמור מיפוי</button>
          {msg && <span className="text-sm text-slate-500">{msg}</span>}
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>קוד</th><th>שם חשבון</th><th>סכום נטו</th><th>קטגוריה</th>
              <th>% מוכר</th><th>הוצאה מותרת</th><th></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i}>
                <td><input className="input !py-1 max-w-[80px]" value={l.account_code || ""}
                  onChange={(e) => updateLine(i, { account_code: e.target.value })} /></td>
                <td><input className="input !py-1 min-w-[180px]" value={l.account_name}
                  onChange={(e) => updateLine(i, { account_name: e.target.value })} /></td>
                <td><input className="input !py-1 max-w-[110px]" type="number" value={l.net_amount}
                  onChange={(e) => updateLine(i, { net_amount: Number(e.target.value) })} /></td>
                <td>
                  <select className="input !py-1" value={l.category}
                    onChange={(e) => updateLine(i, { category: e.target.value as any })}>
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </td>
                <td>
                  {l.category === "revenue" ? (
                    <span className="text-slate-400">—</span>
                  ) : (
                    <select className="input !py-1" value={l.deduction_pct}
                      onChange={(e) => updateLine(i, { deduction_pct: Number(e.target.value) })}>
                      {RECOGNITION_TYPES.map((t) => <option key={t.label} value={t.pct}>{t.label}</option>)}
                      {!RECOGNITION_TYPES.some((t) => t.pct === Number(l.deduction_pct)) &&
                        <option value={l.deduction_pct}>{`מותאם (${l.deduction_pct}%)`}</option>}
                    </select>
                  )}
                </td>
                <td className="text-left">{l.category === "expense" ? ils(allowed(l)) : "—"}</td>
                <td><button className="text-red-600 text-xs"
                  onClick={() => setLines((arr) => arr.filter((_, j) => j !== i))}>הסר</button></td>
              </tr>
            ))}
            {lines.length === 0 && <tr><td colSpan={7} className="text-center text-slate-400 py-6">אין שורות — העלה קובץ או הוסף ידנית</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Sum label="הכנסות" value={totals.revenue} />
        <Sum label="הוצאות (חשבונאי)" value={totals.expAcc} />
        <Sum label="הוצאה מותרת" value={totals.expAllowed} />
      </div>
    </div>
  );
}

function Sum({ label, value }: { label: string; value: number }) {
  return (
    <div className="card !p-3 text-center">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="font-bold text-brand">{ils(value)}</div>
    </div>
  );
}
