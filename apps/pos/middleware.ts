import { NextResponse } from "next/server";

export function middleware(request: Request) {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const nonce = btoa(String.fromCharCode(...bytes));
  const dev = process.env.NODE_ENV !== "production";
  const policy = dev
    ? "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' ws: wss:; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"
    : [
        "default-src 'self'",
        `script-src 'self' 'nonce-${nonce}'`,
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "connect-src 'self' ws: wss:",
        "object-src 'none'",
        "base-uri 'none'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        "upgrade-insecure-requests",
      ].join("; ");
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", policy);
  response.headers.set("X-Robots-Tag", "noindex, nofollow");

  // POS HTML and App Router/RSC responses are user/session dependent and must
  // never be stored in a shared cache. Static _next assets are excluded by the
  // matcher and remain normally cacheable.
  response.headers.set("Cache-Control", "private, no-store, no-cache, max-age=0, must-revalidate");
  response.headers.set("CDN-Cache-Control", "no-store");
  response.headers.set("Cloudflare-CDN-Cache-Control", "no-store");

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
