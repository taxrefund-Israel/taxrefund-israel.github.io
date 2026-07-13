"use client";

import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import { api } from "@/lib/api";

interface Audit { id: string; case_id: string; action: string; details: any; timestamp: string; }

export default function AuditLogPage() {
  const [items, setItems] = useState<Audit[]>([]);
  useEffect(() => { api.get<Audit[]>("/admin/audit-log").then(setItems).catch(() => {}); }, []);

  return (
    <Shell>
      <h1 className="text-2xl font-bold mb-4">יומן פעולות מערכת</h1>
      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead><tr><th>פעולה</th><th>תיק</th><th>פרטים</th><th>מתי</th></tr></thead>
          <tbody>
            {items.map((a) => (
              <tr key={a.id}>
                <td>{a.action}</td>
                <td dir="ltr" className="text-xs">{a.case_id.slice(0, 8)}</td>
                <td dir="ltr" className="text-xs text-slate-500">{a.details ? JSON.stringify(a.details) : "—"}</td>
                <td>{new Date(a.timestamp).toLocaleString("he-IL")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
