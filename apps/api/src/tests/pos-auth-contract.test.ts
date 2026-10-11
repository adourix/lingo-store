import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const here = dirname(fileURLToPath(import.meta.url));
const read = (path: string) => readFileSync(resolve(here, path), "utf8");
const server = read("../server.ts");
const routePolicy = read("../route-policy.ts");
const originPolicy = read("../origin-policy.ts");
const websocket = read("../ws.ts");
const posApi = read("../../../pos/lib/api.ts");
const posStore = read("../../../pos/lib/store.ts");
const posShell = read("../../../pos/app/PosShell.tsx");
const schema = read("../../../../prisma/schema.prisma");

const loginStart = server.indexOf('app.post<ApiRouteGeneric>(\n  "/api/pos/auth/login"');
const unlockStart = server.indexOf('app.post<ApiRouteGeneric>(\n  "/api/pos/auth/unlock"', loginStart);
const loginRoute = server.slice(loginStart, unlockStart);
const csrfStart = server.indexOf("const csrf = async");
const originStart = server.indexOf("const origin = async", csrfStart);
const csrfGuard = server.slice(csrfStart, originStart);
const originEnd = server.indexOf("const csrfEndpoint =", originStart);
const originGuard = server.slice(originStart, originEnd);

test("POS login reads the terminal credential only from the HttpOnly cookie", () => {
  assert.match(loginRoute, /req\.cookies\[POS_TERMINAL_COOKIE\]/);
  assert.doesNotMatch(loginRoute, /x-device-credential|authorization/i);
});

test("POS login persists SessionKind.POS with staff and terminal binding", () => {
  assert.match(loginRoute, /kind:\s*SessionKind\.POS/);
  assert.match(loginRoute, /staffUserId:\s*user\.id/);
  assert.match(loginRoute, /terminalId:\s*terminal\.id/);
  assert.match(loginRoute, /tokenHash:\s*sha\(sessionId\)/);
});

test("POS login returns only safe user and terminal information", () => {
  assert.match(loginRoute, /return\s*\{[\s\S]*user:\s*\{[\s\S]*terminal:/);
  assert.doesNotMatch(loginRoute, /accessToken|refreshToken|deviceCredential/);
});

test("POS browser session cookie is Secure, HttpOnly, Strict, host-only, and root-scoped", () => {
  assert.match(server, /const cookieOpts = \{\s*httpOnly:\s*true,[\s\S]*secure:\s*true,[\s\S]*sameSite:\s*"strict" as const,[\s\S]*path:\s*"\/",/);
  assert.doesNotMatch(server.slice(server.indexOf("const cookieOpts"), server.indexOf("const customerCookieOpts")), /domain:/i);
  assert.match(loginRoute, /reply\.setCookie\("__Host-lingo_pos_sid", sessionId/);
});

test("POS /me uses the cookie-session pre-handler", () => {
  const start = server.indexOf('app.get<ApiRouteGeneric>(\n  "/api/pos/auth/me"');
  const end = server.indexOf('app.post<ApiRouteGeneric>(\n  "/api/pos/auth/logout"', start);
  const route = server.slice(start, end);
  assert.match(route, /preHandler:\s*pos/);
  assert.doesNotMatch(route, /authorization|Bearer/i);
});

test("POS logout revokes the current PostgreSQL session and clears the SID", () => {
  const start = server.indexOf('app.post<ApiRouteGeneric>(\n  "/api/pos/auth/logout"');
  const end = server.indexOf('app.get<ApiRouteGeneric>("/api/pos/products"', start);
  const route = server.slice(start, end);
  assert.match(route, /prisma\.session\.updateMany/);
  assert.match(route, /tokenHash:\s*sha\(raw\)/);
  assert.match(route, /kind:\s*SessionKind\.POS/);
  assert.match(route, /reply\.clearCookie\(POS_SESSION_COOKIE/);
  assert.doesNotMatch(route, /clearCookie\(POS_TERMINAL_COOKIE/);
});

test("POS session validator checks kind, revocation, expiry, staff, and terminal", () => {
  assert.match(server, /if \(!isActivePosSession\(session, now\)\) return null/);
  assert.match(read("../pos-auth-policy.ts"), /session\.kind !== SessionKind\.POS/);
  assert.match(read("../pos-auth-policy.ts"), /session\.revokedAt/);
});

test("POS idle and absolute timeout constants are applied to new sessions", () => {
  assert.match(loginRoute, /posSessionExpiries\(now\)/);
  assert.match(loginRoute, /expiresAt,/);
  assert.match(loginRoute, /idleExpiresAt,/);
  assert.match(read("../pos-auth-policy.ts"), /POS_SESSION_IDLE_MS = 30 \* 60 \* 1000/);
  assert.match(read("../pos-auth-policy.ts"), /POS_SESSION_ABSOLUTE_MS = 12 \* 60 \* 60 \* 1000/);
});

test("terminal credential rotation keeps only the new hash and a bounded previous hash", () => {
  assert.match(loginRoute, /credentialHash:\s*sha\(rotatedCredential\)/);
  assert.match(loginRoute, /previousCredentialHash:\s*sha\(rawCredential!\)/);
  assert.match(loginRoute, /previousCredentialExpiresAt:[\s\S]*POS_TERMINAL_CREDENTIAL_TTL_SECONDS/);
  assert.match(loginRoute, /reply\.setCookie\("__Host-lingo_pos_terminal", rotatedCredential/);
  assert.match(server, /previousCredentialExpiresAt:[\s\S]*POS_TERMINAL_CREDENTIAL_TTL_SECONDS/);

test("stale terminal credential reuse disables the terminal and revokes POS sessions", () => {
  assert.match(loginRoute, /previousCredentialHash:\s*sha\(rawCredential\)/);
  assert.match(loginRoute, /previousCredentialExpiresAt:\s*\{\s*gt:\s*new Date\(\)\s*\}/);
  assert.match(loginRoute, /isActive:\s*false/);
  assert.match(loginRoute, /kind:\s*SessionKind\.POS, revokedAt:\s*null/);
  assert.match(loginRoute, /action:\s*"device\.credential\.stale"/);
  assert.match(loginRoute, /TERMINAL_REENROLLMENT_REQUIRED/);
});

test("terminal enrollment returns no device credential to JavaScript", () => {
  const start = server.indexOf('app.post<ApiRouteGeneric>(\n  "/api/pos/auth/enroll"');
  const end = server.indexOf('app.post<ApiRouteGeneric>(\n  "/api/pos/auth/login"', start);
  const route = server.slice(start, end);
  assert.match(route, /reply\.setCookie\(POS_TERMINAL_COOKIE, credential/);
  assert.match(route, /return \{ terminal: \{ id: terminal\.id, name: terminal\.name \} \}/);
  assert.doesNotMatch(route, /deviceCredential|accessToken|refreshToken/);
});

test("terminal credential cookie has a 180-day lifetime", () => {
  assert.match(read("../pos-auth-policy.ts"), /POS_TERMINAL_CREDENTIAL_TTL_SECONDS = 180 \* 24 \* 60 \* 60/);
  assert.match(loginRoute, /maxAge:\s*POS_TERMINAL_CREDENTIAL_TTL_SECONDS/);
});

test("POS CSRF bootstrap route is registered and returns a cookie-backed token", () => {
  assert.match(server, /app\.get<ApiRouteGeneric>\("\/api\/pos\/auth\/csrf", csrfEndpoint\)/);
  assert.match(routePolicy, /"GET \/api\/pos\/auth\/csrf"/);
  assert.match(server, /reply\.setCookie\(cookieName, value/);
  assert.match(server, /return \{ token: value \}/);
});

test("POS mutations require double-submit CSRF and the custom header", () => {
  assert.match(server, /const mutating = \["POST", "PUT", "PATCH", "DELETE"\]/);
  assert.match(csrfGuard, /req\.cookies\[csrfName\]/);
  assert.match(csrfGuard, /req\.headers\["x-csrf-token"\]/);
  assert.match(csrfGuard, /csrfDoubleSubmitIsValid\(cookieToken, headerToken\)/);
  assert.doesNotMatch(csrfGuard, /startsWith\("\/api\/pos\/"\)\) return true/);
});

test("POS bootstrap exemptions are narrow and do not exempt the whole route family", () => {
  const start = server.indexOf("const csrfExempt =");
  const end = server.indexOf("const jsonOnly =", start);
  const exemptions = server.slice(start, end);
  assert.match(exemptions, /p === "\/api\/pos\/auth\/login"/);
  assert.match(exemptions, /p === "\/api\/pos\/auth\/enroll"/);
  assert.doesNotMatch(exemptions, /p\.startsWith\("\/api\/pos\/"\)\) return true/);
});

test("all state-changing API requests require JSON bodies", () => {
  assert.match(server, /const jsonOnly = async/);
  assert.match(server, /req\.headers\["content-type"\]/);
  assert.match(server, /application\/json/);
  assert.match(server, /JSON_REQUIRED/);
});

test("POS mutations enforce the configured origin, Referer fallback, and Fetch Metadata", () => {
  assert.match(originGuard, /\?\s*posOrigin/);
  assert.match(originGuard, /requestOrigin !== expected/);
  assert.match(originGuard, /req\.headers\.referer/);
  assert.match(originGuard, /req\.headers\["sec-fetch-site"\]/);
  assert.match(originGuard, /CROSS_SITE_FORBIDDEN/);
  assert.match(originPolicy, /requestOrigin !== configuredPosOrigin/);
});

test("obsolete POS refresh route is absent from server and route policy", () => {
  assert.doesNotMatch(server, /app\.post<ApiRouteGeneric>\([\s\S]{0,80}"\/api\/pos\/auth\/refresh"/);
  assert.doesNotMatch(routePolicy, /"POST \/api\/pos\/auth\/refresh"/);
});

test("POS WebSocket uses the same cookie-backed session and active terminal", () => {
  assert.match(websocket, /cookieValue\(String\(request\.headers\.cookie[^\n]*POS_SESSION_COOKIE/);
  assert.match(websocket, /kind:\s*SessionKind\.POS/);
  assert.match(websocket, /isActivePosSession\(session, new Date\(\)\)/);
  assert.match(websocket, /async function isStillAuthorized/);
  assert.match(websocket, /terminal: \{ isActive: true \}/);
});

test("POS frontend includes cookies and the CSRF header on mutations", () => {
  assert.match(posApi, /credentials:\s*"include"/);
  assert.match(posApi, /fetch\(\`\$\{API\}\/pos\/auth\/csrf/);
  assert.match(posApi, /headers\.set\("x-csrf-token"/);
  assert.match(posApi, /credentials:\s*"include"/);
});

test("POS frontend does not use bearer, access-token, or device-credential auth", () => {
  assert.doesNotMatch(posApi, /Authorization\s*:\s*["']?Bearer|accessToken|deviceCredential|deviceSession/i);
  assert.doesNotMatch(posShell, /deviceCredential|accessToken|Authorization\s*:\s*Bearer/i);
  assert.doesNotMatch(posStore, /accessToken|deviceCredential|Authorization\s*:\s*Bearer/i);
});

test("legacy IndexedDB credential keys are removed without deleting offline business data", () => {
  assert.match(posStore, /store\.delete\("device"\)/);
  assert.match(posStore, /store\.delete\("state"\)/);
  assert.match(posStore, /store\.delete\("tokens"\)/);
  assert.match(posStore, /const QUEUE_KEY = "queue"/);
  assert.match(posStore, /const CATALOG_KEY = "catalog"/);
  assert.doesNotMatch(posStore, /localStorage\.(?:getItem|setItem)|sessionStorage\.(?:getItem|setItem)/);
});

test("POS frontend stores no credentials in Web Storage or document cookies", () => {
  assert.doesNotMatch(posApi, /localStorage\.|sessionStorage\.|document\.cookie/);
  assert.doesNotMatch(posShell, /localStorage\.(?:getItem|setItem)|sessionStorage\.(?:getItem|setItem)/);
  assert.doesNotMatch(posStore, /localStorage\.|sessionStorage\.|document\.cookie/);
});

test("PostgreSQL reuses the existing Session model and POS enum", () => {
  assert.match(schema, /enum SessionKind\s*\{[^}]*POS/s);
  assert.match(schema, /model Session\s*\{[^}]*tokenHash String @unique/s);
  assert.match(schema, /model Session\s*\{[^}]*terminalId String\?/s);
  assert.match(schema, /model Session\s*\{[^}]*staffUserId String\?/s);
});
