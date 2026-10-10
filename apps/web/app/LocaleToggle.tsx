"use client";

import { useEffect, useState } from "react";

const COOKIE = "lingo_locale";

type Locale = "en" | "ar";

function readLocale(): Locale {
  return document.cookie.split(";").some((part) => part.trim() === `${COOKIE}=ar`) ? "ar" : "en";
}

export default function LocaleToggle() {
  const [locale, setLocale] = useState<Locale>("en");

  useEffect(() => setLocale(readLocale()), []);

  const next = locale === "en" ? "ar" : "en";
  return (
    <button
      type="button"
      aria-label={locale === "en" ? "Switch to Arabic" : "Switch to English"}
      onClick={() => {
        document.cookie = `${COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
        window.location.reload();
      }}
      style={{
        position: "fixed",
        insetInlineEnd: 18,
        bottom: 18,
        zIndex: 100,
        border: "1px solid #d8e0ea",
        borderRadius: 999,
        background: "white",
        color: "#101828",
        padding: "9px 13px",
        fontWeight: 700,
        boxShadow: "0 8px 24px rgb(16 24 40 / 0.12)",
      }}
    >
      {next === "ar" ? "العربية" : "English"}
    </button>
  );
}
