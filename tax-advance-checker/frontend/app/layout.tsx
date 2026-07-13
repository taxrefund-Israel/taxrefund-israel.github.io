import "./globals.css";
import type { Metadata } from "next";
import { AuthProvider } from "@/lib/auth";

export const metadata: Metadata = {
  title: "בדיקת מקדמות לשנת 2026 — משרד רו״ח ברשף",
  description: "מערכת פנימית לבדיקת התאמת מקדמות מס הכנסה וביטוח לאומי",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
