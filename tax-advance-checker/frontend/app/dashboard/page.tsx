"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Shell from "@/components/Shell";
import { api } from "@/lib/api";
import type { Case } from "@/lib/types";
import { STATUS_LABELS } from "@/lib/format";

export default function Dashboard() {
  const [cases, setCases] = useState<Case[]>([]);

  useEffect(() => {
    api.get<Case[]>("/cases").then(setCases).catch(() => {});
  }, []);

  const byStatus = (s: string) => cases.filter((c) => c.status === s).length;

  return (
    <Shell>
      <h1 className="text-2xl font-bold mb-6">לוח בקרה</h1>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "סך תיקים", value: cases.length },
          { label: "טיוטות", value: byStatus("draft") },
          { label: "בעבודה", value: byStatus("in_progress") },
          { label: "הושלמו", value: byStatus("complete") },
        ].map((s) => (
          <div key={s.label} className="card text-center">
            <div className="text-3xl font-bold text-brand">{s.value}</div>
            <div className="text-slate-500 text-sm mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">תיקים אחרונים</h2>
        <Link href="/cases/new" className="btn-primary">+ תיק בדיקה חדש</Link>
      </div>
      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>שם נישום</th><th>ת.ז</th><th>שנת מס</th><th>חודשים</th><th>סטטוס</th>
            </tr>
          </thead>
          <tbody>
            {cases.slice(0, 10).map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td><Link href={`/cases/${c.id}`} className="text-brand hover:underline">{c.taxpayer_name}</Link></td>
                <td dir="ltr">{c.taxpayer_id_number}</td>
                <td>{c.tax_year}</td>
                <td>{c.months_count}</td>
                <td>{STATUS_LABELS[c.status]}</td>
              </tr>
            ))}
            {cases.length === 0 && (
              <tr><td colSpan={5} className="text-center text-slate-400 py-6">אין תיקים עדיין</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
