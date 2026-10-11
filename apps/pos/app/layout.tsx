import type { Metadata } from "next";
import "./globals.css";
import "./visual-polish.css";
import PwaBootstrap from "./PwaBootstrap";
import LocaleToggle from "./LocaleToggle";

export const dynamic = "force-static";

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
