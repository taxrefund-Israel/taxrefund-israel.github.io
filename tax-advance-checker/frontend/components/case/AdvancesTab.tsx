"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { AdvancePayment } from "@/lib/types";

export default function AdvancesTab({ caseId, hasSpouse }: { caseId: string; hasSpouse: boolean }) {
  const [incomeTaxPct, setIncomeTaxPct] = useState("");
  const [niPrimary, setNiPrimary] = useState("");
  const [niSpouse, setNiSpouse] = useState("");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  const reload = () =>
    api.get<AdvancePayment[]>(`/cases/${caseId}/advances`).then((items) => {
      const pct = items.find((a) => a.payment_type === "income_tax_pct");
      const niP = items.find((a) => a.payment_type === "national_insurance_monthly" && a.taxpayer_type === "primary");
      const niS = items.find((a) => a.payment_type === "national_insurance_monthly" && a.taxpayer_type === "spouse");
      setIncomeTaxPct(pct?.advance_pct != null ? String(pct.advance_pct) : "");
      setNiPrimary(niP?.advance_amount != null ? String(niP.advance_amount) : "");
      setNiSpouse(niS?.advance_amount != null ? String(niS.advance_amount) : "");
    });

  useEffect(() => { reload(); }, [caseId]);

  async function save() {
    setSaving(true); setMsg("שומר...");
    try {
      // נקה מקדמות קיימות ושמור מחדש לפי התיבות
      const existing = await api.get<AdvancePayment[]>(`/cases/${caseId}/advances`);
      for (const a of existing) await api.del(`/cases/${caseId}/advances/${a.id}`);

      if (incomeTaxPct !== "") {
        await api.post(`/cases/${caseId}/advances`, {
          taxpayer_type: "primary", payment_type: "income_tax_pct",
          advance_pct: Number(incomeTaxPct), advance_amount: null,
        });
      }
      if (niPrimary !== "") {
        await api.post(`/cases/${caseId}/advances`, {
          taxpayer_type: "primary", payment_type: "national_insurance_monthly",
          advance_pct: null, advance_amount: Number(niPrimary),
        });
      }
      if (hasSpouse && niSpouse !== "") {
        await api.post(`/cases/${caseId}/advances`, {
          taxpayer_type: "spouse", payment_type: "national_insurance_monthly",
          advance_pct: null, advance_amount: Number(niSpouse),
        });
      }
      setMsg("נשמר ✓");
      reload();
    } catch (err: any) {
      setMsg(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card max-w-2xl space-y-5">
        <div>
          <label className="label">אחוז מקדמות מס הכנסה (%)</label>
          <input className="input" type="number" step="0.1" value={incomeTaxPct}
            onChange={(e) => setIncomeTaxPct(e.target.value)} placeholder="לדוגמה: 10" />
          <p className="text-xs text-slate-400 mt-1">
            {hasSpouse ? "אחוז אחד מהמחזור המשותף של בני הזוג." : "אחוז המקדמה מהמחזור העסקי."}
          </p>
        </div>

        <div>
          <label className="label">ביטוח לאומי — מקדמה חודשית (₪){hasSpouse ? " — נישום ראשי" : ""}</label>
          <input className="input" type="number" value={niPrimary}
            onChange={(e) => setNiPrimary(e.target.value)} placeholder="סכום חודשי קבוע" />
        </div>

        {hasSpouse && (
          <div>
            <label className="label">ביטוח לאומי — מקדמה חודשית (₪) — בן/בת זוג</label>
            <input className="input" type="number" value={niSpouse}
              onChange={(e) => setNiSpouse(e.target.value)} placeholder="סכום חודשי קבוע" />
          </div>
        )}

        <div className="flex items-center gap-3">
          <button className="btn-primary" onClick={save} disabled={saving}>שמור מקדמות</button>
          {msg && <span className="text-sm text-slate-500">{msg}</span>}
        </div>
      </div>
    </div>
  );
}
