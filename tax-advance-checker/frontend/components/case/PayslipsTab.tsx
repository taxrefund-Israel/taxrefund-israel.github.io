"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { PayslipImport, TaxpayerType } from "@/lib/types";

export default function PayslipsTab({ caseId, hasSpouse }: { caseId: string; hasSpouse: boolean }) {
  const [taxpayer, setTaxpayer] = useState<TaxpayerType>("primary");
  const [data, setData] = useState({
    gross_cumulative: 0, income_tax_cumulative: 0,
    national_insurance_cumulative: 0, health_insurance_cumulative: 0,
  });
  const [history, setHistory] = useState<PayslipImport[]>([]);
  const [msg, setMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const reload = () =>
    api.get<PayslipImport[]>(`/cases/${caseId}/payslip`).then((all) => {
      setHistory(all);
      const cur = all.find((p) => p.taxpayer_type === taxpayer);
      if (cur) setData({
        gross_cumulative: cur.gross_cumulative,
        income_tax_cumulative: cur.income_tax_cumulative,
        national_insurance_cumulative: cur.national_insurance_cumulative,
        health_insurance_cumulative: cur.health_insurance_cumulative,
      });
    });
  useEffect(() => { reload(); }, [caseId, taxpayer]);

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    form.append("taxpayer_type", taxpayer);
    setMsg("מחלץ נתונים מהתלוש...");
    try {
      const imp = await api.upload<PayslipImport>(`/cases/${caseId}/payslip/upload`, form);
      setData({
        gross_cumulative: imp.gross_cumulative,
        income_tax_cumulative: imp.income_tax_cumulative,
        national_insurance_cumulative: imp.national_insurance_cumulative,
        health_insurance_cumulative: imp.health_insurance_cumulative,
      });
      setMsg("חולץ — בדוק והשלם ידנית במידת הצורך");
      reload();
    } catch (err: any) { setMsg(err.message); }
    if (fileRef.current) fileRef.current.value = "";
  }

  async function saveManual() {
    setMsg("שומר...");
    try {
      await api.post(`/cases/${caseId}/payslip/manual`, { taxpayer_type: taxpayer, ...data });
      setMsg("נשמר ✓");
      reload();
    } catch (err: any) { setMsg(err.message); }
  }

  const fields: [keyof typeof data, string][] = [
    ["gross_cumulative", "שכר ברוטו מצטבר"],
    ["income_tax_cumulative", "מס הכנסה מצטבר"],
    ["national_insurance_cumulative", "ביטוח לאומי מצטבר"],
    ["health_insurance_cumulative", "דמי בריאות מצטברים"],
  ];

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
        <input ref={fileRef} type="file" accept=".pdf" onChange={onUpload} className="hidden" id="ps-file" />
        <label htmlFor="ps-file" className="btn-primary cursor-pointer">העלה תלוש (PDF)</label>
        {msg && <span className="text-sm text-slate-500 mr-3">{msg}</span>}
      </div>

      <div className="card grid grid-cols-1 md:grid-cols-2 gap-4">
        <h2 className="font-semibold md:col-span-2">נתונים מצטברים (ניתן לעריכה ידנית)</h2>
        <p className="text-xs text-slate-400 md:col-span-2 -mt-2">
          ברוטו ומס הכנסה משפיעים על הבדיקה. ב״ל ובריאות נשמרים לתיעוד בלבד — הם מנוכים ע״י המעסיק ואינם חלק ממקדמות העצמאי.
        </p>
        {fields.map(([k, label]) => (
          <div key={k}>
            <label className="label">{label}</label>
            <input className="input" type="number" value={data[k]}
              onChange={(e) => setData((d) => ({ ...d, [k]: Number(e.target.value) }))} />
          </div>
        ))}
        <div className="md:col-span-2">
          <button className="btn-primary" onClick={saveManual}>שמור נתונים</button>
        </div>
      </div>

      {history.length > 0 && (
        <div className="card">
          <h3 className="font-semibold mb-2 text-sm">גרסאות קודמות</h3>
          <table className="table-base">
            <thead><tr><th>גרסה</th><th>מקור</th><th>ברוטו</th><th>תאריך</th></tr></thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id}>
                  <td>{h.version}</td>
                  <td>{h.source === "file" ? h.original_filename : "ידני"}</td>
                  <td>{h.gross_cumulative}</td>
                  <td>{new Date(h.uploaded_at).toLocaleDateString("he-IL")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
