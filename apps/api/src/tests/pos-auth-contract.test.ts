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
const sessionPolicy = read("../pos-auth-policy.ts");
const schema = read("../../../../prisma/schema.prisma");

test("POS browser auth uses the opaque HttpOnly session cookie", () => {
  assert.ok(server.includes("const raw = req.cookies[POS_SESSION_COOKIE];"));
  assert.ok(server.includes("where: { tokenHash: sha(raw) }"));
  assert.ok(server.includes("kind: SessionKind.POS"));
  assert.ok(server.includes("isActivePosSession(session, now)"));
  assert.ok(/setCookie\((?:POS_SESSION_COOKIE|[\"']__Host-lingo_pos_sid[\"'])/.test(server));
  assert.ok(!/Authorization.*Bearer|Bearer\s/.test(server));
});

test("POS login only returns safe user and terminal details", () => {
  const start = server.indexOf('"/api/pos/auth/login"');
  const end = server.indexOf('"/api/pos/auth/unlock"', start);
  assert.ok(start >= 0 && end > start);
  const route = server.slice(start, end);
  assert.ok(route.includes("kind: SessionKind.POS"));
  assert.ok(route.includes("staffUserId: user.id"));
  assert.ok(route.includes("terminalId: terminal.id"));
  assert.ok(route.includes("tokenHash: sha(sessionId)"));
  assert.ok(route.includes("user: { id: user.id"));
  assert.ok(route.includes("terminal: { id: terminal.id"));
  assert.ok(!/accessToken|refreshToken|deviceCredential/.test(route));
});

test("POS session policy enforces idle and absolute expiries and bindings", () => {
  assert.ok(sessionPolicy.includes("POS_SESSION_IDLE_MS = 30 * 60 * 1000"));
  assert.ok(sessionPolicy.includes("POS_SESSION_ABSOLUTE_MS = 12 * 60 * 60 * 1000"));
  assert.ok(sessionPolicy.includes("session.revokedAt"));
  assert.ok(sessionPolicy.includes("session.kind !== SessionKind.POS"));
  assert.ok(sessionPolicy.includes("session.staffUser.id !== session.staffUserId"));
  assert.ok(sessionPolicy.includes("session.terminal.id !== session.terminalId"));
  assert.ok(server.includes("posSessionExpiries(now)"));
});

test("POS login rotates terminal credentials, revokes prior sessions, and audits stale reuse", () => {
  assert.ok(server.includes("credentialHash: sha(rotatedCredential)"));
  assert.ok(server.includes("previousCredentialHash: sha(rawCredential!)"));
  assert.ok(server.includes("previousCredentialExpiresAt:"));
  assert.ok(server.includes("POS_TERMINAL_CREDENTIAL_TTL_SECONDS"));
  assert.ok(server.includes('action: "device.credential.stale"'));
  assert.ok(server.includes("TERMINAL_REENROLLMENT_REQUIRED"));
  assert.ok(
    /setCookie\((?:POS_TERMINAL_COOKIE|[\"']__Host-lingo_pos_terminal[\"']), rotatedCredential/.test(
      server,
    ),
  );
});

test("POS enrollment never returns terminal credentials to browser JavaScript", () => {
  const start = server.indexOf('"/api/pos/auth/enroll"');
  const end = server.indexOf('"/api/pos/auth/login"', start);
  assert.ok(start >= 0 && end > start);
  const route = server.slice(start, end);
  assert.ok(route.includes("reply.setCookie(POS_TERMINAL_COOKIE, credential"));
  assert.ok(route.includes("return { terminal: { id: terminal.id, name: terminal.name } }"));
  assert.ok(!/deviceCredential|accessToken|refreshToken/.test(route));
  assert.ok(sessionPolicy.includes("POS_TERMINAL_CREDENTIAL_TTL_SECONDS = 180 * 24 * 60 * 60"));
});

test("POS logout revokes the PostgreSQL session and preserves terminal enrollment", () => {
  const start = server.indexOf('"/api/pos/auth/logout"');
  const end = server.indexOf('"/api/pos/products"', start);
  assert.ok(start >= 0 && end > start);
  const route = server.slice(start, end);
  assert.ok(route.includes("prisma.session.updateMany"));
  assert.ok(route.includes("kind: SessionKind.POS"));
  assert.ok(route.includes("reply.clearCookie(POS_SESSION_COOKIE"));
  assert.ok(!route.includes("clearCookie(POS_TERMINAL_COOKIE"));
});

test("POS CSRF bootstrap exists and mutating requests require a matching custom header", () => {
  assert.ok(server.includes('"/api/pos/auth/csrf"'));
  assert.ok(routePolicy.includes('"GET /api/pos/auth/csrf"'));
  assert.ok(server.includes("csrfDoubleSubmitIsValid(cookieToken, headerToken)"));
  assert.ok(server.includes('req.headers["x-csrf-token"]'));
  assert.ok(!server.includes('if (p.startsWith("/api/pos/")) return true;'));
  assert.ok(server.includes("JSON_REQUIRED"));
});

test("POS mutation origin requires configured origin or matching Referer", () => {
  assert.ok(originPolicy.includes("requestOrigin !== configuredPosOrigin"));
  assert.ok(originPolicy.includes('fetchSite === "cross-site"'));
  assert.ok(server.includes("req.headers.referer"));
  assert.ok(server.includes('req.headers["sec-fetch-site"]'));
});

test("obsolete POS refresh endpoint is removed from both routes and policy", () => {
  assert.ok(!server.includes('"/api/pos/auth/refresh"'));
  assert.ok(!routePolicy.includes('"POST /api/pos/auth/refresh"'));
});

test("POS WebSocket validates the same cookie-backed POS session and terminal", () => {
  assert.ok(websocket.includes("POS_SESSION_COOKIE"));
  assert.ok(websocket.includes("kind: SessionKind.POS"));
  assert.ok(websocket.includes("isActivePosSession(session, new Date())"));
  assert.ok(websocket.includes("async function isStillAuthorized"));
});

test("POS frontend uses cookies and CSRF without browser auth credential storage", () => {
  assert.ok(posApi.includes('credentials: "include"'));
  assert.ok(posApi.includes('headers.set("x-csrf-token"'));
  assert.ok(posApi.includes("/pos/auth/csrf"));
  assert.ok(
    !/Authorization\s*:\s*["']?Bearer|accessToken|deviceCredential|deviceSession/i.test(
      posApi + posShell + posStore,
    ),
  );
  assert.ok(
    !/localStorage\.(?:getItem|setItem)|sessionStorage\.(?:getItem|setItem)|document\.cookie/.test(
      posApi + posShell + posStore,
    ),
  );
});

test("Prisma reuses Session and SessionKind.POS instead of adding duplicate auth models", () => {
  assert.ok(/enum SessionKind\s*\{[^}]*POS/s.test(schema));
  assert.ok(/model Session\s*\{[^}]*tokenHash String @unique/s.test(schema));
  assert.ok(/model Session\s*\{[^}]*terminalId String\?/s.test(schema));
  assert.ok(/model Session\s*\{[^}]*staffUserId String\?/s.test(schema));
});
