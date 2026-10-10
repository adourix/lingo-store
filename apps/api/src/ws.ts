import type { FastifyInstance, FastifyRequest } from "fastify";
import { PrismaClient, SessionKind, Surface } from "@prisma/client";
import { createHash } from "node:crypto";

const db = new PrismaClient();
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const tokenFromHeader = (request: FastifyRequest) => /^Bearer ([A-Za-z0-9_-]{32,})$/.exec(String(request.headers.authorization || ""))?.[1] ?? null;
const cookie = (header: string, name: string) => header.split(";").map((part) => part.trim().split("=", 2)).find(([key]) => key === name)?.[1];

async function permissions(staffUserId: string): Promise<string> {
  const rows = await db.staffRoleAssignment.findMany({ where: { staffUserId }, include: { role: { include: { permissions: { include: { permission: true } } } } } });
  return rows.flatMap((row) => row.role.permissions.map((entry) => entry.permission.key)).sort().join("\0");
}

export async function registerWs(app: FastifyInstance): Promise<void> {
  const websocket = await import("@fastify/websocket");
  app.register(websocket.default, { options: { maxPayload: 65_536 } });
  app.get("/ws/:surface", { websocket: true }, async (socket, request) => {
    const name = (request.params as { surface?: string }).surface;
    if (name !== "admin" && name !== "pos") return socket.close(1008, "surface rejected");
    const admin = name === "admin";
    let staffUserId = "";
    let sessionId = "";
    if (admin) {
      if (String(request.headers.origin || "") !== process.env.ADMIN_ORIGIN) return socket.close(1008, "origin rejected");
      const raw = cookie(String(request.headers.cookie || ""), "__Host-lingo_admin_sid");
      const session = raw ? await db.session.findFirst({ where: { tokenHash: sha(raw), kind: SessionKind.ADMIN, state: "ACTIVE", revokedAt: null, expiresAt: { gt: new Date() }, idleExpiresAt: { gt: new Date() } }, include: { staffUser: true } }) : null;
      if (!session?.staffUser?.isActive || session.staffUser.status !== "ACTIVE") return socket.close(1008, "session invalid");
      staffUserId = session.staffUserId!;
      sessionId = session.id;
    } else {
      if (request.headers.origin) return socket.close(1008, "browser origin rejected");
      const raw = tokenFromHeader(request);
      const session = raw ? await db.deviceSession.findUnique({ where: { accessTokenHash: sha(raw) }, include: { staffUser: true, terminal: true } }) : null;
      if (!session || session.revokedAt || session.accessExpiresAt <= new Date() || !session.staffUser.isActive || session.staffUser.status !== "ACTIVE" || !session.terminal.isActive) return socket.close(1008, "token invalid");
      staffUserId = session.staffUserId;
      sessionId = session.id;
    }
    const fingerprint = await permissions(staffUserId);
    const surface = admin ? Surface.ADMIN : Surface.POS;
    socket.send(JSON.stringify({ type: "connected", surface, subscriptions: admin ? ["dashboard", "sales", "alerts"] : ["catalog", "sales", "cash"] }));
    let messages = 0;
    let previous = Date.now();
    const interval = setInterval(async () => {
      const current = admin
        ? await db.session.findFirst({ where: { id: sessionId, revokedAt: null, expiresAt: { gt: new Date() }, idleExpiresAt: { gt: new Date() } } })
        : await db.deviceSession.findFirst({ where: { id: sessionId, revokedAt: null, accessExpiresAt: { gt: new Date() } } });
      if (!current || await permissions(staffUserId) !== fingerprint) { clearInterval(interval); socket.close(1008, "authorization changed"); return; }
      socket.send(JSON.stringify({ type: "ping" }));
    }, 300_000);
    socket.on("message", (message: Buffer) => { messages += 1; if (messages > 30 || Date.now() - previous < 30 || message.length > 65_536) socket.close(1008, "rate limited"); previous = Date.now(); });
    socket.on("close", () => clearInterval(interval));
  });
}
