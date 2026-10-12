import type { ReactNode } from "react";
import type { Metadata } from "next";
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
import "./shop-reference.css";
import "./shop-results-fix.css";
import "./shop-product-grid-fix.css";
import "./homepage-polish.css";
import "./homepage-feature-icons.css";
import "./home-catalog-alignment.css";
import "./homepage-balance.css";
import "./checkout.css";
import "./checkout-rtl.css";
import "./site-wide-responsive.css";
import "./viewport-fill.css";
import "./account-polish.css";
import "./responsive-final.css";
import "./homepage-catalog-fix.css";
import "./homepage-explore-align.css";
import "./homepage-explore-five.css";
import "./cart-badge.css";
import CsrfBootstrap from "./csrf-bootstrap";
import CheckoutFormBinder from "./CheckoutFormBinder";
import LocaleToggle from "./LocaleToggle";
import SiteNavActive from "./SiteNavActive";
import CartBadgeSync from "./CartBadgeSync";
import CartRecommendationsSync from "./CartRecommendationsSync";

export const metadata: Metadata = {
  title: "Lingo Store",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = (await cookies()).get("lingo_locale")?.value === "ar" ? "ar" : "en";
  return (
    <html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"}>
      <body>
        <CsrfBootstrap />
        <CheckoutFormBinder />
        <CartBadgeSync />
        <CartRecommendationsSync />
        {children}
        <SiteNavActive />
        <LocaleToggle />
      </body>
    </html>
  );
}
