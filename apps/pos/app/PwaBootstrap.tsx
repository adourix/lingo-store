"use client";

import { useEffect } from "react";

const LOCALE_COOKIE = "lingo_locale";

function readLocale() {
  return document.cookie.split(";").some((part) => part.trim() === `${LOCALE_COOKIE}=ar`) ? "ar" : "en";
}

export default function PwaBootstrap() {
  useEffect(() => {
    const locale = readLocale();
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";

    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);
  return null;
}
