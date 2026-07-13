"use client";

import NavBar from "./NavBar";
import { useRequireAuth } from "@/lib/auth";

export default function Shell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useRequireAuth();
  if (loading) return <div className="p-10 text-center text-slate-500">טוען...</div>;
  if (!user) return null;
  return (
    <div className="min-h-screen">
      <NavBar />
      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
