import type { FastifyInstance, FastifyRequest } from "fastify";
import { PrismaClient, SessionKind, Surface, StaffStatus } from "@prisma/client";
import { createHash } from "node:crypto";

const db = new PrismaClient();
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const tokenFromHeader = (request: FastifyRequest): string | null =>
  /^Bearer ([A-Za-z0-9_-]{32,})$/.exec(String(request.headers.authorization ?? ""))?.[1] ?? null;

function cookieValue(header: string, name: string): string | null {
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0 || part.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return null;
    }
  }
  return null;
}

async function permissionKeys(staffUserId: string): Promise<Set<string>> {
  const assignments = await db.staffRoleAssignment.findMany({
    where: { staffUserId },
    include: { role: { include: { permissions: { include: { permission: true } } } } },
  });
  return new Set(assignments.flatMap((assignment) =>
    assignment.role.permissions.map((entry) => entry.permission.key)));
}

const posPermissionCeiling = new Set([
  "pos.use", "products.view", "customers.view", "customers.manage", "sales.create",
  "sales.view", "sales.discount", "sales.void", "sales.refund", "sales.reprint",
  "payments.create", "cash_session.open", "cash_session.close", "approvals.grant",
]);

function subscriptionsFor(surface: Surface, permissions: Set<string>): string[] {
  if (surface === Surface.ADMIN) {
    return [
      permissions.has("dashboard.view") ? "dashboard" : null,
      permissions.has("sales.view") || permissions.has("sales.view_all") ? "sales" : null,
      permissions.has("inventory.view") ? "inventory" : null,
      permissions.has("audit.view") ? "alerts" : null,
    ].filter((channel): channel is string => channel !== null);
  }
  return [
    permissions.has("products.view") ? "catalog" : null,
    permissions.has("sales.view") || permissions.has("sales.create") ? "sales" : null,
    permissions.has("cash_session.open") || permissions.has("cash_session.close") ? "cash" : null,
  ].filter((channel): channel is string => channel !== null);
}

async function isStillAuthorized(
  surface: Surface,
  sessionId: string,
  staffUserId: string,
  terminalId: string | null,
  permissionFingerprint: string,
): Promise<boolean> {
  const now = new Date();
  if (surface === Surface.ADMIN) {
    const session = await db.session.findFirst({
      where: {
        id: sessionId,
        kind: SessionKind.ADMIN,
        state: "ACTIVE",
        revokedAt: null,
        expiresAt: { gt: now },
        idleExpiresAt: { gt: now },
        staffUserId,
        staffUser: { isActive: true, status: StaffStatus.ACTIVE },
      },
      select: { id: true },
    });
    if (!session) return false;
  } else {
    if (!terminalId) return false;
    const session = await db.deviceSession.findFirst({
      where: {
        id: sessionId,
        staffUserId,
        terminalId,
        revokedAt: null,
        accessExpiresAt: { gt: now },
        staffUser: { isActive: true, status: StaffStatus.ACTIVE },
        terminal: { isActive: true },
      },
      select: { id: true },
    });
    if (!session) return false;
  }

  const freshPermissions = await permissionKeys(staffUserId);
  const fingerprint = [...freshPermissions].sort().join("\0");
  if (fingerprint !== permissionFingerprint) return false;
  if (surface === Surface.ADMIN) return freshPermissions.has("admin.access");
  return [...freshPermissions].some((permission) => posPermissionCeiling.has(permission));
}

export async function registerWs(app: FastifyInstance): Promise<void> {
  const websocket = await import("@fastify/websocket");
  app.register(websocket.default, { options: { maxPayload: 65_536 } });

  app.get<{ Params: { surface: string } }>("/ws/:surface", { websocket: true }, async (socket, request) => {
    const surfaceName = request.params.surface;
    if (surfaceName !== "admin" && surfaceName !== "pos") {
      socket.close(1008, "surface rejected");
      return;
    }

    const admin = surfaceName === "admin";
    const surface = admin ? Surface.ADMIN : Surface.POS;
    let staffUserId: string;
    let sessionId: string;
    let terminalId: string | null = null;

    if (admin) {
      if (!process.env.ADMIN_ORIGIN || request.headers.origin !== process.env.ADMIN_ORIGIN) {
        socket.close(1008, "origin rejected");
        return;
      }
      const raw = cookieValue(String(request.headers.cookie ?? ""), "__Host-lingo_admin_sid");
      const session = raw ? await db.session.findFirst({
        where: {
          tokenHash: sha(raw), kind: SessionKind.ADMIN, state: "ACTIVE", revokedAt: null,
          expiresAt: { gt: new Date() }, idleExpiresAt: { gt: new Date() },
          staffUser: { isActive: true, status: StaffStatus.ACTIVE },
        },
        include: { staffUser: true },
      }) : null;
      if (!session?.staffUser || !session.staffUserId) {
        socket.close(1008, "session invalid");
        return;
      }
      staffUserId = session.staffUserId;
      sessionId = session.id;
    } else {
      if (
        request.headers.origin &&
        request.headers.origin !== process.env.POS_ORIGIN
      ) {
        socket.close(1008, "browser origin rejected");
        return;
      }
      const raw = tokenFromHeader(request);
      const session = raw ? await db.deviceSession.findUnique({
        where: { accessTokenHash: sha(raw) },
        include: { staffUser: true, terminal: true },
      }) : null;
      if (
        !session || session.revokedAt || session.accessExpiresAt <= new Date() ||
        !session.staffUser.isActive || session.staffUser.status !== StaffStatus.ACTIVE ||
        !session.terminal.isActive
      ) {
        socket.close(1008, "token invalid");
        return;
      }
      staffUserId = session.staffUserId;
      sessionId = session.id;
      terminalId = session.terminalId;
    }

    const permissions = await permissionKeys(staffUserId);
    if (admin ? !permissions.has("admin.access") : ![...permissions].some((key) => posPermissionCeiling.has(key))) {
      socket.close(1008, "permission denied");
      return;
    }
    const fingerprint = [...permissions].sort().join("\0");
    const subscriptions = subscriptionsFor(surface, permissions);
    socket.send(JSON.stringify({ type: "connected", surface, subscriptions }));

    let messageCount = 0;
    let lastMessageAt = 0;
    let checkInProgress = false;
    let awaitingPong = false;
    const heartbeat = setInterval(() => {
      if (awaitingPong || socket.readyState !== socket.OPEN) {
        clearInterval(heartbeat);
        socket.terminate();
        return;
      }
      awaitingPong = true;
      socket.ping();
      setTimeout(() => {
        if (awaitingPong && socket.readyState === socket.OPEN) {
          clearInterval(heartbeat);
          socket.terminate();
        }
      }, 15_000);
    }, 30_000);

    const revalidate = setInterval(async () => {
      if (checkInProgress) return;
      checkInProgress = true;
      try {
        const authorized = await isStillAuthorized(surface, sessionId, staffUserId, terminalId, fingerprint);
        if (!authorized) {
          clearInterval(heartbeat);
          clearInterval(revalidate);
          socket.close(1008, "authorization changed");
        }
      } catch {
        clearInterval(heartbeat);
        clearInterval(revalidate);
        socket.close(1011, "authorization check failed");
      } finally {
        checkInProgress = false;
      }
    }, 30_000);

    socket.on("pong", () => { awaitingPong = false; });
    socket.on("message", (message: Buffer) => {
      messageCount += 1;
      const now = Date.now();
      if (messageCount > 30 || now - lastMessageAt < 30 || message.length > 65_536) {
        socket.close(1008, "message limit");
        return;
      }
      lastMessageAt = now;
    });
    socket.on("close", () => {
      clearInterval(heartbeat);
      clearInterval(revalidate);
    });
  });
}
