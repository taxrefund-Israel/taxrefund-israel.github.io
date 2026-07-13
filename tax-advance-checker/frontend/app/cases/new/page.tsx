"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Shell from "@/components/Shell";
import { api } from "@/lib/api";
import type { Case, CaseType, Child } from "@/lib/types";
import { CASE_TYPE_LABELS, MARITAL_LABELS } from "@/lib/format";

const SPOUSE_TYPES: CaseType[] = ["couple_both_self_employed", "self_employed_spouse_self_employed"];

export default function NewCasePage() {
  const router = useRouter();
  const [form, setForm] = useState({
    taxpayer_id_number: "",
    taxpayer_name: "",
    taxpayer_birth_year: "",
    tax_year: 2026,
    months_count: 6,
    marital_status: "single",
    gender: "male",
    case_type: "self_employed_only" as CaseType,
    extra_credit_points: 0,
    notes: "",
  });
  const [children, setChildren] = useState<Child[]>([]);
  const [spouse, setSpouse] = useState({
    id_number: "", name: "", gender: "female", birth_year: "",
    is_self_employed: true, is_employed: false, extra_credit_points: 0,
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const hasSpouse = SPOUSE_TYPES.includes(form.case_type);
  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const payload: any = {
        ...form,
        taxpayer_birth_year: form.taxpayer_birth_year ? Number(form.taxpayer_birth_year) : null,
        tax_year: Number(form.tax_year),
        months_count: Number(form.months_count),
        extra_credit_points: Number(form.extra_credit_points),
        children: children.map((c) => ({ birth_year: Number(c.birth_year), is_disabled: c.is_disabled })),
        spouse: hasSpouse
          ? { ...spouse, birth_year: spouse.birth_year ? Number(spouse.birth_year) : null,
              extra_credit_points: Number(spouse.extra_credit_points) }
          : null,
      };
      const created = await api.post<Case>("/cases", payload);
      router.replace(`/cases/${created.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Shell>
      <h1 className="text-2xl font-bold mb-6">פתיחת תיק בדיקה</h1>
      <form onSubmit={submit} className="space-y-6 max-w-3xl">
        <div className="card grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">שם הנישום</label>
            <input className="input" required value={form.taxpayer_name}
              onChange={(e) => set("taxpayer_name", e.target.value)} />
          </div>
          <div>
            <label className="label">מספר זהות</label>
            <input className="input" dir="ltr" required value={form.taxpayer_id_number}
              onChange={(e) => set("taxpayer_id_number", e.target.value)} />
          </div>
          <div>
            <label className="label">שנת מס</label>
            <input className="input" type="number" value={form.tax_year}
              onChange={(e) => set("tax_year", e.target.value)} />
          </div>
          <div>
            <label className="label">מספר חודשים שנבדקים</label>
            <select className="input" value={form.months_count}
              onChange={(e) => set("months_count", e.target.value)}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">סטטוס משפחתי</label>
            <select className="input" value={form.marital_status}
              onChange={(e) => set("marital_status", e.target.value)}>
              {Object.entries(MARITAL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="label">מין</label>
            <select className="input" value={form.gender} onChange={(e) => set("gender", e.target.value)}>
              <option value="male">גבר</option>
              <option value="female">אישה</option>
            </select>
          </div>
          <div>
            <label className="label">שנת לידה</label>
            <input className="input" type="number" value={form.taxpayer_birth_year}
              onChange={(e) => set("taxpayer_birth_year", e.target.value)} />
          </div>
          <div>
            <label className="label">נקודות זיכוי נוספות</label>
            <input className="input" type="number" step="0.25" value={form.extra_credit_points}
              onChange={(e) => set("extra_credit_points", e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label className="label">סוג נישום</label>
            <select className="input" value={form.case_type}
              onChange={(e) => set("case_type", e.target.value as CaseType)}>
              {Object.entries(CASE_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>

        {/* Children */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">ילדים</h2>
            <button type="button" className="btn-secondary"
              onClick={() => setChildren((c) => [...c, { birth_year: 2020, is_disabled: false }])}>
              + הוסף ילד
            </button>
          </div>
          {children.map((c, i) => (
            <div key={i} className="flex items-center gap-3 mb-2">
              <label className="text-sm">שנת לידה</label>
              <input className="input max-w-[120px]" type="number" value={c.birth_year}
                onChange={(e) => setChildren((arr) => arr.map((x, j) => j === i ? { ...x, birth_year: Number(e.target.value) } : x))} />
              <label className="text-sm flex items-center gap-1">
                <input type="checkbox" checked={c.is_disabled}
                  onChange={(e) => setChildren((arr) => arr.map((x, j) => j === i ? { ...x, is_disabled: e.target.checked } : x))} />
                נכה
              </label>
              <button type="button" className="text-red-600 text-sm"
                onClick={() => setChildren((arr) => arr.filter((_, j) => j !== i))}>הסר</button>
            </div>
          ))}
          {children.length === 0 && <p className="text-slate-400 text-sm">לא הוזנו ילדים</p>}
        </div>

        {/* Spouse */}
        {hasSpouse && (
          <div className="card grid grid-cols-1 md:grid-cols-2 gap-4">
            <h2 className="font-semibold md:col-span-2">פרטי בן/בת זוג</h2>
            <div>
              <label className="label">שם</label>
              <input className="input" value={spouse.name}
                onChange={(e) => setSpouse((s) => ({ ...s, name: e.target.value }))} />
            </div>
            <div>
              <label className="label">מספר זהות</label>
              <input className="input" dir="ltr" value={spouse.id_number}
                onChange={(e) => setSpouse((s) => ({ ...s, id_number: e.target.value }))} />
            </div>
            <div>
              <label className="label">מין</label>
              <select className="input" value={spouse.gender}
                onChange={(e) => setSpouse((s) => ({ ...s, gender: e.target.value }))}>
                <option value="female">אישה</option>
                <option value="male">גבר</option>
              </select>
            </div>
            <div>
              <label className="label">שנת לידה</label>
              <input className="input" type="number" value={spouse.birth_year}
                onChange={(e) => setSpouse((s) => ({ ...s, birth_year: e.target.value }))} />
            </div>
          </div>
        )}

        {error && <div className="text-red-600">{error}</div>}
        <button className="btn-primary" disabled={saving}>{saving ? "שומר..." : "צור תיק"}</button>
      </form>
    </Shell>
  );
}
