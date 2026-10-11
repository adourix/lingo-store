import type { ReactNode } from "react";
import { cookies } from "next/headers";
import "./globals.css";
import "./catalog.css";
import "./visual-polish.css";
import CsrfBootstrap from "./csrf-bootstrap";
import LocaleToggle from "./LocaleToggle";

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = (await cookies()).get("lingo_locale")?.value === "ar" ? "ar" : "en";
  return (
    <html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"}>
      <body>
        <CsrfBootstrap />
        {children}
        <LocaleToggle />
      </body>
    </html>
  );
}
