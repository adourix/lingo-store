import assert from "node:assert/strict";
import test from "node:test";
import {
  POS_CSRF_COOKIE,
  POS_SESSION_ABSOLUTE_MS,
  POS_SESSION_COOKIE,
  POS_SESSION_IDLE_MS,
  POS_TERMINAL_COOKIE,
  POS_TERMINAL_CREDENTIAL_TTL_SECONDS,
  csrfDoubleSubmitIsValid,
  isActivePosSession,
  posSessionExpiries,
} from "../pos-auth-policy.js";
import { SessionKind, SessionState, StaffStatus } from "@prisma/client";

const now = new Date("2026-10-11T00:00:00.000Z");

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    kind: SessionKind.POS,
    state: SessionState.ACTIVE,
    revokedAt: null,
    expiresAt: new Date(now.getTime() + POS_SESSION_ABSOLUTE_MS),
    idleExpiresAt: new Date(now.getTime() + POS_SESSION_IDLE_MS),
    staffUserId: "staff-1",
    terminalId: "terminal-1",
    staffUser: { id: "staff-1", isActive: true, status: StaffStatus.ACTIVE },
    terminal: { id: "terminal-1", isActive: true },
    ...overrides,
  };
}

test("POS session policy accepts an active matching cookie session", () => {
  assert.equal(isActivePosSession(makeSession(), now), true);
});

test("POS authentication rejects a session with the wrong kind or state", () => {
  assert.equal(isActivePosSession(makeSession({ kind: SessionKind.ADMIN }), now), false);
  assert.equal(isActivePosSession(makeSession({ state: SessionState.PENDING_MFA }), now), false);
});

test("POS authentication rejects revoked and absolutely expired sessions", () => {
  assert.equal(isActivePosSession(makeSession({ revokedAt: now }), now), false);
  assert.equal(isActivePosSession(makeSession({ expiresAt: now }), now), false);
});

test("POS authentication rejects idle-expired sessions", () => {
  assert.equal(isActivePosSession(makeSession({ idleExpiresAt: now }), now), false);
});

test("POS authentication requires an active staff user and an active terminal", () => {
  assert.equal(isActivePosSession(makeSession({ staffUser: { id: "staff-1", isActive: false, status: StaffStatus.ACTIVE } }), now), false);
  assert.equal(isActivePosSession(makeSession({ staffUser: { id: "staff-1", isActive: true, status: StaffStatus.DISABLED } }), now), false);
  assert.equal(isActivePosSession(makeSession({ terminal: { id: "terminal-1", isActive: false } }), now), false);
});

test("POS authentication enforces staff and terminal foreign-key bindings", () => {
  assert.equal(isActivePosSession(makeSession({ staffUser: { id: "staff-2", isActive: true, status: StaffStatus.ACTIVE } }), now), false);
  assert.equal(isActivePosSession(makeSession({ terminal: { id: "terminal-2", isActive: true } }), now), false);
  assert.equal(isActivePosSession(makeSession({ staffUserId: null }), now), false);
  assert.equal(isActivePosSession(makeSession({ terminalId: null }), now), false);
});

test("POS session expiry policy is 30 minutes idle and 12 hours absolute", () => {
  const expiries = posSessionExpiries(now);
  assert.equal(POS_SESSION_IDLE_MS, 30 * 60 * 1000);
  assert.equal(POS_SESSION_ABSOLUTE_MS, 12 * 60 * 60 * 1000);
  assert.equal(expiries.idleExpiresAt.getTime() - now.getTime(), POS_SESSION_IDLE_MS);
  assert.equal(expiries.expiresAt.getTime() - now.getTime(), POS_SESSION_ABSOLUTE_MS);
});

test("terminal credential uses a 180-day lifetime and dedicated host cookies", () => {
  assert.equal(POS_TERMINAL_CREDENTIAL_TTL_SECONDS, 180 * 24 * 60 * 60);
  assert.equal(POS_SESSION_COOKIE, "__Host-lingo_pos_sid");
  assert.equal(POS_TERMINAL_COOKIE, "__Host-lingo_pos_terminal");
  assert.equal(POS_CSRF_COOKIE, "__Host-lingo_pos_csrf");
});

test("CSRF double-submit accepts only a matching non-empty cookie and header", () => {
  assert.equal(csrfDoubleSubmitIsValid("csrf-token", "csrf-token"), true);
  assert.equal(csrfDoubleSubmitIsValid(undefined, "csrf-token"), false);
  assert.equal(csrfDoubleSubmitIsValid("csrf-token", undefined), false);
  assert.equal(csrfDoubleSubmitIsValid("", ""), false);
  assert.equal(csrfDoubleSubmitIsValid("cookie-token", "header-token"), false);
});
