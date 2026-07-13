"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const { login, user, loading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [loading, user, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email, password);
      router.replace("/dashboard");
    } catch (err: any) {
      setError(err.message || "התחברות נכשלה");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
      <div className="card w-full max-w-md">
        <h1 className="text-2xl font-bold text-brand mb-1 text-center">בדיקת מקדמות לשנת 2026</h1>
        <p className="text-base text-slate-700 font-medium text-center">משרד רו״ח ברשף</p>
        <p className="text-sm text-slate-500 mb-6 text-center">מערכת פנימית — כניסת עובדים</p>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="label">כתובת מייל</label>
            <input className="input" type="email" value={email} dir="ltr"
              onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="label">סיסמה</label>
            <input className="input" type="password" value={password} dir="ltr"
              onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <div className="text-red-600 text-sm">{error}</div>}
          <button className="btn-primary w-full" disabled={submitting}>
            {submitting ? "מתחבר..." : "כניסה"}
          </button>
        </form>
      </div>
    </div>
  );
}
