"use client";
import { useEffect } from "react";
export default function CsrfBootstrap() {
  useEffect(() => {
    let token = "";
    const original = window.fetch.bind(window);
    const load = async () => {
      try {
        const r = await original("/api/admin/auth/csrf", { credentials: "include" });
        if (r.ok) token = (await r.json()).token;
      } catch {}
    };
    void load();
    window.fetch = async (input, init = {}) => {
      const url = typeof input === "string" ? input : input instanceof Request ? input.url : "";
      const method = (init.method || "GET").toUpperCase();
      if (
        token &&
        url.startsWith("/api/admin/") &&
        ["POST", "PUT", "PATCH", "DELETE"].includes(method)
      ) {
        const headers = new Headers(init.headers || {});
        if (!headers.has("x-csrf-token")) headers.set("x-csrf-token", token);
        init = { ...init, headers, credentials: init.credentials || "include" };
      }
      return original(input, init);
    };
    return () => {
      window.fetch = original;
    };
  }, []);
  return null;
}
