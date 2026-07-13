"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Shell from "@/components/Shell";
import { api } from "@/lib/api";
import type { Case } from "@/lib/types";
import { CASE_TYPE_LABELS, MARITAL_LABELS, STATUS_LABELS } from "@/lib/format";
import TrialBalanceTab from "@/components/case/TrialBalanceTab";
import PayslipsTab from "@/components/case/PayslipsTab";
import AdvancesTab from "@/components/case/AdvancesTab";
import ResultsTab from "@/components/case/ResultsTab";
import AuditTab from "@/components/case/AuditTab";

const TABS = [
  { key: "trial", label: "מאזן בוחן" },
  { key: "payslips", label: "תלושי שכר" },
  { key: "advances", label: "מקדמות" },
  { key: "results", label: "תוצאות" },
  { key: "audit", label: "היסטוריה" },
];

// תלושי שכר רלוונטיים רק כשיש הכנסת שכר
const SALARY_TYPES = ["employed_only", "self_employed_and_employed"];

export default function CaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [c, setCase] = useState<Case | null>(null);
  const [tab, setTab] = useState("trial");

  const reload = () => api.get<Case>(`/cases/${id}`).then(setCase).catch(() => {});
  useEffect(() => { reload(); }, [id]);

  async function onDelete() {
    if (!c) return;
    if (!confirm(`האם אתה בטוח שברצונך למחוק את התיק של "${c.taxpayer_name}"?\nפעולה זו אינה הפיכה.`)) return;
    try {
      await api.del(`/cases/${id}`);
      window.location.href = "/cases";
    } catch (e: any) {
      alert(e.message || "מחיקה נכשלה");
    }
  }

  if (!c) return <Shell><div className="text-slate-500">טוען תיק...</div></Shell>;

  const hasSpouse = c.has_spouse;
  const showPayslips = SALARY_TYPES.includes(c.case_type);
  const visibleTabs = TABS.filter((t) => t.key !== "payslips" || showPayslips);
  const activeTab = tab === "payslips" && !showPayslips ? "trial" : tab;

  return (
    <Shell>
      <div className="card mb-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">{c.taxpayer_name}</h1>
            <p className="text-slate-500 text-sm mt-1" dir="ltr">ת.ז {c.taxpayer_id_number}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="bg-slate-100 rounded-full px-3 py-1 text-sm">{STATUS_LABELS[c.status]}</span>
            <Link href={`/cases/${id}/edit`} className="btn-secondary !py-1 !px-3 text-sm">עריכת פרטים</Link>
            <button onClick={onDelete} className="btn-danger !py-1 !px-3 text-sm">מחק תיק</button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4 text-sm">
          <Info label="סוג" value={CASE_TYPE_LABELS[c.case_type]} />
          <Info label="שנת מס" value={String(c.tax_year)} />
          <Info label="חודשים" value={String(c.months_count)} />
          <Info label="מצב משפחתי" value={MARITAL_LABELS[c.marital_status]} />
          <Info label="ילדים" value={String(c.children.length)} />
        </div>
      </div>

      <div className="flex gap-1 border-b border-slate-200 mb-4">
        {visibleTabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 -mb-px border-b-2 ${activeTab === t.key ? "border-brand text-brand font-semibold" : "border-transparent text-slate-500"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "trial" && <TrialBalanceTab caseId={id} hasSpouse={hasSpouse} />}
      {activeTab === "payslips" && <PayslipsTab caseId={id} hasSpouse={hasSpouse} />}
      {activeTab === "advances" && <AdvancesTab caseId={id} hasSpouse={hasSpouse} />}
      {activeTab === "results" && <ResultsTab caseId={id} />}
      {activeTab === "audit" && <AuditTab caseId={id} />}
    </Shell>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-slate-400">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
