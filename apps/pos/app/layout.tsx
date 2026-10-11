import type { Metadata } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import PwaBootstrap from "./PwaBootstrap";
import LocaleToggle from "./LocaleToggle";

export const metadata: Metadata = {
  title: "Lingo POS",
  description: "Lingo Store point of sale",
  robots: { index: false, follow: false },
  manifest: "/manifest.webmanifest",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = (await cookies()).get("lingo_locale")?.value === "ar" ? "ar" : "en";
  return (
    <html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"}>
      <body>
        <PwaBootstrap />
        {children}
        <LocaleToggle />
      </body>
    </html>
  );
}
