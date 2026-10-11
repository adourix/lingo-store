import { NextResponse } from "next/server";

export function middleware(req: Request) {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const nonce = btoa(String.fromCharCode(...bytes));
  const isDev = process.env.NODE_ENV !== "production";
  const csp =
    "default-src 'self'; script-src 'self' 'nonce-" +
    nonce +
    "' https://challenges.cloudflare.com" +
    (isDev ? " 'unsafe-eval'" : "") +
    "; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https://challenges.cloudflare.com; frame-src 'self' https://challenges.cloudflare.com; font-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";
  const headers = new Headers(req.headers);
  headers.set("x-nonce", nonce);
  const pathname = new URL(req.url).pathname;

  // The API is reached through the Next.js rewrite in development. The API
  // validates the public surface host/origin, so preserve PUBLIC_ORIGIN on
  // the internal proxied request while keeping the browser on localhost.
  if (isDev && pathname.startsWith("/api/")) {
    const publicOrigin = process.env.PUBLIC_ORIGIN?.trim();
    if (publicOrigin) {
      try {
        const publicUrl = new URL(publicOrigin);
        headers.set("x-forwarded-host", publicUrl.host);
        headers.set("origin", publicOrigin.replace(/\/$/, ""));
      } catch {
        // Invalid development configuration is handled by the API itself.
      }
    }
  }

  const res = NextResponse.next({ request: { headers } });
  res.headers.set("Content-Security-Policy", csp);
  if (
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    pathname === "/verify-email"
  ) {
    res.headers.set("Referrer-Policy", "no-referrer");
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
