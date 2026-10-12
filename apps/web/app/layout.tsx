import type { ReactNode } from "react";
import { cookies } from "next/headers";
import "./globals.css";
import "./catalog.css";
import "./visual-polish.css";
import "./storefront-polish.css";
import "./final-storefront.css";
import "./hero-match.css";
import "./hero-reference.css";
import "./hero-interaction.css";
import "./footer.css";
import "./about.css";
import "./contact.css";
import "./categories-polish.css";
import "./product-image-fixes.css";
import CsrfBootstrap from "./csrf-bootstrap";
import LocaleToggle from "./LocaleToggle";
import SiteNavActive from "./SiteNavActive";

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = (await cookies()).get("lingo_locale")?.value === "ar" ? "ar" : "en";
  return (
    <html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"}>
      <body>
        <CsrfBootstrap />
        {children}
        <SiteNavActive />
        <LocaleToggle />
      </body>
    </html>
  );
}
