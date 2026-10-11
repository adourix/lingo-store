import { SessionKind, SessionState, StaffStatus } from "@prisma/client";

export const POS_SESSION_IDLE_MS = 30 * 60 * 1000;
export const POS_SESSION_ABSOLUTE_MS = 12 * 60 * 60 * 1000;
export const POS_TERMINAL_CREDENTIAL_TTL_SECONDS = 180 * 24 * 60 * 60;
export const POS_TERMINAL_CREDENTIAL_TTL_MS = POS_TERMINAL_CREDENTIAL_TTL_SECONDS * 1000;

export const POS_SESSION_COOKIE = "__Host-lingo_pos_sid";
export const POS_TERMINAL_COOKIE = "__Host-lingo_pos_terminal";
export const POS_CSRF_COOKIE = "__Host-lingo_pos_csrf";

export type PosSessionCandidate = {
  kind: SessionKind;
  state: SessionState;
  revokedAt: Date | null;
  expiresAt: Date;
  idleExpiresAt: Date;
  staffUserId: string | null;
  terminalId: string | null;
  staffUser?: {
    id: string;
    isActive: boolean;
    status: StaffStatus;
  } | null;
  terminal?: {
    id: string;
    isActive: boolean;
  } | null;
};

export function isActivePosSession(
  session: PosSessionCandidate | null | undefined,
  now: Date = new Date(),
): session is PosSessionCandidate {
  if (!session) return false;
  if (session.kind !== SessionKind.POS || session.state !== SessionState.ACTIVE) return false;
  if (session.revokedAt || session.expiresAt <= now || session.idleExpiresAt <= now) return false;
  if (!session.staffUserId || !session.terminalId || !session.staffUser || !session.terminal) {
    return false;
  }
  if (
    session.staffUser.id !== session.staffUserId ||
    !session.staffUser.isActive ||
    session.staffUser.status !== StaffStatus.ACTIVE
  ) {
    return false;
  }
  if (session.terminal.id !== session.terminalId || !session.terminal.isActive) return false;
  return true;
}

export function posSessionExpiries(now: Date = new Date()): {
  expiresAt: Date;
  idleExpiresAt: Date;
} {
  return {
    expiresAt: new Date(now.getTime() + POS_SESSION_ABSOLUTE_MS),
    idleExpiresAt: new Date(now.getTime() + POS_SESSION_IDLE_MS),
  };
}

export function csrfDoubleSubmitIsValid(
  cookieToken: string | undefined,
  headerToken: string | undefined,
): boolean {
  return Boolean(cookieToken && headerToken && cookieToken === headerToken);
}
