import type { Metadata } from "next";
import "./globals.css";
import "./visual-polish.css";
import "./final-ui.css";
import "./reference-pos.css";
import "./reference-pos-v2.css";
import PwaBootstrap from "./PwaBootstrap";
import LocaleToggle from "./LocaleToggle";

// The POS root is an authenticated application shell. It must never be
// prerendered/shared-cached as a static HTML document because its bootstrap
// depends on the current HttpOnly auth cookie and Next.js RSC state.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Lingo POS",
  description: "Lingo Store point of sale",
  robots: { index: false, follow: false },
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" dir="ltr">
      <body>
        <PwaBootstrap />
        {children}
        <LocaleToggle />
      </body>
    </html>
  );
}
