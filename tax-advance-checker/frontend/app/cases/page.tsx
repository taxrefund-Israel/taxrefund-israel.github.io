"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Shell from "@/components/Shell";
import { api } from "@/lib/api";
import type { Case } from "@/lib/types";
import { STATUS_LABELS, CASE_TYPE_LABELS } from "@/lib/format";

export default function CasesPage() {
  const [cases, setCases] = useState<Case[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    api.get<Case[]>("/cases").then(setCases).catch(() => {});
  }, []);

  const filtered = cases.filter(
    (c) => c.taxpayer_name.includes(q) || c.taxpayer_id_number.includes(q)
  );

  async function removeCase(c: Case) {
    if (!confirm(`האם אתה בטוח שברצונך למחוק את התיק של "${c.taxpayer_name}"?\nפעולה זו אינה הפיכה.`)) return;
    try {
      await api.del(`/cases/${c.id}`);
      setCases((arr) => arr.filter((x) => x.id !== c.id));
    } catch (e: any) {
      alert(e.message || "מחיקה נכשלה");
    }
  }

  return (
    <Shell>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">תיקי בדיקה</h1>
        <Link href="/cases/new" className="btn-primary">+ תיק חדש</Link>
      </div>
      <input className="input mb-4 max-w-sm" placeholder="חיפוש לפי שם או ת.ז"
        value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>שם נישום</th><th>ת.ז</th><th>סוג</th><th>שנת מס</th><th>חודשים</th><th>סטטוס</th><th>פעולות</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td><Link href={`/cases/${c.id}`} className="text-brand hover:underline">{c.taxpayer_name}</Link></td>
                <td dir="ltr">{c.taxpayer_id_number}</td>
                <td>{CASE_TYPE_LABELS[c.case_type]}</td>
                <td>{c.tax_year}</td>
                <td>{c.months_count}</td>
                <td>{STATUS_LABELS[c.status]}</td>
                <td className="whitespace-nowrap">
                  <Link href={`/cases/${c.id}/edit`} className="text-brand hover:underline text-sm ml-3">עריכה</Link>
                  <button onClick={() => removeCase(c)} className="text-red-600 hover:underline text-sm">מחיקה</button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="text-center text-slate-400 py-6">לא נמצאו תיקים</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
