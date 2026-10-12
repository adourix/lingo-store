import type { FastifyInstance } from "fastify";
import { PrismaClient, SessionKind, Surface, StaffStatus } from "@prisma/client";
import { createHash } from "node:crypto";
import { isActivePosSession, POS_SESSION_COOKIE } from "./pos-auth-policy.js";
import { startOrderEmailWorker } from "./order-email-worker.js";

const db = new PrismaClient();
const sha = (value: string) => createHash("sha256").update(value).digest("hex");

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
    include: {
      role: { include: { permissions: { include: { permission: true } } } },
    },
  });
  return new Set(
    assignments.flatMap((assignment) =>
      assignment.role.permissions.map((entry) => entry.permission.key),
    ),
  );
}

const posPermissionCeiling = new Set([
  "pos.use",
  "products.view",
  "customers.view",
  "customers.manage",
  "sales.create",
  "sales.view",
  "sales.discount",
  "sales.void",
  "sales.refund",
  "sales.reprint",
  "payments.create",
  "cash_session.open",
  "cash_session.close",
  "approvals.grant",
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
    const session = await db.session.findFirst({
      where: {
        id: sessionId,
        kind: SessionKind.POS,
        staffUserId,
        terminalId,
        state: "ACTIVE",
        revokedAt: null,
        expiresAt: { gt: now },
        idleExpiresAt: { gt: now },
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

async function registerAdminCategoryDelete(app: FastifyInstance): Promise<void> {
  app.delete<{ Params: { id: string } }>(
    "/api/admin/categories/:id",
    async (request, reply) => {
      const origin = String(request.headers.origin || "");
      if (process.env.ADMIN_ORIGIN && origin !== process.env.ADMIN_ORIGIN)
        return reply.code(403).send({ error: "ORIGIN_FORBIDDEN" });

      const csrfCookie = request.cookies["__Host-lingo_admin_csrf"];
      const csrfHeader = String(request.headers["x-csrf-token"] || "");
      if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader)
        return reply.code(403).send({ error: "CSRF_INVALID" });

      if (!/^[0-9a-f-]{36}$/i.test(request.params.id))
        return reply.code(400).send({ error: "INVALID_ID" });

      const raw = request.cookies["__Host-lingo_admin_sid"];
      if (!raw) return reply.code(401).send({ error: "UNAUTHENTICATED" });
      const session = await db.session.findUnique({
        where: { tokenHash: sha(raw) },
        include: { staffUser: true },
      });
      if (
        !session ||
        session.kind !== SessionKind.ADMIN ||
        session.state !== "ACTIVE" ||
        session.revokedAt ||
        session.expiresAt <= new Date() ||
        session.idleExpiresAt <= new Date() ||
        session.staffUser?.isActive !== true ||
        session.staffUser.status !== StaffStatus.ACTIVE
      )
        return reply.code(401).send({ error: "UNAUTHENTICATED" });

      const permissions = await permissionKeys(session.staffUser.id);
      if (!permissions.has("admin.access") || !permissions.has("categories.manage"))
        return reply.code(403).send({ error: "FORBIDDEN" });

      const category = await db.category.findUnique({
        where: { id: request.params.id },
        select: { id: true, name: true },
      });
      if (!category) return reply.code(404).send({ error: "NOT_FOUND" });

      await db.$transaction(async (tx) => {
        await tx.product.updateMany({
          where: { categoryId: category.id },
          data: { categoryId: null },
        });
        await tx.category.delete({ where: { id: category.id } });
      });

      return { ok: true, deleted: { id: category.id, name: category.name } };
    },
  );
}

async function registerAdminCustomerDelete(app: FastifyInstance): Promise<void> {
  app.delete<{ Params: { id: string } }>(
    "/api/admin/customers/:id",
    async (request, reply) => {
      const origin = String(request.headers.origin || "");
      if (process.env.ADMIN_ORIGIN && origin !== process.env.ADMIN_ORIGIN)
        return reply.code(403).send({ error: "ORIGIN_FORBIDDEN" });

      const csrfCookie = request.cookies["__Host-lingo_admin_csrf"];
      const csrfHeader = String(request.headers["x-csrf-token"] || "");
      if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader)
        return reply.code(403).send({ error: "CSRF_INVALID" });

      if (!/^[0-9a-f-]{36}$/i.test(request.params.id))
        return reply.code(400).send({ error: "INVALID_ID" });

      const raw = request.cookies["__Host-lingo_admin_sid"];
      if (!raw) return reply.code(401).send({ error: "UNAUTHENTICATED" });
      const session = await db.session.findUnique({
        where: { tokenHash: sha(raw) },
        include: { staffUser: true },
      });
      if (
        !session ||
        session.kind !== SessionKind.ADMIN ||
        session.state !== "ACTIVE" ||
        session.revokedAt ||
        session.expiresAt <= new Date() ||
        session.idleExpiresAt <= new Date() ||
        session.staffUser?.isActive !== true ||
        session.staffUser.status !== StaffStatus.ACTIVE
      )
        return reply.code(401).send({ error: "UNAUTHENTICATED" });

      const permissions = await permissionKeys(session.staffUser.id);
      if (!permissions.has("admin.access") || !permissions.has("customers.manage"))
        return reply.code(403).send({ error: "FORBIDDEN" });

      const customer = await db.customer.findUnique({
        where: { id: request.params.id },
        select: {
          id: true,
          name: true,
          _count: { select: { sales: true, payments: true } },
        },
      });
      if (!customer) return reply.code(404).send({ error: "NOT_FOUND" });

      if (customer._count.sales > 0 || customer._count.payments > 0) {
        return reply.code(409).send({
          error: "CUSTOMER_HAS_HISTORY",
          message: "Customer cannot be deleted because it has sales or payment history.",
        });
      }

      await db.customer.delete({ where: { id: customer.id } });

      await db.auditLog.create({
        data: {
          actorId: session.staffUser.id,
          action: "customer.delete",
          entity: "customer",
          entityId: customer.id,
          success: true,
          outcome: "success",
          surface: Surface.ADMIN,
          ip: request.ip,
          userAgent: String(request.headers["user-agent"] || "") || undefined,
        },
      });

      return { ok: true, deleted: { id: customer.id, name: customer.name } };
    },
  );
}

async function registerCustomerFavorites(app: FastifyInstance): Promise<void> {
  const getCustomerSession = async (request: { cookies: Record<string, string | undefined> }) => {
    const raw = request.cookies["__Host-lingo_sid"];
    if (!raw) return null;
    return db.session.findUnique({
      where: { tokenHash: sha(raw) },
      include: { customerAccount: true },
    });
  };

  app.get("/api/account/favorites", async (request, reply) => {
    const origin = String(request.headers.origin || "");
    if (origin && process.env.PUBLIC_ORIGIN && origin !== process.env.PUBLIC_ORIGIN)
      return reply.code(403).send({ error: "ORIGIN_FORBIDDEN" });
    const session = await getCustomerSession(request);
    if (
      !session ||
      session.kind !== SessionKind.CUSTOMER ||
      session.state !== "ACTIVE" ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      session.idleExpiresAt <= new Date() ||
      !session.customerAccountId
    )
      return reply.code(401).send({ error: "UNAUTHENTICATED" });

    const rows = await db.$queryRaw<Array<{ productId: string }>>`
      SELECT "productId"
      FROM "CustomerFavorite"
      WHERE "customerAccountId" = ${session.customerAccountId}
      ORDER BY "createdAt" DESC
    `;
    return { productIds: rows.map((row) => row.productId) };
  });

  const mutateFavorite = async (
    request: {
      params: { productId: string };
      cookies: Record<string, string | undefined>;
      headers: Record<string, string | string[] | undefined>;
    },
    reply: { code: (status: number) => { send: (body: unknown) => unknown } },
    method: "add" | "remove",
  ) => {
    const origin = String(request.headers.origin || "");
    if (!process.env.PUBLIC_ORIGIN || origin !== process.env.PUBLIC_ORIGIN)
      return reply.code(403).send({ error: "ORIGIN_FORBIDDEN" });

    const csrfCookie = request.cookies["__Host-lingo_csrf"];
    const csrfHeader = String(request.headers["x-csrf-token"] || "");
    if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader)
      return reply.code(403).send({ error: "CSRF_INVALID" });

    if (!/^[0-9a-f-]{36}$/i.test(request.params.productId))
      return reply.code(400).send({ error: "INVALID_ID" });

    const session = await getCustomerSession(request);
    if (
      !session ||
      session.kind !== SessionKind.CUSTOMER ||
      session.state !== "ACTIVE" ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      session.idleExpiresAt <= new Date() ||
      !session.customerAccountId
    )
      return reply.code(401).send({ error: "UNAUTHENTICATED" });

    const product = await db.product.findUnique({
      where: { id: request.params.productId },
      select: { id: true, archivedAt: true },
    });
    if (!product || product.archivedAt) return reply.code(404).send({ error: "NOT_FOUND" });

    if (method === "add") {
      await db.$executeRaw`
        INSERT INTO "CustomerFavorite" ("id", "customerAccountId", "productId")
        VALUES (${crypto.randomUUID()}, ${session.customerAccountId}, ${product.id})
        ON CONFLICT ("customerAccountId", "productId") DO NOTHING
      `;
      return { ok: true, favorite: true, productId: product.id };
    }

    await db.$executeRaw`
      DELETE FROM "CustomerFavorite"
      WHERE "customerAccountId" = ${session.customerAccountId}
        AND "productId" = ${product.id}
    `;
    return { ok: true, favorite: false, productId: product.id };
  };

  app.post<{ Params: { productId: string } }>(
    "/api/account/favorites/:productId",
    async (request, reply) => mutateFavorite(request, reply, "add"),
  );
  app.delete<{ Params: { productId: string } }>(
    "/api/account/favorites/:productId",
    async (request, reply) => mutateFavorite(request, reply, "remove"),
  );
}

export async function registerWs(app: FastifyInstance): Promise<void> {
  startOrderEmailWorker();
  await registerAdminCategoryDelete(app);
  await registerAdminCustomerDelete(app);
  await registerCustomerFavorites(app);

  const websocket = await import("@fastify/websocket");
  app.register(websocket.default, { options: { maxPayload: 65_536 } });

  app.get<{ Params: { surface: string } }>(
    "/ws/:surface",
    { websocket: true },
    async (socket, request) => {
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
        const session = raw
          ? await db.session.findFirst({
              where: {
                tokenHash: sha(raw),
                kind: SessionKind.ADMIN,
                state: "ACTIVE",
                revokedAt: null,
                expiresAt: { gt: new Date() },
                idleExpiresAt: { gt: new Date() },
                staffUser: { isActive: true, status: StaffStatus.ACTIVE },
              },
              include: { staffUser: true },
            })
          : null;
        if (!session?.staffUser || !session.staffUserId) {
          socket.close(1008, "session invalid");
          return;
        }
        staffUserId = session.staffUserId;
        sessionId = session.id;
      } else {
        if (!process.env.POS_ORIGIN || request.headers.origin !== process.env.POS_ORIGIN) {
          socket.close(1008, "browser origin rejected");
          return;
        }
        const raw = cookieValue(String(request.headers.cookie ?? ""), POS_SESSION_COOKIE);
        const session = raw
          ? await db.session.findFirst({
              where: {
                tokenHash: sha(raw),
                kind: SessionKind.POS,
                state: "ACTIVE",
                revokedAt: null,
                expiresAt: { gt: new Date() },
                idleExpiresAt: { gt: new Date() },
                staffUser: { isActive: true, status: StaffStatus.ACTIVE },
                terminal: { isActive: true },
              },
              include: { staffUser: true, terminal: true },
            })
          : null;
        if (
          !session?.staffUser ||
          !session.staffUserId ||
          !session.terminal ||
          !session.terminalId ||
          !isActivePosSession(session, new Date())
        ) {
          socket.close(1008, "session invalid");
          return;
        }
        staffUserId = session.staffUserId;
        sessionId = session.id;
        terminalId = session.terminalId;
      }

      const permissions = await permissionKeys(staffUserId);
      if (
        admin
          ? !permissions.has("admin.access")
          : ![...permissions].some((key) => posPermissionCeiling.has(key))
      ) {
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
          const authorized = await isStillAuthorized(
            surface,
            sessionId,
            staffUserId,
            terminalId,
            fingerprint,
          );
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

      socket.on("pong", () => {
        awaitingPong = false;
      });
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
    },
  );
}
