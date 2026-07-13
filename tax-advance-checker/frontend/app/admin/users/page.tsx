"use client";

import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import { api } from "@/lib/api";
import type { User } from "@/lib/types";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [form, setForm] = useState({ email: "", password: "", full_name: "", role: "employee" });
  const [msg, setMsg] = useState("");

  const reload = () => api.get<User[]>("/admin/users").then(setUsers).catch((e) => setMsg(e.message));
  useEffect(() => { reload(); }, []);

  async function create() {
    setMsg("");
    try {
      await api.post("/admin/users", form);
      setForm({ email: "", password: "", full_name: "", role: "employee" });
      reload();
    } catch (e: any) { setMsg(e.message); }
  }

  async function toggleActive(u: User) {
    await api.put(`/admin/users/${u.id}`, { is_active: !u.is_active });
    reload();
  }

  return (
    <Shell>
      <h1 className="text-2xl font-bold mb-4">ניהול משתמשים</h1>
      <div className="card grid grid-cols-1 md:grid-cols-5 gap-3 items-end mb-4">
        <div><label className="label">שם מלא</label>
          <input className="input" value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} /></div>
        <div><label className="label">מייל</label>
          <input className="input" dir="ltr" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></div>
        <div><label className="label">סיסמה</label>
          <input className="input" dir="ltr" type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} /></div>
        <div><label className="label">תפקיד</label>
          <select className="input" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
            <option value="employee">עובד</option><option value="admin">מנהל</option>
          </select></div>
        <button className="btn-primary" onClick={create}>הוסף משתמש</button>
      </div>
      {msg && <p className="text-red-600 text-sm mb-2">{msg}</p>}
      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead><tr><th>שם</th><th>מייל</th><th>תפקיד</th><th>פעיל</th><th></th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.full_name}</td>
                <td dir="ltr">{u.email}</td>
                <td>{u.role === "admin" ? "מנהל" : "עובד"}</td>
                <td>{u.is_active ? "✓" : "✗"}</td>
                <td><button className="text-brand text-sm" onClick={() => toggleActive(u)}>
                  {u.is_active ? "השבת" : "הפעל"}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
