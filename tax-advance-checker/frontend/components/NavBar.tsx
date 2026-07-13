"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";

export default function NavBar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  const links = [
    { href: "/dashboard", label: "לוח בקרה" },
    { href: "/cases", label: "תיקי בדיקה" },
  ];
  const adminLinks = [
    { href: "/admin/users", label: "משתמשים" },
    { href: "/admin/tax-params", label: "פרמטרי מס" },
    { href: "/admin/audit-log", label: "יומן פעולות" },
  ];

  return (
    <nav className="bg-brand text-white shadow">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-14">
        <div className="flex items-center gap-1">
          <span className="font-bold ml-4 leading-tight">בדיקת מקדמות לשנת 2026<br /><span className="text-xs font-normal opacity-80">משרד רו״ח ברשף</span></span>
          {links.map((l) => (
            <Link key={l.href} href={l.href}
              className={`px-3 py-1.5 rounded ${pathname.startsWith(l.href) ? "bg-white/20" : "hover:bg-white/10"}`}>
              {l.label}
            </Link>
          ))}
          {user?.role === "admin" &&
            adminLinks.map((l) => (
              <Link key={l.href} href={l.href}
                className={`px-3 py-1.5 rounded text-sm ${pathname.startsWith(l.href) ? "bg-white/20" : "hover:bg-white/10"}`}>
                {l.label}
              </Link>
            ))}
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="opacity-80">{user?.full_name}</span>
          <button onClick={logout} className="bg-white/15 hover:bg-white/25 rounded px-3 py-1.5">
            יציאה
          </button>
        </div>
      </div>
    </nav>
  );
}
