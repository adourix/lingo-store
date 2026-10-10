import type { ReactNode } from "react";
import "./globals.css";
import AdminChrome from "./AdminChrome";
import { headers, cookies } from "next/headers";
import { redirect } from "next/navigation";
import CsrfBootstrap from "./csrf-bootstrap";
import LocaleToggle from "./LocaleToggle";
const A = process.env.API_INTERNAL_URL || "http://127.0.0.1:4000";
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const h = await headers(),
    path = h.get("x-original-uri") || "/";
  const locale = (await cookies()).get("lingo_locale")?.value === "ar" ? "ar" : "en";
  const direction = locale === "ar" ? "rtl" : "ltr";
  if (
    path.startsWith("/login") ||
    path.startsWith("/mfa") ||
    path.startsWith("/setup") ||
    path.startsWith("/forgot-password") ||
    path.startsWith("/reset-password")
  )
    return (
      <html lang={locale} dir={direction}>
        <body>
          <CsrfBootstrap />
          {children}
          <LocaleToggle />
        </body>
      </html>
    );
  const c = (await cookies()).get("__Host-lingo_admin_sid")?.value;
  const r = c
    ? await fetch(A + "/api/admin/auth/me", {
        headers: {
          cookie: "__Host-lingo_admin_sid=" + c,
          host: new URL(process.env.ADMIN_ORIGIN || "https://admin.lingostore.example").host,
        },
        cache: "no-store",
      })
    : null;
  if (!r || r.status === 401) redirect("/login");
  if (r.status === 403)
    return (
      <html lang={locale} dir={direction}>
        <body>
          <main>
            <h1>Admin access denied</h1>
          </main>
          <LocaleToggle />
        </body>
      </html>
    );
  return (
    <html lang={locale} dir={direction}>
      <body>
        <CsrfBootstrap />
        <AdminChrome>{children}</AdminChrome>
        <LocaleToggle />
      </body>
    </html>
  );
}
