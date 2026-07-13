"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface Audit { id: string; action: string; details: any; timestamp: string; }

const ACTION_LABELS: Record<string, string> = {
  created: "נוצר",
  updated_line: "עודכן מיפוי",
  uploaded_file: "הועלה קובץ",
  calculated: "בוצע חישוב",
  exported: "הופק דוח",
  deleted: "נמחק",
};

export default function AuditTab({ caseId }: { caseId: string }) {
  const [items, setItems] = useState<Audit[]>([]);
  useEffect(() => {
    api.get<Audit[]>(`/cases/${caseId}/audit`).then(setItems).catch(() => {});
  }, [caseId]);

  return (
    <div className="card overflow-x-auto">
      <table className="table-base">
        <thead><tr><th>פעולה</th><th>פרטים</th><th>מתי</th></tr></thead>
        <tbody>
          {items.map((a) => (
            <tr key={a.id}>
              <td>{ACTION_LABELS[a.action] || a.action}</td>
              <td className="text-xs text-slate-500" dir="ltr">{a.details ? JSON.stringify(a.details) : "—"}</td>
              <td>{new Date(a.timestamp).toLocaleString("he-IL")}</td>
            </tr>
          ))}
          {items.length === 0 && <tr><td colSpan={3} className="text-center text-slate-400 py-6">אין רישומים</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
