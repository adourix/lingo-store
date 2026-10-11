import { assertRoutePolicy } from "./route-policy.js";
import { permissionForAdminRoute } from "./admin-permission.js";
import Fastify, { FastifyRequest, FastifyReply, RouteGenericInterface } from "fastify";
import helmet from "@fastify/helmet";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import {
  Prisma,
  PrismaClient,
  StaffStatus,
  SessionKind,
  PaymentMethod,
  SaleStatus,
  CashStatus,
  Refund,
  WebOrderStatus,
} from "@prisma/client";
import { randomBytes, createHash, randomUUID } from "node:crypto";
import {
  hashPassword,
  verifyPassword,
  validatePassword,
  validateCustomerPassword,
  needsPasswordRehash,
  assertNotBreached,
} from "./password.js";
import { verifyTotp } from "./totp.js";
import { decryptMfaSecret, encryptMfaSecret } from "./mfa-crypto.js";
import { decryptSetupDeliveryPayload, sendStaffSetupMail, sendTransactionalMail } from "./mailer.js";
import { registerWs } from "./ws.js";
import { money, qtyMilli, qty, minorForQuantity } from "./money.js";
import { canRestoreSaleStock } from "./refund-policy.js";
import { posMutationOriginError } from "./origin-policy.js";
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
} from "./pos-auth-policy.js";
import {
  calculateWebOrderPricing,
  canCollectCashForWebOrder,
  canTransitionWebOrder,
} from "./web-order-policy.js";
import {
  adminLoginInput,
  adminMfaInput,
  contactInput,
  createSaleInput,
  customerLoginInput,
  customerCreateInput,
  customerLookupQuery,
  customerProfileInput,
  customerRegistrationInput,
  emailInput,
  passwordChangeInput,
  staffPasswordChangeInput,
  passwordResetInput,
  productCreateInput,
  productUpdateInput,
  customerPaymentInput,
  supplierPaymentInput,
  supplierCreateInput,
  inventoryAdjustmentInput,
  purchaseInput,
  posLoginInput,
  offlineSaleInput,
  opaqueToken,
  resourceId,
  idempotencyKey,
  roleCreateInput,
  rolePermissionsInput,
  customerAccountLinkInput,
  expenseInput,
  cashOpenInput,
  cashCloseInput,
  posEnrollmentInput,
  posUnlockInput,
  posApprovalInput,
  posRefundInput,
  posRefreshInput,
  adminApprovalInput,
  categoryInput,
  staffInvitationInput,
  staffRoleInput,
  staffStatusInput,
  refundInput,
  settingUpdateInput,
  staffSetupInput,
  stepUpInput,
  tokenInput,
  webOrderCreateInput,
  webOrderStatusInput,
  webOrderCashReceiptInput,
} from "@lingo/validation";
const prisma = new PrismaClient();
const appRoutePolicyGuard = (route: { method: string | string[]; url: string }) =>
  assertRoutePolicy(route.method, route.url);
const DUMMY_PASSWORD_HASH = await hashPassword("dummy-password-for-timing-only");
const app = Fastify({
  logger: {
    redact: [
      "req.headers.cookie",
      "req.headers.authorization",
      "res.headers['set-cookie']",
      "req.url",
      "req.raw.url",
    ],
  },
  bodyLimit: 1048576,
  connectionTimeout: 5000,
  keepAliveTimeout: 5000,
  trustProxy: ["127.0.0.1", "::1"],
});
app.addHook("onRoute", appRoutePolicyGuard);
const publicOrigin = process.env.PUBLIC_ORIGIN || "";
const adminOrigin = process.env.ADMIN_ORIGIN || "";
const posOrigin = process.env.POS_ORIGIN || "";
if (process.env.NODE_ENV === "production" && (!publicOrigin || !adminOrigin || !posOrigin))
  throw Error("SURFACE_ORIGINS_REQUIRED");
if (process.env.NODE_ENV === "production" && !process.env.MFA_ENCRYPTION_KEY)
  throw Error("MFA_ENCRYPTION_KEY_REQUIRED");
if (process.env.NODE_ENV === "production") {
  for (const name of ["EMAIL_FROM", "RESEND_API_KEY", "EMAIL_PAYLOAD_KEY"]) {
    if (!process.env[name]?.trim()) throw Error(`${name}_REQUIRED`);
  }
  const payloadKey = Buffer.from(process.env.EMAIL_PAYLOAD_KEY || "", "base64");
  if (payloadKey.length !== 32 || payloadKey.toString("base64") !== process.env.EMAIL_PAYLOAD_KEY) {
    throw Error("EMAIL_PAYLOAD_KEY_INVALID");
  }
  if (!/^Lingo Store <[^<>@\s]+@lingostore\.store>$/.test(process.env.EMAIL_FROM || "")) {
    throw Error("EMAIL_FROM_INVALID");
  }
}
if (process.env.NODE_ENV === "production" && !process.env.TURNSTILE_SECRET_KEY)
  throw Error("TURNSTILE_SECRET_KEY_REQUIRED");
const sha = (s: string) => createHash("sha256").update(s).digest("hex"),
  token = () => randomBytes(32).toString("base64url"),
  json = (x: unknown): unknown => {
    const serialized = JSON.stringify(x, (_, value) =>
      typeof value === "bigint" ? value.toString() : value,
    );
    return serialized === undefined ? null : JSON.parse(serialized);
  };
const prismaJson = (value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull => {
  const serialized = JSON.stringify(value, (_, entry) =>
    typeof entry === "bigint" ? entry.toString() : entry,
  );
  if (serialized === undefined || serialized === "null") return Prisma.JsonNull;
  return JSON.parse(serialized);
};
const bodyField = (body: unknown, field: string): unknown => {
  if (!body || typeof body !== "object" || Array.isArray(body)) return undefined;
  return Object.entries(body).find(([key]) => key === field)?.[1];
};
const hasUnknownFields = (body: unknown, allowed: readonly string[]) =>
  typeof body === "object" &&
  body !== null &&
  !Array.isArray(body) &&
  Object.keys(body).some((key) => !allowed.includes(key));
const cookieOpts = {
  httpOnly: true,
  secure: true,
  sameSite: "strict" as const,
  path: "/",
};
const customerCookieOpts = { ...cookieOpts, sameSite: "lax" as const };
const csrfOpts = {
  secure: true,
  sameSite: "strict" as const,
  path: "/",
  httpOnly: false,
};
type Ctx = { session: unknown };
const getSession = async (req: FastifyRequest) => {
  for (const n of ["__Host-lingo_admin_sid", "__Host-lingo_sid"]) {
    const raw = req.cookies[n];
    if (!raw) continue;
    const expected = n === "__Host-lingo_admin_sid" ? SessionKind.ADMIN : SessionKind.CUSTOMER;
    const s = await prisma.session.findUnique({
      where: { tokenHash: sha(raw) },
      include: { staffUser: true, customerAccount: true, terminal: true },
    });
    if (
      !s ||
      s.kind !== expected ||
      s.state !== "ACTIVE" ||
      s.revokedAt ||
      s.expiresAt <= new Date() ||
      s.idleExpiresAt <= new Date()
    )
      continue;
    if (
      expected === SessionKind.ADMIN &&
      (!s.staffUser?.isActive || s.staffUser.status !== StaffStatus.ACTIVE)
    )
      continue;
    const idle = expected === SessionKind.ADMIN ? 1200 : 604800;
    await prisma.session.update({
      where: { id: s.id },
      data: {
        lastSeenAt: new Date(),
        idleExpiresAt: new Date(Math.min(s.expiresAt.getTime(), Date.now() + idle * 1000)),
      },
    });
    return s;
  }
  return null;
};
const getPosSession = async (req: FastifyRequest) => {
  const raw = req.cookies[POS_SESSION_COOKIE];
  if (!raw) return null;
  const now = new Date();
  const session = await prisma.session.findUnique({
    where: { tokenHash: sha(raw) },
    include: { staffUser: true, terminal: true, customerAccount: true },
  });
  if (!isActivePosSession(session, now)) return null;

  const idleExpiresAt = new Date(
    Math.min(session.expiresAt.getTime(), now.getTime() + POS_SESSION_IDLE_MS),
  );
  await prisma.session.update({
    where: { id: session.id },
    data: { lastSeenAt: now, idleExpiresAt },
  });
  await prisma.terminal.update({
    where: { id: session.terminalId! },
    data: { lastSeenAt: now },
  });
  return { ...session, lastSeenAt: now, idleExpiresAt };
};
const audit = async (
  actorId: string | undefined,
  action: string,
  entity: string,
  entityId: string | undefined,
  success: boolean,
  metadata: unknown = {},
  request?: FastifyRequest,
) => {
  if (request) request.auditTracked = true;
  const actor = actorId
    ? await prisma.staffUser.findUnique({
        where: { id: actorId },
        select: {
          roleAssignments: { select: { role: { select: { name: true } } } },
        },
      })
    : null;
  const surfaceMarker = bodyField(metadata, "surface");
  const surface = surfaceMarker === "pos" ? "POS" : surfaceMarker === "admin" ? "ADMIN" : undefined;
  const session = request ? getReqSession(request) : null;
  return prisma.auditLog.create({
    data: {
      actorId,
      action,
      entity,
      entityId,
      success,
      outcome: action.includes("denied") ? "denied" : success ? "success" : "failed",
      surface,
      actorType: actorId ? "staff" : session?.customerAccount ? "customer" : undefined,
      actorRoleSnapshot: actor?.roleAssignments.map((item) => item.role.name).join(","),
      ip: request?.ip,
      userAgent: String(request?.headers["user-agent"] || "") || undefined,
      requestId: request?.requestId,
      sessionRef: session?.id,
      terminalId: session?.terminal?.id || session?.terminalId || undefined,
      metadata: prismaJson(metadata),
    },
  });
};
const hasPermission = async (userId: string, key: string) => {
  const u = await prisma.staffUser.findUnique({
    where: { id: userId },
    include: {
      roleAssignments: {
        include: {
          role: { include: { permissions: { include: { permission: true } } } },
        },
      },
    },
  });
  return !!u?.roleAssignments.some((a) => a.role.permissions.some((p) => p.permission.key === key));
};
const staff = () => async (req: FastifyRequest, reply: FastifyReply) => {
  const s = await getSession(req);
  if (!s || s.kind !== SessionKind.ADMIN || s.state !== "ACTIVE" || !s.staffUser)
    return reply.code(401).send({ error: "UNAUTHENTICATED" });
  if (!(await hasPermission(s.staffUser.id, "admin.access")))
    return reply.code(403).send({ error: "FORBIDDEN" });
  const permission = permissionForAdminRoute(req);
  if (!permission || !(await hasPermission(s.staffUser.id, permission))) {
    await audit(
      s.staffUser.id,
      "authorization.denied",
      "route",
      undefined,
      false,
      {
        permission: permission ?? "unmapped",
        path: req.url,
        method: req.method,
      },
      req,
    );
    return reply.code(403).send({ error: "FORBIDDEN" });
  }
  setReqSession(req, s);
};
type SessionData =
  | NonNullable<Awaited<ReturnType<typeof getSession>>>
  | NonNullable<Awaited<ReturnType<typeof getPosSession>>>;
type StaffInvitation = Prisma.StaffInvitationGetPayload<{ include: { invitee: true } }>;
type ApiRouteGeneric = RouteGenericInterface & {
  Body: Record<string, unknown>;
  Params: Record<string, string>;
  Querystring: Record<string, string>;
};
declare module "fastify" {
  interface FastifyRequest {
    session?: SessionData;
    requestId?: string;
    invite?: StaffInvitation;
    auditTracked?: boolean;
  }
}
type RequestWithSession = FastifyRequest<ApiRouteGeneric>;
const setReqSession = (req: FastifyRequest, s: SessionData) => {
  req.session = s;
};
const getReqSession = (req: FastifyRequest) => req.session;
const requestSession = (req: FastifyRequest): SessionData => {
  const session = getReqSession(req);
  if (!session) throw new Error("AUTH_CONTEXT_MISSING");
  return session;
};
const requestStaff = (req: FastifyRequest) => {
  const session = requestSession(req);
  if (!session.staffUser) throw new Error("STAFF_CONTEXT_MISSING");
  return { session: { ...session, staffUser: session.staffUser }, staffUser: session.staffUser };
};
const requestCustomer = (req: FastifyRequest) => {
  const session = requestSession(req);
  if (!session.customerAccount) throw new Error("CUSTOMER_CONTEXT_MISSING");
  return {
    session: { ...session, customerAccount: session.customerAccount },
    customerAccount: session.customerAccount,
  };
};
const requestPos = (req: FastifyRequest) => {
  const session = requestSession(req);
  if (!session.staffUser || !session.terminal) throw new Error("POS_CONTEXT_MISSING");
  return {
    session: { ...session, staffUser: session.staffUser, terminal: session.terminal },
    staffUser: session.staffUser,
    terminal: session.terminal,
  };
};
const requestInvitation = (req: RequestWithSession) => {
  const invitation = req.invite;
  if (!invitation?.invitee) throw new Error("INVITATION_CONTEXT_MISSING");
  return { ...invitation, invitee: invitation.invitee };
};
const posPermission = (req: FastifyRequest) => {
  const p = req.url.split("?")[0],
    m = req.method;
  if (p.includes("/auth/")) return "pos.use";
  if (p.startsWith("/api/pos/catalog/customers"))
    return m === "GET" ? "customers.view" : "customers.manage";
  if (p.startsWith("/api/pos/catalog")) return "products.view";
  if (p.startsWith("/api/pos/sales"))
    return p.includes("/reprint")
      ? "sales.reprint"
      : p.includes("/refund")
        ? "sales.refund"
        : m === "GET"
          ? "sales.view"
          : "sales.create";
  if (p.startsWith("/api/pos/cash-sessions"))
    return p.includes("/close") ? "cash_session.close" : "cash_session.open";
  if (p.startsWith("/api/pos/approvals")) return "approvals.grant";
  if (p.startsWith("/api/pos/sync")) return "sales.create";
  return "pos.use";
};
const pos = async (req: FastifyRequest, reply: FastifyReply) => {
  const s = await getPosSession(req);
  if (!s || !s.staffUser || !s.terminal?.isActive)
    return reply.code(401).send({ error: "POS_TOKEN_REQUIRED" });
  const permission = posPermission(req);
  const ceiling = new Set([
    "pos.use",
    "products.view",
    "customers.view",
    "customers.manage",
    "sales.create",
    "sales.discount",
    "sales.void",
    "sales.refund",
    "sales.reprint",
    "payments.create",
    "cash_session.open",
    "cash_session.close",
    "approvals.grant",
    "sales.view",
  ]);
  if (!ceiling.has(permission) || !(await hasPermission(s.staffUser.id, permission))) {
    await audit(
      s.staffUser.id,
      "authorization.denied",
      "route",
      undefined,
      false,
      { surface: "pos", permission, path: req.url },
      req,
    );
    return reply.code(403).send({ error: "FORBIDDEN" });
  }
  setReqSession(req, s);
};
const stepUp = async (req: FastifyRequest, reply: FastifyReply) => {
  const s = getReqSession(req);
  if (!s?.staffUser) return reply.code(401).send({ error: "UNAUTHENTICATED" });
  if (!s.stepUpUntil || s.stepUpUntil <= new Date())
    return reply.code(403).send({ error: "STEP_UP_REQUIRED" });
};
const countActiveAdminAccess = async (db: PrismaClient | Prisma.TransactionClient = prisma) =>
  db.staffUser.count({
    where: {
      isActive: true,
      status: StaffStatus.ACTIVE,
      roleAssignments: {
        some: {
          role: {
            permissions: { some: { permission: { key: "admin.access" } } },
          },
        },
      },
    },
  });
const lockAdminRoster = async (tx: Prisma.TransactionClient) => {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(49482011)`;
};
const assertAnActiveAdminRemains = async (tx: Prisma.TransactionClient) => {
  if ((await countActiveAdminAccess(tx)) === 0) throw new Error("LAST_ADMIN_PROTECTED");
};
const getStaffRoleNames = async (userId: string) => {
  const assignments = await prisma.staffRoleAssignment.findMany({
    where: { staffUserId: userId },
    select: { role: { select: { name: true } } },
    orderBy: { role: { name: "asc" } },
  });
  return assignments.map((assignment) => assignment.role.name);
};
const actorPermissionKeys = async (userId: string) => {
  const rows = await prisma.staffRoleAssignment.findMany({
    where: { staffUserId: userId },
    include: {
      role: { include: { permissions: { include: { permission: true } } } },
    },
  });
  return new Set(rows.flatMap((x) => x.role.permissions.map((y) => y.permission.key)));
};
const base32 = (bytes: Buffer) => {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const b of bytes) bits += b.toString(2).padStart(8, "0");
  let out = "";
  for (let i = 0; i < bits.length; i += 5)
    out += alphabet[parseInt(bits.slice(i, i + 5).padEnd(5, "0"), 2)];
  return out;
};
const customerDto = (u: {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  emailVerifiedAt: Date | null;
  businessCustomerId: string | null;
}) => ({
  id: u.id,
  email: u.email,
  name: u.name,
  phone: u.phone || null,
  emailVerified: Boolean(u.emailVerifiedAt),
  businessCustomerId: u.businessCustomerId || null,
});
const staffDto = (u: {
  id: string;
  username: string;
  email: string | null;
  name: string;
  status: StaffStatus;
  isActive: boolean;
  mfaEnabled: boolean;
  createdAt: Date;
}) => ({
  id: u.id,
  username: u.username,
  email: u.email || null,
  name: u.name,
  status: u.status,
  isActive: u.isActive,
  mfaEnabled: u.mfaEnabled,
  createdAt: u.createdAt,
});
const customer = async (req: FastifyRequest, reply: FastifyReply) => {
  const s = await getSession(req);
  if (!s || s.kind !== SessionKind.CUSTOMER || !s.customerAccount)
    return reply.code(401).send({ error: "UNAUTHENTICATED" });
  setReqSession(req, s);
};
const mutating = ["POST", "PUT", "PATCH", "DELETE"];
const csrfExempt = (req: FastifyRequest) => {
  const p = req.url.split("?")[0];
  if (
    p === "/api/auth/login" ||
    p === "/api/auth/register" ||
    p === "/api/auth/request-reset" ||
    p === "/api/auth/verify-email" ||
    p === "/api/admin/auth/login" ||
    p === "/api/admin/auth/request-password-reset" ||
    p === "/api/admin/auth/reset-password" ||
    p.startsWith("/api/admin/auth/setup/") ||
    p === "/api/admin/users/setup"
  )
    return true;
  return false;
};
const jsonOnly = async (req: FastifyRequest, reply: FastifyReply) => {
  if (
    mutating.includes(req.method) &&
    String(req.headers["content-type"] || "")
      .split(";")[0]
      .toLowerCase() !== "application/json"
  )
    return reply.code(415).send({ error: "JSON_REQUIRED" });
};
const csrf = async (req: FastifyRequest, reply: FastifyReply) => {
  if (!mutating.includes(req.method) || csrfExempt(req)) return;
  const path = req.url.split("?")[0];
  const csrfName = path.startsWith("/api/admin/")
    ? "__Host-lingo_admin_csrf"
    : path.startsWith("/api/pos/")
      ? POS_CSRF_COOKIE
      : "__Host-lingo_csrf";
  const cookieToken = req.cookies[csrfName];
  const headerToken = String(req.headers["x-csrf-token"] || "");
  if (!csrfDoubleSubmitIsValid(cookieToken, headerToken))
    return reply.code(403).send({ error: "CSRF_REQUIRED" });
};
const origin = async (req: FastifyRequest, reply: FastifyReply) => {
  if (!mutating.includes(req.method)) return;
  const path = req.url.split("?")[0];
  const originHeader = String(req.headers.origin || "");
  const fetchSite = String(req.headers["sec-fetch-site"] || "");
  if (path.startsWith("/api/pos/")) {
    const error = posMutationOriginError(
      req.method,
      path,
      originHeader,
      posOrigin,
      fetchSite,
      String(req.headers.referer || ""),
    );
    if (error) return reply.code(403).send({ error });
    return;
  }

  const expected = path.startsWith("/api/admin/")
    ? adminOrigin
    : path.startsWith("/api/public/") ||
        path.startsWith("/api/auth/") ||
        path.startsWith("/api/account/")
      ? publicOrigin
      : "";
  const allowed = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (!originHeader || !allowed.includes(originHeader) || (expected && originHeader !== expected)) {
    return reply.code(403).send({ error: "ORIGIN_FORBIDDEN" });
  }
  if (fetchSite === "cross-site") {
    return reply.code(403).send({ error: "CROSS_SITE_FORBIDDEN" });
  }
};
const csrfEndpoint = async (req: FastifyRequest, reply: FastifyReply) => {
  const value = token();
  const path = req.url.split("?")[0];
  const cookieName = path.startsWith("/api/admin/")
    ? "__Host-lingo_admin_csrf"
    : path.startsWith("/api/pos/")
      ? POS_CSRF_COOKIE
      : "__Host-lingo_csrf";
  reply.setCookie(cookieName, value, { ...csrfOpts, maxAge: 3600 });
  return { token: value };
};
app.addHook("onResponse", async (req, reply) => {
  if (!mutating.includes(req.method) || req.auditTracked) return;
  try {
    const s = getReqSession(req),
      actorId = s?.staffUser?.id;
    await prisma.auditLog.create({
      data: {
        actorId,
        action: "api.mutation",
        entity: "api_request",
        success: reply.statusCode < 400,
        outcome: reply.statusCode < 400 ? "success" : "failed",
        surface: req.url.startsWith("/api/admin/")
          ? "ADMIN"
          : req.url.startsWith("/api/pos/")
            ? "POS"
            : undefined,
        actorType: actorId ? "staff" : s?.customerAccount ? "customer" : "anonymous",
        ip: req.ip,
        userAgent: String(req.headers["user-agent"] || "") || undefined,
        requestId: req.requestId,
        sessionRef: s?.id,
        terminalId: s?.terminal?.id || undefined,
        metadata: {
          method: req.method,
          path:
            req.routeOptions?.url ||
            req.url.split("?")[0].replace(/\/setup\/[^/]+$/, "/setup/:token"),
          statusCode: reply.statusCode,
        },
      },
    });
  } catch (e) {
    req.log.error({ err: e, requestId: req.requestId }, "audit fallback failed");
  }
});
app.addHook("onSend", async (req, reply) => {
  const p = req.url.split("?")[0];
  if (
    p.startsWith("/api/auth/") ||
    p.startsWith("/api/account/") ||
    p.startsWith("/api/admin/") ||
    p.startsWith("/api/pos/")
  )
    reply.header("Cache-Control", "no-store");
});
app.addHook("onRequest", async (req, reply) => {
  const id = String(req.headers["x-request-id"] || randomUUID());
  req.requestId = id;
  reply.header("x-request-id", id);
});
const surfaceHost = async (req: FastifyRequest, reply: FastifyReply) => {
  const p = req.url.split("?")[0];
  const forwardedHost = String(req.headers["x-forwarded-host"] || "")
    .split(",")[0]
    .trim();
  const host = (forwardedHost || String(req.headers.host || "")).split(":")[0];
  const expected = p.startsWith("/api/admin/")
    ? adminOrigin
    : p.startsWith("/api/pos/")
      ? posOrigin
      : p.startsWith("/api/public/") || p.startsWith("/api/auth/") || p.startsWith("/api/account/")
        ? publicOrigin
        : "";
  if (expected && host !== new URL(expected).hostname)
    return reply.code(404).send({ error: "NOT_FOUND" });
};
app.register(helmet, { global: true });
app.register(cookie);
app.register(rateLimit, { max: 120, timeWindow: "1 minute" });
app.addHook("preHandler", surfaceHost);
app.addHook("preHandler", origin);
app.addHook("preHandler", jsonOnly);
app.addHook("preHandler", csrf);
app.get<ApiRouteGeneric>("/health", async () => ({
  ok: true,
  service: "api",
  version: "2.1.0",
}));
app.get<ApiRouteGeneric>("/api/public/csrf", csrfEndpoint);
app.get<ApiRouteGeneric>("/api/auth/csrf", csrfEndpoint);
app.get<ApiRouteGeneric>("/api/admin/auth/csrf", csrfEndpoint);
app.get<ApiRouteGeneric>("/api/pos/auth/csrf", csrfEndpoint);
const setSession = async (
  reply: FastifyReply,
  kind: SessionKind,
  data: Record<string, unknown>,
  maxAge: number,
  name: string,
  idleAge = Math.min(
    maxAge,
    kind === SessionKind.ADMIN ? 1200 : kind === SessionKind.POS ? 1800 : 604800,
  ),
) => {
  const raw = token();
  await prisma.session.create({
    data: {
      tokenHash: sha(raw),
      kind,
      ...data,
      expiresAt: new Date(Date.now() + maxAge * 1000),
      idleExpiresAt: new Date(Date.now() + idleAge * 1000),
    },
  });
  const c = token();
  reply.setCookie(name, raw, {
    ...(kind === SessionKind.CUSTOMER ? customerCookieOpts : cookieOpts),
    maxAge,
  });
  reply.setCookie(kind === SessionKind.ADMIN ? "__Host-lingo_admin_csrf" : "__Host-lingo_csrf", c, {
    ...csrfOpts,
    maxAge,
  });
  return c;
};

app.post<ApiRouteGeneric>(
  "/api/auth/verify-email",
  async (req: FastifyRequest<{ Body: { token?: string } }>, reply: FastifyReply) => {
    const input = tokenInput.safeParse(req.body);
    if (!input.success) return reply.code(400).send({ error: "INVALID_TOKEN" });
    const raw = input.data.token;
    const t = await prisma.emailVerificationToken.findUnique({
      where: { tokenHash: sha(raw) },
    });
    if (!t || t.usedAt || t.expiresAt < new Date())
      return reply.code(400).send({ error: "INVALID_TOKEN" });
    const account = await prisma.customerAccount.findUnique({
      where: { id: t.accountId },
    });
    if (!account) return reply.code(400).send({ error: "INVALID_TOKEN" });
    await prisma.$transaction([
      prisma.customerAccount.update({
        where: { id: t.accountId },
        data: { emailVerifiedAt: new Date() },
      }),
      prisma.emailVerificationToken.update({
        where: { id: t.id },
        data: { usedAt: new Date() },
      }),
    ]);
    return { ok: true };
  },
);
app.post<ApiRouteGeneric>(
  "/api/auth/request-reset",
  { config: { rateLimit: { max: 3, timeWindow: "1 hour" } } },
  async (req: FastifyRequest<{ Body: { email?: string } }>, reply: FastifyReply) => {
    const input = emailInput.safeParse(req.body);
    if (!input.success) return reply.code(400).send({ error: "INVALID_INPUT" });
    const email = input.data.email;
    const u = await prisma.customerAccount.findUnique({ where: { email } });
    if (u) {
      const raw = token();
      await prisma.$transaction([
        prisma.passwordResetToken.updateMany({
          where: { accountId: u.id, usedAt: null },
          data: { usedAt: new Date() },
        }),
        prisma.passwordResetToken.create({
          data: {
            accountId: u.id,
            tokenHash: sha(raw),
            expiresAt: new Date(Date.now() + 1800000),
          },
        }),
      ]);
      await sendTransactionalMail({
        to: email,
        subject: "Reset your Lingo Store password",
        text:
          "Reset your password here: " +
          publicOrigin.replace(/\/$/, "") +
          "/reset-password?token=" +
          encodeURIComponent(raw),
      });
      if (process.env.NODE_ENV !== "production") return { ok: true, debugToken: raw };
    }
    return { ok: true };
  },
);
app.post<ApiRouteGeneric>(
  "/api/auth/reset-password",
  { config: { rateLimit: { max: 5, timeWindow: "15 minutes" } } },
  async (
    req: FastifyRequest<{ Body: { token?: string; password?: string } }>,
    reply: FastifyReply,
  ) => {
    const input = passwordResetInput.safeParse(req.body);
    if (!input.success) return reply.code(400).send({ error: "INVALID_INPUT" });
    const { token: raw, password } = input.data;
    const t = await prisma.passwordResetToken.findUnique({
      where: { tokenHash: sha(raw) },
    });
    if (!t || t.usedAt || t.expiresAt <= new Date())
      return reply.code(400).send({ error: "INVALID_TOKEN" });
    const account = await prisma.customerAccount.findUnique({
      where: { id: t.accountId },
    });
    if (!account) return reply.code(400).send({ error: "INVALID_TOKEN" });
    try {
      validateCustomerPassword(password, account.email);
    } catch {
      return reply.code(400).send({ error: "INVALID_PASSWORD" });
    }
    await assertNotBreached(password);
    const result = await prisma.$transaction(async (tx) => {
      const consumed = await tx.passwordResetToken.updateMany({
        where: { id: t.id, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      });
      if (consumed.count !== 1) return false;
      await tx.customerAccount.update({
        where: { id: t.accountId },
        data: { passwordHash: await hashPassword(password) },
      });
      await tx.session.updateMany({
        where: { customerAccountId: t.accountId },
        data: { revokedAt: new Date() },
      });
      return true;
    });
    if (!result) return reply.code(400).send({ error: "INVALID_TOKEN" });
    return { ok: true };
  },
);
app.get<ApiRouteGeneric>(
  "/api/account/profile",
  { preHandler: customer },
  async (req: RequestWithSession) => customerDto(requestCustomer(req).customerAccount),
);
app.get<ApiRouteGeneric>(
  "/api/account/orders",
  { preHandler: customer },
  async (req: RequestWithSession) => {
    const account = requestCustomer(req).customerAccount;
    const [webOrders, posSales] = await Promise.all([
      prisma.webOrder.findMany({
        where: { customerAccountId: requestCustomer(req).customerAccount.id },
        orderBy: { createdAt: "desc" },
        take: 100,
        select: {
          id: true,
          invoiceNo: true,
          status: true,
          paymentStatus: true,
          paymentMethod: true,
          totalMinor: true,
          createdAt: true,
          items: {
            select: {
              productName: true,
              quantity: true,
              unitPriceMinor: true,
              totalMinor: true,
            },
          },
          cashReceipts: { select: { amountMinor: true, createdAt: true } },
        },
      }),
      account.businessCustomerId
        ? prisma.sale.findMany({
            where: { customerId: account.businessCustomerId },
            orderBy: { createdAt: "desc" },
            take: 100,
            select: {
              id: true,
              invoiceNo: true,
              status: true,
              totalMinor: true,
              paidMinor: true,
              createdAt: true,
              items: {
                select: {
                  quantity: true,
                  unitPriceMinor: true,
                  totalMinor: true,
                  product: { select: { name: true } },
                },
              },
              payments: { select: { method: true } },
            },
          })
        : Promise.resolve([]),
    ]);
    return json(
      [
        ...webOrders,
        ...posSales.map((sale) => ({
          id: sale.id,
          invoiceNo: sale.invoiceNo,
          status: sale.status,
          paymentStatus: sale.paidMinor >= sale.totalMinor ? "PAID" : "UNPAID",
          paymentMethod: sale.payments.map((payment) => payment.method).join(", "),
          totalMinor: sale.totalMinor,
          createdAt: sale.createdAt,
          items: sale.items.map((item) => ({
            productName: item.product.name,
            quantity: item.quantity,
            unitPriceMinor: item.unitPriceMinor,
            totalMinor: item.totalMinor,
          })),
        })),
      ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
    );
  },
);
app.post<ApiRouteGeneric>(
  "/api/account/orders",
  {
    preHandler: customer,
    config: { rateLimit: { max: 5, timeWindow: "15 minutes" } },
  },
  async (req: RequestWithSession, reply) => {
    const parsed = webOrderCreateInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_ORDER" });
    const customerAccount = requestCustomer(req).customerAccount;
    if (!customerAccount.emailVerifiedAt)
      return reply.code(403).send({ error: "EMAIL_VERIFICATION_REQUIRED" });
    const rawHeader = req.headers["idempotency-key"];
    const header = idempotencyKey.safeParse(rawHeader);
    if (!header.success || header.data !== parsed.data.idempotencyKey)
      return reply.code(400).send({ error: "INVALID_IDEMPOTENCY_KEY" });
    const b = parsed.data;
    const scope = "web.order.create";
    const findPrevious = () =>
      prisma.idempotencyKey.findUnique({
        where: {
          key_scope_actorId: {
            key: b.idempotencyKey,
            scope,
            actorId: customerAccount.id,
          },
        },
      });
    const previous = await findPrevious();
    if (previous?.status === "COMPLETED") return previous.response;
    try {
      const response = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${customerAccount.id + ":" + b.idempotencyKey}, 0))`;
        const duplicate = await tx.idempotencyKey.findUnique({
          where: {
            key_scope_actorId: {
              key: b.idempotencyKey,
              scope,
              actorId: customerAccount.id,
            },
          },
        });
        if (duplicate?.status === "COMPLETED") return duplicate.response;

        const productMap = new Map<
          string,
          {
            product: NonNullable<Awaited<ReturnType<typeof tx.product.findUnique>>>;
            quantityMilli: bigint;
          }
        >();
        const currentCatalog = new Map<
          string,
          { productName: string; unitPriceMinor: bigint; unitCostMinor: bigint }
        >();
        for (const item of b.items) {
          const product = await tx.product.findUnique({ where: { id: item.productId } });
          if (!product || product.archivedAt) throw new Error("PRODUCT_UNAVAILABLE");
          currentCatalog.set(product.id, {
            productName: product.name,
            unitPriceMinor: product.priceMinor,
            unitCostMinor: product.costMinor,
          });
          const existing = productMap.get(product.id);
          productMap.set(product.id, {
            product,
            quantityMilli: (existing?.quantityMilli ?? 0n) + qtyMilli(item.quantity),
          });
        }
        const pricing = calculateWebOrderPricing(b.items, currentCatalog);
        const { items: orderLines, subtotalMinor } = pricing;
        for (const { product, quantityMilli } of productMap.values()) {
          const quantity = Number(quantityMilli) / 1000;
          const updated = await tx.product.updateMany({
            where: { id: product.id, version: product.version, stock: { gte: quantity } },
            data: { stock: { decrement: quantity }, version: { increment: 1 } },
          });
          if (updated.count !== 1) throw new Error("INSUFFICIENT_STOCK");
        }
        const order = await tx.webOrder.create({
          data: {
            invoiceNo: "WEB-" + Date.now() + "-" + randomBytes(4).toString("hex"),
            customerAccountId: customerAccount.id,
            paymentMethod: PaymentMethod.CASH,
            subtotalMinor,
            totalMinor: subtotalMinor,
            recipientName: b.recipientName,
            recipientPhone: b.recipientPhone,
            shippingAddress: b.shippingAddress,
            items: { create: orderLines },
          },
          select: {
            id: true,
            invoiceNo: true,
            status: true,
            paymentStatus: true,
            paymentMethod: true,
            subtotalMinor: true,
            totalMinor: true,
            createdAt: true,
          },
        });
        for (const { product, quantityMilli } of productMap.values())
          await tx.inventoryMovement.create({
            data: {
              productId: product.id,
              quantity: -Number(quantityMilli) / 1000,
              type: "WEB_ORDER",
              referenceId: order.id,
            },
          });
        const result = {
          ...order,
          subtotalMinor: order.subtotalMinor.toString(),
          totalMinor: order.totalMinor.toString(),
        };
        await tx.idempotencyKey.create({
          data: {
            key: b.idempotencyKey,
            scope,
            actorId: customerAccount.id,
            status: "COMPLETED",
            response: prismaJson(result),
          },
        });
        return result;
      });
      await audit(
        undefined,
        "web_order.created",
        "web_order",
        String(bodyField(response, "id")),
        true,
        { paymentMethod: "CASH", surface: "public" },
        req,
      );
      return response;
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const duplicate = await findPrevious();
        if (duplicate?.status === "COMPLETED") return duplicate.response;
      }
      const message = error instanceof Error ? error.message : "ORDER_FAILED";
      if (message === "PRODUCT_UNAVAILABLE") return reply.code(400).send({ error: message });
      if (message === "INSUFFICIENT_STOCK") return reply.code(409).send({ error: message });
      return reply.code(400).send({ error: message });
    }
  },
);
app.get<ApiRouteGeneric>(
  "/api/account/orders/:id",
  { preHandler: customer },
  async (req: RequestWithSession, reply) => {
    const parsedId = resourceId.safeParse(req.params.id);
    if (!parsedId.success) return reply.code(404).send({ error: "NOT_FOUND" });
    const order = await prisma.webOrder.findFirst({
      where: { id: parsedId.data, customerAccountId: requestCustomer(req).customerAccount.id },
      select: {
        id: true,
        invoiceNo: true,
        status: true,
        paymentStatus: true,
        paymentMethod: true,
        subtotalMinor: true,
        totalMinor: true,
        createdAt: true,
        items: {
          select: { productName: true, quantity: true, unitPriceMinor: true, totalMinor: true },
        },
        cashReceipts: { select: { amountMinor: true, createdAt: true } },
      },
    });
    if (order) return json(order);
    const customerAccount = requestCustomer(req).customerAccount;
    const sale = customerAccount.businessCustomerId
      ? await prisma.sale.findFirst({
          where: { id: parsedId.data, customerId: customerAccount.businessCustomerId },
          select: {
            id: true,
            invoiceNo: true,
            status: true,
            totalMinor: true,
            createdAt: true,
            items: {
              select: {
                quantity: true,
                unitPriceMinor: true,
                totalMinor: true,
                product: { select: { name: true } },
              },
            },
            payments: { select: { amountMinor: true, method: true, reference: true } },
          },
        })
      : null;
    if (!sale) return reply.code(404).send({ error: "NOT_FOUND" });
    return json(sale);
  },
);
app.patch<ApiRouteGeneric>(
  "/api/account/profile",
  { preHandler: customer },
  async (req: RequestWithSession, reply) => {
    if (!requestCustomer(req).customerAccount.emailVerifiedAt)
      return reply.code(403).send({ error: "EMAIL_VERIFICATION_REQUIRED" });
    const input = customerProfileInput.safeParse(req.body);
    if (!input.success) return reply.code(400).send({ error: "INVALID_INPUT" });
    const b = input.data;
    return customerDto(
      await prisma.customerAccount.update({
        where: { id: requestCustomer(req).customerAccount.id },
        data: {
          name: b.name ?? requestCustomer(req).customerAccount.name,
          phone: b.phone ?? requestCustomer(req).customerAccount.phone,
        },
      }),
    );
  },
);
app.post<ApiRouteGeneric>(
  "/api/auth/register",
  { config: { rateLimit: { max: 5, timeWindow: "1 hour" } } },
  async (req: RequestWithSession, reply) => {
    const input = customerRegistrationInput.safeParse(req.body);
    if (!input.success) return reply.code(400).send({ error: "INVALID_INPUT" });
    const { email, password, name, phone } = input.data;
    const normalized = email.trim().toLowerCase();
    let u = await prisma.customerAccount.findUnique({
      where: { email: normalized },
    });
    if (!u) {
      try {
        validateCustomerPassword(password, normalized);
      } catch {
        return reply.code(400).send({ error: "INVALID_PASSWORD" });
      }
      await assertNotBreached(password);
      u = await prisma.customerAccount.create({
        data: {
          email: normalized,
          name: name.trim(),
          phone: phone?.trim() || null,
          passwordHash: await hashPassword(password),
        },
      });
      const raw = token();
      await prisma.emailVerificationToken.create({
        data: {
          accountId: u.id,
          tokenHash: sha(raw),
          expiresAt: new Date(Date.now() + 86400000),
        },
      });
      await sendTransactionalMail({
        to: normalized,
        subject: "Verify your Lingo Store email",
        text:
          "Verify your email here: " +
          publicOrigin.replace(/\/$/, "") +
          "/verify-email?token=" +
          encodeURIComponent(raw),
      });
    }
    return {
      ok: true,
      message: "If the address can be registered, a verification message has been sent.",
    };
  },
);
app.post<ApiRouteGeneric>(
  "/api/auth/login",
  {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: "15 minutes",
        keyGenerator: (req: FastifyRequest) =>
          req.ip + ":" + String(bodyField(req.body, "email") || ""),
      },
    },
  },
  async (req: RequestWithSession, reply) => {
    const input = customerLoginInput.safeParse(req.body);
    if (!input.success) return reply.code(400).send({ error: "INVALID_INPUT" });
    const { email, password } = input.data;
    const u = await prisma.customerAccount.findUnique({ where: { email } });
    if (!u) {
      await verifyPassword(password, DUMMY_PASSWORD_HASH);
      return reply.code(401).send({ error: "INVALID_CREDENTIALS" });
    }
    if (!(await verifyPassword(password, u.passwordHash)))
      return reply.code(401).send({ error: "INVALID_CREDENTIALS" });
    if (needsPasswordRehash(u.passwordHash))
      await prisma.customerAccount.update({
        where: { id: u.id },
        data: { passwordHash: await hashPassword(password) },
      });
    await setSession(
      reply,
      SessionKind.CUSTOMER,
      {
        customerAccountId: u.id,
        ip: req.ip,
        userAgent: String(req.headers["user-agent"] || ""),
      },
      2592000,
      "__Host-lingo_sid",
      604800,
    );
    return {
      user: {
        id: u.id,
        email: u.email,
        name: u.name,
        emailVerified: Boolean(u.emailVerifiedAt),
      },
    };
  },
);
app.post<ApiRouteGeneric>(
  "/api/auth/logout",
  { preHandler: customer },
  async (req: RequestWithSession, reply) => {
    const t = req.cookies["__Host-lingo_sid"];
    if (!t) {
      reply.clearCookie("__Host-lingo_sid", customerCookieOpts);
      return { ok: true };
    }
    await prisma.session.updateMany({
      where: { tokenHash: sha(t) },
      data: { revokedAt: new Date() },
    });
    reply.clearCookie("__Host-lingo_sid", customerCookieOpts);
    return { ok: true };
  },
);
app.get<ApiRouteGeneric>(
  "/api/auth/me",
  { preHandler: customer },
  async (req: RequestWithSession) => ({
    user: {
      id: requestCustomer(req).customerAccount.id,
      email: requestCustomer(req).customerAccount.email,
      name: requestCustomer(req).customerAccount.name,
      emailVerified: Boolean(requestCustomer(req).customerAccount.emailVerifiedAt),
    },
  }),
);
app.post<ApiRouteGeneric>(
  "/api/account/security/password",
  {
    preHandler: customer,
    config: { rateLimit: { max: 5, timeWindow: "15 minutes" } },
  },
  async (req: RequestWithSession, reply) => {
    const input = passwordChangeInput.safeParse(req.body);
    if (!input.success) return reply.code(400).send({ error: "INVALID_INPUT" });
    const { currentPassword: current, newPassword: next } = input.data;
    const u = requestCustomer(req).customerAccount;
    if (!u.passwordHash || !(await verifyPassword(current, u.passwordHash)))
      return reply.code(401).send({ error: "INVALID_CREDENTIALS" });
    try {
      validateCustomerPassword(next, u.email);
    } catch {
      return reply.code(400).send({ error: "INVALID_PASSWORD" });
    }
    await assertNotBreached(next);
    await prisma.$transaction([
      prisma.customerAccount.update({
        where: { id: u.id },
        data: { passwordHash: await hashPassword(next) },
      }),
      prisma.session.updateMany({
        where: { customerAccountId: u.id },
        data: { revokedAt: new Date() },
      }),
    ]);
    reply.clearCookie("__Host-lingo_sid", cookieOpts);
    reply.clearCookie("__Host-lingo_csrf", csrfOpts);
    return { ok: true, reauthenticate: true };
  },
);
app.get<ApiRouteGeneric>("/api/public/products", async () =>
  json(
    await prisma.product.findMany({
      where: { archivedAt: null },
      orderBy: { name: "asc" },
      take: 100,
      select: {
        id: true,
        sku: true,
        name: true,
        description: true,
        priceMinor: true,
        category: { select: { id: true, name: true, description: true } },
      },
    }),
  ),
);
app.get<ApiRouteGeneric>("/api/public/categories", async () =>
  json(await prisma.category.findMany({ orderBy: { name: "asc" } })),
);
app.post<ApiRouteGeneric>(
  "/api/public/contact",
  { config: { rateLimit: { max: 5, timeWindow: "1 hour" } } },
  async (req: RequestWithSession, reply) => {
    const input = contactInput.safeParse(req.body);
    if (!input.success) return reply.code(400).send({ error: "INVALID_CONTACT" });
    const { email, name, message, turnstileToken } = input.data;
    if (
      String(name).includes("\r") ||
      String(name).includes("\\n") ||
      String(email).includes("\r") ||
      String(email).includes("\\n")
    )
      throw Error("INVALID_CONTACT");
    if (process.env.NODE_ENV === "production") {
      if (!process.env.TURNSTILE_SECRET_KEY || !turnstileToken)
        return reply.code(400).send({ error: "CAPTCHA_REQUIRED" });
      const vr = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          secret: process.env.TURNSTILE_SECRET_KEY,
          response: String(turnstileToken),
          remoteip: String(req.ip),
        }),
      });
      const payload: unknown = await vr.json();
      if (
        typeof payload !== "object" ||
        payload === null ||
        !("success" in payload) ||
        payload.success !== true
      )
        return reply.code(400).send({ error: "CAPTCHA_FAILED" });
    }
    return json(
      await prisma.contactMessage.create({
        data: {
          email: String(email).trim(),
          name: String(name).trim(),
          message: String(message),
        },
      }),
    );
  },
);
const consumeTotp = async (staffUserId: string, secret: string, code: string) => {
  const step = verifyTotp(secret, code);
  if (step === null) return false;
  const r = await prisma.mfaCredential.updateMany({
    where: { staffUserId, lastAcceptedStep: { lt: BigInt(step) } },
    data: { lastAcceptedStep: BigInt(step) },
  });
  return r.count === 1;
};
const pendingAdmin = async (req: FastifyRequest, reply: FastifyReply) => {
  const raw = req.cookies["__Host-lingo_admin_sid"];
  if (!raw) return reply.code(401).send({ error: "UNAUTHENTICATED" });
  const s = await prisma.session.findFirst({
    where: {
      tokenHash: sha(raw),
      kind: SessionKind.ADMIN,
      state: "PENDING_MFA",
      revokedAt: null,
      expiresAt: { gt: new Date() },
      idleExpiresAt: { gt: new Date() },
    },
    include: { staffUser: true, customerAccount: true, terminal: true },
  });
  if (!s?.staffUser?.isActive || s.staffUser.status !== StaffStatus.ACTIVE)
    return reply.code(401).send({ error: "UNAUTHENTICATED" });
  setReqSession(req, s);
};
app.post<ApiRouteGeneric>(
  "/api/admin/auth/request-password-reset",
  { config: { rateLimit: { max: 3, timeWindow: "1 hour" } } },
  async (req: RequestWithSession, reply) => {
    const parsed = emailInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_INPUT" });
    const email = parsed.data.email,
      u = await prisma.staffUser.findFirst({ where: { email } });
    if (u) {
      const raw = token();
      await prisma.$transaction([
        prisma.staffPasswordResetToken.updateMany({
          where: { staffUserId: u.id, usedAt: null },
          data: { usedAt: new Date() },
        }),
        prisma.staffPasswordResetToken.create({
          data: {
            staffUserId: u.id,
            tokenHash: sha(raw),
            expiresAt: new Date(Date.now() + 1800000),
          },
        }),
      ]);
      await sendTransactionalMail({
        to: email,
        subject: "Reset your Lingo Store staff password",
        text:
          "Reset your password here: " +
          adminOrigin.replace(/\/$/, "") +
          "/reset-password?token=" +
          encodeURIComponent(raw),
      });
    }
    return { ok: true };
  },
);
app.post<ApiRouteGeneric>(
  "/api/admin/auth/reset-password",
  { config: { rateLimit: { max: 5, timeWindow: "15 minutes" } } },
  async (req: RequestWithSession, reply) => {
    const input = passwordResetInput.safeParse(req.body);
    if (!input.success) return reply.code(400).send({ error: "INVALID_INPUT" });
    const { token: raw, password } = input.data;
    const t = await prisma.staffPasswordResetToken.findUnique({
      where: { tokenHash: sha(raw) },
      include: { staffUser: true },
    });
    if (!t || t.usedAt || t.expiresAt <= new Date() || !t.staffUser)
      return reply.code(400).send({ error: "INVALID_TOKEN" });
    try {
      validatePassword(password, t.staffUser.email || t.staffUser.username);
      await assertNotBreached(password);
    } catch {
      return reply.code(400).send({ error: "INVALID_PASSWORD" });
    }
    const result = await prisma.$transaction(async (tx) => {
      const consumed = await tx.staffPasswordResetToken.updateMany({
        where: { id: t.id, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      });
      if (consumed.count !== 1) return false;
      await tx.staffUser.update({
        where: { id: t.staffUser.id },
        data: { passwordHash: await hashPassword(password) },
      });
      await tx.session.updateMany({
        where: { staffUserId: t.staffUser.id },
        data: { revokedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          actorId: t.staffUser.id,
          action: "staff.password.reset",
          entity: "staff",
          entityId: t.staffUser.id,
          success: true,
          outcome: "success",
          ip: req.ip,
          userAgent: String(req.headers["user-agent"] || ""),
          requestId: req.requestId,
        },
      });
      return true;
    });
    if (!result) return reply.code(400).send({ error: "INVALID_TOKEN" });
    return { ok: true };
  },
);
app.post<ApiRouteGeneric>(
  "/api/admin/auth/login",
  {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: "15 minutes",
        keyGenerator: (req: FastifyRequest) =>
          req.ip + ":" + String(bodyField(req.body, "username") || ""),
      },
    },
  },
  async (req: RequestWithSession, reply) => {
    const input = adminLoginInput.safeParse(req.body);
    if (!input.success) return reply.code(401).send({ error: "INVALID_CREDENTIALS" });
    const { username, email, password } = input.data;
    const u = await prisma.staffUser.findFirst({
      where: username ? { username } : { email },
      include: { mfaCredentials: true },
    });
    if (!u) {
      await verifyPassword(password, DUMMY_PASSWORD_HASH);
      return reply.code(401).send({ error: "INVALID_CREDENTIALS" });
    }
    if (!u.isActive || !u.passwordHash || !(await verifyPassword(password, u.passwordHash))) {
      await audit(
        u?.id,
        "admin.login.denied",
        "staff",
        u?.id,
        false,
        { reason: "credentials" },
        req,
      );
      return reply.code(401).send({ error: "INVALID_CREDENTIALS" });
    }
    if (needsPasswordRehash(u.passwordHash))
      await prisma.staffUser.update({
        where: { id: u.id },
        data: { passwordHash: await hashPassword(password) },
      });
    if (!u.mfaEnabled || !u.mfaCredentials[0])
      return reply.code(403).send({ error: "MFA_ENROLLMENT_REQUIRED" });
    const raw = token();
    await prisma.session.create({
      data: {
        tokenHash: sha(raw),
        kind: SessionKind.ADMIN,
        state: "PENDING_MFA",
        staffUserId: u.id,
        ip: req.ip,
        userAgent: String(req.headers["user-agent"] || ""),
        expiresAt: new Date(Date.now() + 300000),
        idleExpiresAt: new Date(Date.now() + 300000),
      },
    });
    reply.setCookie("__Host-lingo_admin_sid", raw, {
      ...cookieOpts,
      maxAge: 300,
    });
    reply.setCookie("__Host-lingo_admin_csrf", token(), { ...csrfOpts, maxAge: 300 });
    await audit(u.id, "admin.login.password_ok", "staff", u.id, true, {}, req);
    return { requiresMfa: true };
  },
);
app.post<ApiRouteGeneric>(
  "/api/admin/auth/mfa",
  {
    preHandler: pendingAdmin,
    config: {
      rateLimit: {
        max: 5,
        timeWindow: "5 minutes",
        keyGenerator: (req: FastifyRequest) =>
          String(req.cookies["__Host-lingo_admin_sid"] || req.ip),
      },
    },
  },
  async (req: RequestWithSession, reply) => {
    const input = adminMfaInput.safeParse(req.body);
    if (!input.success) return reply.code(400).send({ error: "INVALID_MFA" });
    const { otp, recoveryCode } = input.data;
    const s = requestStaff(req).session;
    const u = await prisma.staffUser.findUnique({
      where: { id: s.staffUser.id },
      include: { mfaCredentials: true },
    });
    if (
      !u ||
      !u.isActive ||
      u.status !== StaffStatus.ACTIVE ||
      !(await hasPermission(u.id, "admin.access"))
    )
      return reply.code(403).send({ error: "FORBIDDEN" });
    let ok = false;
    if (typeof otp === "string" && u.mfaCredentials[0])
      ok = await consumeTotp(u.id, decryptMfaSecret(u.mfaCredentials[0].secretEncrypted), otp);
    if (!ok && typeof recoveryCode === "string") {
      const h = sha(recoveryCode.trim());
      const x = await prisma.recoveryCode.findFirst({
        where: { staffUserId: u.id, codeHash: h, usedAt: null },
      });
      if (x) {
        const consumed = await prisma.recoveryCode.updateMany({
          where: { id: x.id, usedAt: null },
          data: { usedAt: new Date() },
        });
        ok = consumed.count === 1;
      }
    }
    if (!ok) {
      await audit(u.id, "admin.mfa.denied", "staff", u.id, false, {}, req);
      return reply.code(401).send({ error: "INVALID_MFA" });
    }
    const next = token();
    await prisma.$transaction([
      prisma.session.update({
        where: { id: s.id },
        data: { revokedAt: new Date() },
      }),
      prisma.session.create({
        data: {
          tokenHash: sha(next),
          kind: SessionKind.ADMIN,
          state: "ACTIVE",
          staffUserId: u.id,
          ip: req.ip,
          userAgent: String(req.headers["user-agent"] || ""),
          expiresAt: new Date(Date.now() + 28800000),
          idleExpiresAt: new Date(Date.now() + 1200000),
          mfaVerifiedAt: new Date(),
        },
      }),
    ]);
    reply.setCookie("__Host-lingo_admin_sid", next, {
      ...cookieOpts,
      maxAge: 28800,
    });
    reply.setCookie("__Host-lingo_admin_csrf", token(), { ...csrfOpts, maxAge: 28800 });
    await audit(u.id, "admin.login", "staff", u.id, true, {}, req);
    const role = await getStaffRoleNames(u.id);
    return { user: { id: u.id, name: u.name, role: role[0] ?? "" } };
  },
);
app.post<ApiRouteGeneric>(
  "/api/admin/auth/step-up",
  { preHandler: staff() },
  async (req: RequestWithSession, reply) => {
    const input = stepUpInput.safeParse(req.body);
    if (!input.success) return reply.code(400).send({ error: "INVALID_INPUT" });
    const { password, otp, recoveryCode } = input.data;
    const s = requestStaff(req).session;
    const u = await prisma.staffUser.findUnique({
      where: { id: s.staffUser.id },
      include: { mfaCredentials: true },
    });
    if (!u?.passwordHash || !(await verifyPassword(password, u.passwordHash)))
      return reply.code(401).send({ error: "STEP_UP_FAILED" });
    let ok = false;
    if (u.mfaCredentials[0])
      ok = await consumeTotp(
        u.id,
        decryptMfaSecret(u.mfaCredentials[0].secretEncrypted),
        otp ?? "",
      );
    if (!ok && recoveryCode) {
      const x = await prisma.recoveryCode.findFirst({
        where: {
          staffUserId: u.id,
          codeHash: sha(String(recoveryCode).trim()),
          usedAt: null,
        },
      });
      if (x) {
        const consumed = await prisma.recoveryCode.updateMany({
          where: { id: x.id, usedAt: null },
          data: { usedAt: new Date() },
        });
        ok = consumed.count === 1;
      }
    }
    if (!ok) return reply.code(401).send({ error: "STEP_UP_FAILED" });
    const next = token();
    await prisma.$transaction([
      prisma.session.update({
        where: { id: s.id },
        data: { revokedAt: new Date() },
      }),
      prisma.session.create({
        data: {
          tokenHash: sha(next),
          kind: SessionKind.ADMIN,
          state: "ACTIVE",
          staffUserId: u.id,
          expiresAt: s.expiresAt,
          idleExpiresAt: new Date(Date.now() + 1200000),
          mfaVerifiedAt: s.mfaVerifiedAt,
          stepUpUntil: new Date(Date.now() + 300000),
        },
      }),
    ]);
    reply.setCookie("__Host-lingo_admin_sid", next, {
      ...cookieOpts,
      maxAge: Math.max(1, Math.floor((s.expiresAt.getTime() - Date.now()) / 1000)),
    });
    const csrfValue = token();
    reply.setCookie("__Host-lingo_admin_csrf", csrfValue, { ...csrfOpts, maxAge: 300 });
    await audit(u.id, "admin.step_up", "staff", u.id, true, {}, req);
    return { ok: true, expiresIn: 300, csrfToken: csrfValue };
  },
);
app.get<ApiRouteGeneric>(
  "/api/admin/users/assignable-roles",
  { preHandler: staff() },
  async (req: RequestWithSession, reply) => {
    if (!(await hasPermission(requestStaff(req).staffUser.id, "users.assign_role")))
      return reply.code(403).send({ error: "FORBIDDEN" });
    const keys = await actorPermissionKeys(requestStaff(req).staffUser.id);
    const roles = await prisma.role.findMany({
      include: { permissions: { include: { permission: true } } },
    });
    return json(
      roles
        .filter((r) => r.permissions.every((p) => keys.has(p.permission.key)))
        .map((r) => ({ id: r.id, name: r.name })),
    );
  },
);
app.get<ApiRouteGeneric>("/api/admin/users/invitations", { preHandler: staff() }, async () =>
  json(
    await prisma.staffInvitation.findMany({
      where: { usedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
      select: {
        id: true,
        email: true,
        roleName: true,
        expiresAt: true,
        createdAt: true,
        invitee: {
          select: { id: true, name: true, username: true, status: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  ),
);
app.post<ApiRouteGeneric>(
  "/api/admin/users/invitations/:id/revoke",
  { preHandler: [staff(), stepUp] },
  async (req: RequestWithSession, reply) => {
    const parsedId = resourceId.safeParse(req.params.id);
    if (!parsedId.success) return reply.code(400).send({ error: "INVALID_ID" });
    if (!(await hasPermission(requestStaff(req).staffUser.id, "users.create")))
      return reply.code(403).send({ error: "FORBIDDEN" });
    const i = await prisma.staffInvitation.findUnique({
      where: { id: parsedId.data },
    });
    if (!i || i.usedAt || i.revokedAt) return reply.code(404).send({ error: "NOT_FOUND" });
    await prisma.staffInvitation.update({
      where: { id: i.id },
      data: { revokedAt: new Date() },
    });
    await audit(
      requestStaff(req).staffUser.id,
      "staff.invitation.revoked",
      "staff",
      i.inviteeId ?? undefined,
      true,
      {},
      req,
    );
    return { ok: true };
  },
);
app.post<ApiRouteGeneric>(
  "/api/admin/users/invitations/:id/resend",
  { preHandler: [staff(), stepUp] },
  async (req: RequestWithSession, reply) => {
    const parsedId = resourceId.safeParse(req.params.id);
    if (!parsedId.success) return reply.code(400).send({ error: "INVALID_ID" });
    if (!(await hasPermission(requestStaff(req).staffUser.id, "users.create")))
      return reply.code(403).send({ error: "FORBIDDEN" });
    const i = await prisma.staffInvitation.findUnique({
      where: { id: parsedId.data },
      include: { invitee: true },
    });
    if (!i || i.usedAt || i.revokedAt || !i.invitee)
      return reply.code(404).send({ error: "NOT_FOUND" });
    const raw = token(),
      secret = base32(randomBytes(20)),
      expiresAt = new Date(Date.now() + 172800000);
    await prisma.staffInvitation.update({
      where: { id: i.id },
      data: {
        tokenHash: sha(raw),
        mfaSecretEncrypted: encryptMfaSecret(secret),
        expiresAt,
      },
    });
    const setupUrl = adminOrigin.replace(/\/$/, "") + "/setup/" + encodeURIComponent(raw);
    try {
      await sendStaffSetupMail({
        to: i.email,
        name: i.invitee.name ?? i.email,
        setupUrl,
        totpSecret: secret,
        expiresAt,
      });
    } catch {
      return reply.code(503).send({ error: "INVITATION_DELIVERY_FAILED" });
    }
    await audit(
      requestStaff(req).staffUser.id,
      "staff.invitation.resent",
      "staff",
      i.invitee.id,
      true,
      {},
      req,
    );
    return { ok: true, expiresAt };
  },
);
app.patch<ApiRouteGeneric>(
  "/api/admin/users/:id/status",
  { preHandler: [staff(), stepUp] },
  async (req: RequestWithSession, reply) => {
    const parsed = staffStatusInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_INPUT" });
    const parsedId = resourceId.safeParse(req.params.id);
    if (!parsedId.success) return reply.code(400).send({ error: "INVALID_ID" });
    const id = parsedId.data,
      enabled = parsed.data.isActive,
      actor = requestStaff(req).staffUser.id;
    if (id === actor) return reply.code(400).send({ error: "SELF_MODIFICATION_FORBIDDEN" });
    const target = await prisma.staffUser.findUnique({ where: { id } });
    if (!target) return reply.code(404).send({ error: "NOT_FOUND" });
    const targetHasAdminAccess = target.isActive && (await hasPermission(id, "admin.access"));
    let x;
    try {
      x = await prisma.$transaction(async (tx) => {
        if (!enabled && targetHasAdminAccess) await lockAdminRoster(tx);
        const u = await tx.staffUser.update({
          where: { id },
          data: {
            isActive: enabled,
            status: enabled ? StaffStatus.ACTIVE : StaffStatus.DISABLED,
          },
        });
        if (!enabled)
          await tx.session.updateMany({
            where: { staffUserId: id },
            data: { revokedAt: new Date() },
          });
        if (!enabled && targetHasAdminAccess) await assertAnActiveAdminRemains(tx);
        await tx.auditLog.create({
          data: {
            actorId: actor,
            action: enabled ? "staff.enabled" : "staff.disabled",
            entity: "staff",
            entityId: id,
            success: true,
            outcome: "success",
          },
        });
        return u;
      });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "LAST_ADMIN_PROTECTED")
        return reply.code(409).send({ error: "LAST_ADMIN_PROTECTED" });
      throw error;
    }
    return staffDto(x);
  },
);
app.patch<ApiRouteGeneric>(
  "/api/admin/users/:id/role",
  { preHandler: [staff(), stepUp] },
  async (req: RequestWithSession, reply) => {
    const parsed = staffRoleInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_INPUT" });
    const parsedId = resourceId.safeParse(req.params.id);
    if (!parsedId.success) return reply.code(400).send({ error: "INVALID_ID" });
    const id = parsedId.data,
      actor = requestStaff(req).staffUser.id,
      roleName = parsed.data.role.toLowerCase();
    if (id === actor) return reply.code(400).send({ error: "SELF_ROLE_EDIT_FORBIDDEN" });
    if (!(await hasPermission(actor, "users.assign_role")))
      return reply.code(403).send({ error: "FORBIDDEN" });
    const targetRole = await prisma.role.findUnique({
      where: { name: roleName },
      include: { permissions: { include: { permission: true } } },
    });
    const actorKeys = await actorPermissionKeys(actor);
    if (!targetRole || targetRole.permissions.some((x) => !actorKeys.has(x.permission.key)))
      return reply.code(403).send({ error: "ROLE_OUTSIDE_AUTHORITY" });
    const target = await prisma.staffUser.findUnique({ where: { id } });
    if (!target) return reply.code(404).send({ error: "NOT_FOUND" });
    const targetHadAdmin = await hasPermission(id, "admin.access"),
      targetGetsAdmin = targetRole.permissions.some((x) => x.permission.key === "admin.access");
    let x;
    try {
      x = await prisma.$transaction(async (tx) => {
        if (targetHadAdmin && !targetGetsAdmin) await lockAdminRoster(tx);
        await tx.staffRoleAssignment.deleteMany({ where: { staffUserId: id } });
        await tx.staffRoleAssignment.create({
          data: { staffUserId: id, roleId: targetRole.id },
        });
        if (targetHadAdmin && !targetGetsAdmin) await assertAnActiveAdminRemains(tx);
        await tx.session.updateMany({
          where: { staffUserId: id },
          data: { revokedAt: new Date() },
        });
        await tx.auditLog.create({
          data: {
            actorId: actor,
            action: "staff.role.updated",
            entity: "staff",
            entityId: id,
            success: true,
            outcome: "success",
            metadata: { role: roleName },
          },
        });
        return targetRole;
      });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "LAST_ADMIN_PROTECTED")
        return reply.code(409).send({ error: "LAST_ADMIN_PROTECTED" });
      throw error;
    }
    return json(x);
  },
);
app.get<ApiRouteGeneric>("/api/admin/users", { preHandler: staff() }, async () =>
  json(
    await prisma.staffUser.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        status: true,
        isActive: true,
        mfaEnabled: true,
        createdAt: true,
        roleAssignments: { select: { role: { select: { name: true } } } },
      },
    }),
  ),
);
app.post<ApiRouteGeneric>(
  "/api/admin/users/invitations",
  { preHandler: [staff(), stepUp] },
  async (req: RequestWithSession, reply) => {
    const parsed = staffInvitationInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_INPUT" });
    const { email, name, username } = parsed.data;
    const roleName = (parsed.data.roleName ?? parsed.data.role ?? "").toLowerCase();
    if (!roleName) return reply.code(400).send({ error: "INVALID_INPUT" });
    const actorKeys = await actorPermissionKeys(requestStaff(req).staffUser.id);
    if (!actorKeys.has("users.create") || !actorKeys.has("users.assign_role"))
      return reply.code(403).send({ error: "FORBIDDEN" });
    const target = await prisma.role.findUnique({
      where: { name: roleName },
      include: { permissions: { include: { permission: true } } },
    });
    if (!target || target.permissions.some((x) => !actorKeys.has(x.permission.key)))
      return reply.code(403).send({ error: "ROLE_OUTSIDE_AUTHORITY" });
    const exists = await prisma.staffUser.findFirst({
      where: { OR: [{ username }, { email }] },
    });
    if (exists) return reply.code(409).send({ error: "STAFF_EXISTS" });
    const raw = token(),
      secret = base32(randomBytes(20));
    const invite = await prisma.$transaction(async (tx) => {
      const u = await tx.staffUser.create({
        data: {
          username,
          email,
          name,
          status: StaffStatus.PENDING_SETUP,
          passwordHash: null,
          isActive: false,
          mfaEnabled: false,
        },
      });
      const roleRow = await tx.role.findUnique({ where: { name: roleName } });
      if (!roleRow) throw Error("ROLE_NOT_FOUND");
      await tx.staffRoleAssignment.create({
        data: { staffUserId: u.id, roleId: roleRow.id },
      });
      const i = await tx.staffInvitation.create({
        data: {
          email,
          tokenHash: sha(raw),
          roleName,
          inviteeId: u.id,
          mfaSecretEncrypted: encryptMfaSecret(secret),
          expiresAt: new Date(Date.now() + 172800000),
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: requestStaff(req).staffUser.id,
          action: "staff.invited",
          entity: "staff",
          entityId: u.id,
          success: true,
          outcome: "success",
          metadata: { role: roleName, email },
        },
      });
      return { i, u };
    });
    const setupUrl = adminOrigin.replace(/\/$/, "") + "/setup/" + encodeURIComponent(raw);
    try {
      await sendStaffSetupMail({
        to: email,
        name,
        setupUrl,
        totpSecret: secret,
        expiresAt: invite.i.expiresAt,
      });
    } catch (e) {
      await prisma.staffInvitation.update({
        where: { id: invite.i.id },
        data: { revokedAt: new Date() },
      });
      await audit(
        requestStaff(req).staffUser.id,
        "staff.invitation.delivery_failed",
        "staff",
        invite.u.id,
        false,
        {},
        req,
      );
      return reply.code(503).send({ error: "INVITATION_DELIVERY_FAILED" });
    }
    return { inviteId: invite.i.id, expiresAt: invite.i.expiresAt };
  },
);
app.get<ApiRouteGeneric>("/api/admin/auth/setup/:token", async (req: RequestWithSession, reply) => {
  const parsedToken = opaqueToken.safeParse(req.params.token);
  if (!parsedToken.success) return reply.code(400).send({ error: "INVALID_INVITATION" });
  const raw = parsedToken.data;
  const i = await prisma.staffInvitation.findUnique({
    where: { tokenHash: sha(raw) },
    include: { invitee: true },
  });
  if (!i || i.usedAt || i.revokedAt || i.expiresAt < new Date() || !i.invitee)
    return reply.code(400).send({ error: "INVALID_INVITATION" });
  if (!i.mfaSecretEncrypted) return reply.code(400).send({ error: "INVALID_INVITATION" });
  const delivery = typeof req.query === "object" && req.query !== null
    ? (req.query as Record<string, unknown>).delivery
    : undefined;
  if (typeof delivery !== "string") return reply.code(400).send({ error: "SETUP_DELIVERY_REQUIRED" });
  let delivered: ReturnType<typeof decryptSetupDeliveryPayload>;
  try {
    delivered = decryptSetupDeliveryPayload(delivery);
  } catch {
    return reply.code(400).send({ error: "INVALID_SETUP_DELIVERY" });
  }
  if (delivered.expiresAt.getTime() !== i.expiresAt.getTime())
    return reply.code(400).send({ error: "INVALID_SETUP_DELIVERY" });
  const storedSecret = decryptMfaSecret(i.mfaSecretEncrypted);
  if (storedSecret !== delivered.totpSecret)
    return reply.code(400).send({ error: "INVALID_SETUP_DELIVERY" });
  return {
    email: i.email,
    name: i.invitee.name,
    role: i.roleName,
    totpSecret: delivered.totpSecret,
    expiresAt: i.expiresAt,
  };
});
app.post<ApiRouteGeneric>(
  "/api/admin/users/setup",
  {
    preHandler: async (req: RequestWithSession, reply) => {
      const parsed = staffSetupInput.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: "INVALID_SETUP" });
      const raw = parsed.data.token;
      const i = await prisma.staffInvitation.findUnique({
        where: { tokenHash: sha(raw) },
        include: { invitee: true },
      });
      if (!i || i.usedAt || i.revokedAt || i.expiresAt < new Date() || !i.invitee)
        return reply.code(400).send({ error: "INVALID_INVITATION" });
      req.invite = i;
    },
  },
  async (req: RequestWithSession, reply) => {
    const input = staffSetupInput.safeParse(req.body);
    if (!input.success) return reply.code(400).send({ error: "INVALID_SETUP" });
    const i = requestInvitation(req);
    const password = input.data.password;
    const secret = input.data.totpSecret.toUpperCase();
    const otp = input.data.otp;
    const stored = i.mfaSecretEncrypted ? decryptMfaSecret(i.mfaSecretEncrypted) : "";
    const enrollmentStep = verifyTotp(secret, otp);
    if (!stored || stored !== secret || enrollmentStep === null)
      return reply.code(400).send({ error: "INVALID_MFA" });
    try {
      validatePassword(password, i.email || i.invitee.username);
    } catch {
      return reply.code(400).send({ error: "INVALID_PASSWORD" });
    }
    await assertNotBreached(password);
    const passwordHash = await hashPassword(password),
      codes = Array.from({ length: 10 }, () => token().slice(0, 16));
    const accepted = await prisma.$transaction(async (tx) => {
      const consumed = await tx.staffInvitation.updateMany({
        where: {
          id: i.id,
          usedAt: null,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { usedAt: new Date(), mfaSecretEncrypted: null },
      });
      if (consumed.count !== 1) return false;
      await tx.staffUser.update({
        where: { id: i.invitee.id },
        data: {
          passwordHash,
          status: StaffStatus.ACTIVE,
          isActive: true,
          mfaEnabled: true,
        },
      });
      await tx.mfaCredential.create({
        data: {
          staffUserId: i.invitee.id,
          secretEncrypted:
            i.mfaSecretEncrypted ??
            (() => {
              throw Error("INVITATION_MFA_SECRET_MISSING");
            })(),
          lastAcceptedStep: BigInt(enrollmentStep),
        },
      });
      await tx.recoveryCode.createMany({
        data: codes.map((code) => ({
          staffUserId: i.invitee.id,
          codeHash: sha(code),
        })),
      });
      await tx.auditLog.create({
        data: {
          actorId: i.invitee.id,
          action: "staff.invitation.accepted",
          entity: "staff",
          entityId: i.invitee.id,
          success: true,
          outcome: "success",
        },
      });
      return true;
    });
    if (!accepted) return reply.code(400).send({ error: "INVALID_INVITATION" });
    return { ok: true, recoveryCodes: codes };
  },
);
app.post<ApiRouteGeneric>(
  "/api/admin/auth/logout",
  { preHandler: staff() },
  async (req: RequestWithSession, reply) => {
    const raw = req.cookies["__Host-lingo_admin_sid"];
    if (!raw) {
      reply.clearCookie("__Host-lingo_admin_sid", cookieOpts);
      return { ok: true };
    }
    await prisma.session.updateMany({
      where: { tokenHash: sha(raw) },
      data: { revokedAt: new Date() },
    });
    reply.clearCookie("__Host-lingo_admin_sid", cookieOpts);
    return { ok: true };
  },
);
app.get<ApiRouteGeneric>(
  "/api/admin/auth/me",
  { preHandler: staff() },
  async (req: RequestWithSession) => ({
    user: staffDto(requestStaff(req).staffUser),
    permissions: [...(await actorPermissionKeys(requestStaff(req).staffUser.id))],
  }),
);
app.post<ApiRouteGeneric>(
  "/api/admin/account/security/password",
  {
    preHandler: [staff(), stepUp],
    config: { rateLimit: { max: 5, timeWindow: "15 minutes" } },
  },
  async (req: RequestWithSession, reply) => {
    const parsed = staffPasswordChangeInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_INPUT" });
    const { currentPassword: current, newPassword: next } = parsed.data,
      u = requestStaff(req).staffUser;
    if (!u.passwordHash || !(await verifyPassword(current, u.passwordHash)))
      return reply.code(401).send({ error: "INVALID_CREDENTIALS" });
    try {
      validatePassword(next, u.email || u.username);
    } catch {
      return reply.code(400).send({ error: "INVALID_PASSWORD" });
    }
    await assertNotBreached(next);
    await prisma.$transaction([
      prisma.staffUser.update({
        where: { id: u.id },
        data: { passwordHash: await hashPassword(next) },
      }),
      prisma.session.updateMany({
        where: { staffUserId: u.id },
        data: { revokedAt: new Date() },
      }),
      prisma.auditLog.create({
        data: {
          actorId: u.id,
          action: "staff.password.changed",
          entity: "staff",
          entityId: u.id,
          success: true,
          outcome: "success",
          ip: req.ip,
          userAgent: String(req.headers["user-agent"] || ""),
          requestId: req.requestId,
          sessionRef: requestSession(req).id,
        },
      }),
    ]);
    reply.clearCookie("__Host-lingo_admin_sid", cookieOpts);
    reply.clearCookie("__Host-lingo_admin_csrf", csrfOpts);
    return { ok: true, reauthenticate: true };
  },
);
app.get<ApiRouteGeneric>(
  "/api/admin/sessions",
  { preHandler: staff() },
  async (req: RequestWithSession) =>
    json(
      await prisma.session.findMany({
        where: { staffUserId: requestStaff(req).staffUser.id },
        select: {
          id: true,
          kind: true,
          state: true,
          createdAt: true,
          lastSeenAt: true,
          expiresAt: true,
          idleExpiresAt: true,
          revokedAt: true,
          ip: true,
          userAgent: true,
          terminalId: true,
        },
        orderBy: { createdAt: "desc" },
      }),
    ),
);
app.post<ApiRouteGeneric>(
  "/api/admin/sessions/:id/revoke",
  { preHandler: staff() },
  async (req: RequestWithSession, reply) => {
    const parsedId = resourceId.safeParse(req.params.id);
    if (!parsedId.success) return reply.code(400).send({ error: "INVALID_ID" });
    const id = parsedId.data,
      own = await prisma.session.findUnique({
        where: { id },
        select: { staffUserId: true },
      });
    if (!own) return reply.code(404).send({ error: "NOT_FOUND" });
    if (
      own.staffUserId !== requestStaff(req).staffUser.id &&
      !(await hasPermission(requestStaff(req).staffUser.id, "sessions.revoke"))
    )
      return reply.code(403).send({ error: "FORBIDDEN" });
    await prisma.session.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
    await audit(requestStaff(req).staffUser.id, "session.revoke", "session", id, true, {}, req);
    return { ok: true };
  },
);
app.get<ApiRouteGeneric>("/api/admin/roles", { preHandler: staff() }, async () =>
  json(
    await prisma.role.findMany({
      include: { permissions: { include: { permission: true } } },
    }),
  ),
);
app.post<ApiRouteGeneric>(
  "/api/admin/roles",
  { preHandler: [staff(), stepUp] },
  async (req: RequestWithSession, reply) => {
    const parsed = roleCreateInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_ROLE_NAME" });
    if (!(await hasPermission(requestStaff(req).staffUser.id, "roles.manage")))
      return reply.code(403).send({ error: "FORBIDDEN" });
    const name = parsed.data.name.toLowerCase();
    const exists = await prisma.role.findUnique({ where: { name } });
    if (exists) return reply.code(409).send({ error: "ROLE_EXISTS" });
    const x = await prisma.role.create({ data: { name } });
    await audit(requestStaff(req).staffUser.id, "role.created", "role", x.id, true, { name }, req);
    return json(x);
  },
);
app.patch<ApiRouteGeneric>(
  "/api/admin/roles/:id/permissions",
  { preHandler: [staff(), stepUp] },
  async (req: RequestWithSession, reply) => {
    const parsed = rolePermissionsInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_INPUT" });
    const parsedId = resourceId.safeParse(req.params.id);
    if (!parsedId.success) return reply.code(400).send({ error: "INVALID_ID" });
    const r = await prisma.role.findUnique({
      where: { id: parsedId.data },
      include: { permissions: { include: { permission: true } } },
    });
    if (!r) return reply.code(404).send({ error: "NOT_FOUND" });
    const keys = parsed.data.permissions;
    const perms = await prisma.permission.findMany({
      where: { key: { in: keys } },
    });
    if (perms.length !== keys.length) return reply.code(400).send({ error: "UNKNOWN_PERMISSION" });
    const actorKeys = await actorPermissionKeys(requestStaff(req).staffUser.id);
    if (keys.some((key) => !actorKeys.has(key)))
      return reply.code(403).send({ error: "PERMISSION_OUTSIDE_AUTHORITY" });
    if (r.name === "admin" && !keys.includes("admin.access"))
      return reply.code(409).send({ error: "ADMIN_ACCESS_REQUIRED" });
    const removesAdminAccess =
      r.permissions.some((entry) => entry.permission.key === "admin.access") &&
      !keys.includes("admin.access");
    try {
      await prisma.$transaction(async (tx) => {
        if (removesAdminAccess) await lockAdminRoster(tx);
        await tx.rolePermission.deleteMany({ where: { roleId: r.id } });
        await tx.rolePermission.createMany({
          data: perms.map((permission) => ({
            roleId: r.id,
            permissionId: permission.id,
          })),
        });
        if (removesAdminAccess) await assertAnActiveAdminRemains(tx);
      });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "LAST_ADMIN_PROTECTED")
        return reply.code(409).send({ error: "LAST_ADMIN_PROTECTED" });
      throw error;
    }
    await audit(
      requestStaff(req).staffUser.id,
      "role.permissions.updated",
      "role",
      r.id,
      true,
      { permissions: keys },
      req,
    );
    return { ok: true };
  },
);
app.post<ApiRouteGeneric>(
  "/api/admin/users/:id/reset-mfa",
  { preHandler: [staff(), stepUp] },
  async (req: RequestWithSession, reply) => {
    if (!(await hasPermission(requestStaff(req).staffUser.id, "users.reset_mfa")))
      return reply.code(403).send({ error: "FORBIDDEN" });
    const parsedId = resourceId.safeParse(req.params.id);
    if (!parsedId.success) return reply.code(400).send({ error: "INVALID_ID" });
    const id = parsedId.data;
    if (id === requestStaff(req).staffUser.id)
      return reply.code(400).send({ error: "SELF_MFA_RESET_FORBIDDEN" });
    const target = await prisma.staffUser.findUnique({ where: { id } });
    if (!target) return reply.code(404).send({ error: "NOT_FOUND" });
    if (!target.email) return reply.code(409).send({ error: "STAFF_EMAIL_REQUIRED" });
    const targetEmail = target.email;
    const secret = base32(randomBytes(20));
    const rawToken = token();
    const expiresAt = new Date(Date.now() + 900000);
    const roles = await getStaffRoleNames(id);
    let invitationId: string;
    try {
      invitationId = await prisma.$transaction(async (tx) => {
        if (await hasPermission(id, "admin.access")) {
          await lockAdminRoster(tx);
          if ((await countActiveAdminAccess(tx)) < 2) throw Error("LAST_ADMIN_PROTECTED");
        }
        await tx.mfaCredential.deleteMany({ where: { staffUserId: id } });
        await tx.recoveryCode.deleteMany({ where: { staffUserId: id } });
        await tx.session.updateMany({
          where: { staffUserId: id },
          data: { revokedAt: new Date() },
        });
        await tx.staffInvitation.updateMany({
          where: { inviteeId: id, usedAt: null, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        await tx.staffUser.update({
          where: { id },
          data: { status: StaffStatus.PENDING_SETUP, isActive: false, mfaEnabled: false },
        });
        const invitation = await tx.staffInvitation.create({
          data: {
            email: targetEmail,
            tokenHash: sha(rawToken),
            roleName: roles[0] ?? null,
            inviteeId: id,
            mfaSecretEncrypted: encryptMfaSecret(secret),
            expiresAt,
          },
        });
        await tx.auditLog.create({
          data: {
            actorId: requestStaff(req).staffUser.id,
            action: "staff.mfa.reset",
            entity: "staff",
            entityId: id,
            success: true,
            outcome: "success",
            requestId: req.requestId,
          },
        });
        return invitation.id;
      });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "LAST_ADMIN_PROTECTED")
        return reply.code(409).send({ error: "LAST_ADMIN_PROTECTED" });
      throw error;
    }
    try {
      await sendStaffSetupMail({
        to: targetEmail,
        name: target.name,
        setupUrl: adminOrigin.replace(/\/$/, "") + "/setup/" + encodeURIComponent(rawToken),
        totpSecret: secret,
        expiresAt,
      });
    } catch {
      return reply.code(503).send({ error: "INVITATION_DELIVERY_FAILED", invitationId });
    }
    return { ok: true, expiresAt };
  },
);
app.get<ApiRouteGeneric>("/api/admin/settings", { preHandler: staff() }, async () =>
  json(await prisma.setting.findMany()),
);
app.put<ApiRouteGeneric>(
  "/api/admin/settings/:key",
  { preHandler: [staff(), stepUp] },
  async (req: RequestWithSession, reply) => {
    const parsed = settingUpdateInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_INPUT" });
    const value = parsed.data.value === null ? Prisma.JsonNull : parsed.data.value;
    const key = String(req.params.key);
    if (!/^[a-z0-9_.-]{1,80}$/.test(key)) return reply.code(400).send({ error: "INVALID_KEY" });
    const x = await prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
    await audit(
      requestStaff(req).staffUser.id,
      "setting.updated",
      "setting",
      x.id,
      true,
      { key },
      req,
    );
    return json(x);
  },
);
app.get<ApiRouteGeneric>(
  "/api/admin/dashboard",
  { preHandler: staff() },
  async (req: RequestWithSession) => {
    const [s, web, p, c, e] = await Promise.all([
      prisma.sale.aggregate({ _sum: { totalMinor: true }, _count: true }),
      prisma.webOrder.aggregate({
        where: { paymentStatus: "PAID" },
        _sum: { totalMinor: true },
        _count: true,
      }),
      prisma.product.count({ where: { archivedAt: null } }),
      prisma.customer.count(),
      prisma.expense.aggregate({ _sum: { amountMinor: true } }),
    ]);
    const out: {
      salesMinor: bigint;
      invoices: number;
      products: number;
      customers: number;
      expensesMinor: bigint;
      profitMinor?: bigint;
    } = {
      salesMinor: (s._sum.totalMinor || 0n) + (web._sum.totalMinor || 0n),
      invoices: s._count + web._count,
      products: p,
      customers: c,
      expensesMinor: e._sum.amountMinor || 0n,
    };
    if (await hasPermission(requestStaff(req).staffUser.id, "reports.view_profit")) {
      const [items, webItems] = await Promise.all([
        prisma.saleItem.findMany({
          select: { quantity: true, unitCostMinor: true },
        }),
        prisma.webOrderItem.findMany({
          where: { order: { paymentStatus: "PAID" } },
          select: { quantity: true, unitCostMinor: true },
        }),
      ]);
      let cost = 0n;
      for (const item of [...items, ...webItems]) {
        cost += minorForQuantity(item.unitCostMinor, item.quantity);
      }
      out.profitMinor = out.salesMinor - cost - out.expensesMinor;
    }
    return json(out);
  },
);
app.get<ApiRouteGeneric>("/api/admin/sales", { preHandler: staff() }, async () =>
  json(
    await prisma.sale.findMany({
      orderBy: { createdAt: "desc" },
      take: 1000,
      include: {
        items: { include: { product: { select: { name: true } } } },
        payments: true,
        refunds: true,
        customer: { select: { id: true, name: true, phone: true } },
        cashier: { select: { id: true, name: true, username: true } },
        terminal: { select: { id: true, name: true } },
      },
    }),
  ),
);
app.get<ApiRouteGeneric>("/api/admin/orders", { preHandler: staff() }, async () =>
  json(
    await prisma.webOrder.findMany({
      orderBy: { createdAt: "desc" },
      take: 500,
      include: {
        customerAccount: { select: { id: true, name: true, email: true, phone: true } },
        items: {
          select: { productName: true, quantity: true, unitPriceMinor: true, totalMinor: true },
        },
        cashReceipts: {
          select: { id: true, amountMinor: true, createdAt: true, receivedByStaffId: true },
        },
      },
    }),
  ),
);
app.post<ApiRouteGeneric>(
  "/api/admin/orders/:id/status",
  { preHandler: [staff(), stepUp] },
  async (req: RequestWithSession, reply) => {
    const input = webOrderStatusInput.safeParse(req.body);
    const parsedId = resourceId.safeParse(req.params.id);
    if (!input.success || !parsedId.success)
      return reply.code(400).send({ error: "INVALID_ORDER_UPDATE" });
    const b = input.data;
    try {
      const updated = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "WebOrder" WHERE "id" = ${parsedId.data} FOR UPDATE`;
        const order = await tx.webOrder.findUnique({
          where: { id: parsedId.data },
          include: { items: true },
        });
        if (!order) throw new Error("ORDER_NOT_FOUND");
        if (!canTransitionWebOrder(order.status, b.status))
          throw new Error("INVALID_ORDER_TRANSITION");
        if (b.status === "CANCELLED") {
          if (order.paymentStatus === "PAID") throw new Error("PAID_ORDER_CANNOT_BE_CANCELLED");
          for (const item of order.items) {
            const quantity = Number(item.quantity);
            await tx.product.update({
              where: { id: item.productId },
              data: { stock: { increment: quantity }, version: { increment: 1 } },
            });
            await tx.inventoryMovement.create({
              data: {
                productId: item.productId,
                quantity,
                type: "WEB_ORDER_CANCEL",
                referenceId: order.id,
                note: b.reason,
              },
            });
          }
        }
        return tx.webOrder.update({
          where: { id: order.id },
          data: { status: WebOrderStatus[b.status], version: { increment: 1 } },
          select: { id: true, invoiceNo: true, status: true, paymentStatus: true, version: true },
        });
      });
      await audit(
        requestStaff(req).staffUser.id,
        "web_order.status",
        "web_order",
        updated.id,
        true,
        {
          status: updated.status,
          reason: b.reason,
        },
        req,
      );
      return updated;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "ORDER_UPDATE_FAILED";
      if (message === "ORDER_NOT_FOUND") return reply.code(404).send({ error: "NOT_FOUND" });
      if (message === "INVALID_ORDER_TRANSITION") return reply.code(409).send({ error: message });
      if (message === "PAID_ORDER_CANNOT_BE_CANCELLED")
        return reply.code(409).send({ error: message });
      return reply.code(400).send({ error: message });
    }
  },
);
app.post<ApiRouteGeneric>(
  "/api/admin/orders/:id/cash-payment",
  { preHandler: [staff(), stepUp] },
  async (req: RequestWithSession, reply) => {
    const parsedId = resourceId.safeParse(req.params.id);
    const input = webOrderCashReceiptInput.safeParse(req.body);
    const header = idempotencyKey.safeParse(req.headers["idempotency-key"]);
    if (
      !parsedId.success ||
      !input.success ||
      !header.success ||
      header.data !== input.data.idempotencyKey
    )
      return reply.code(400).send({ error: "INVALID_CASH_RECEIPT" });
    const b = input.data;
    const staffId = requestStaff(req).staffUser.id;
    const scope = `web.order.cash:${parsedId.data}`;
    const findReceiptReplay = () =>
      prisma.idempotencyKey.findUnique({
        where: { key_scope_actorId: { key: b.idempotencyKey, scope, actorId: staffId } },
      });
    const replay = await findReceiptReplay();
    if (replay?.status === "COMPLETED") return replay.response;
    try {
      const result = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "WebOrder" WHERE "id" = ${parsedId.data} FOR UPDATE`;
        const idempotentReplay = await tx.idempotencyKey.findUnique({
          where: { key_scope_actorId: { key: b.idempotencyKey, scope, actorId: staffId } },
        });
        if (idempotentReplay?.status === "COMPLETED")
          return { replay: idempotentReplay.response, receipt: null };
        const order = await tx.webOrder.findUnique({
          where: { id: parsedId.data },
          include: { cashReceipts: true },
        });
        if (!order) throw new Error("ORDER_NOT_FOUND");
        const collected = order.cashReceipts.reduce((sum, item) => sum + item.amountMinor, 0n);
        if (
          !canCollectCashForWebOrder({
            status: order.status,
            paymentStatus: order.paymentStatus,
            totalMinor: order.totalMinor,
            previouslyCollectedMinor: collected,
            amountMinor: b.amountMinor,
          })
        )
          throw new Error("INVALID_CASH_COLLECTION");
        const created = await tx.webOrderCashReceipt.create({
          data: {
            orderId: order.id,
            amountMinor: b.amountMinor,
            receivedByStaffId: staffId,
            idempotencyKey: b.idempotencyKey,
          },
          select: { id: true, orderId: true, amountMinor: true, createdAt: true },
        });
        await tx.webOrder.update({
          where: { id: order.id },
          data: {
            status: WebOrderStatus.COMPLETED,
            paymentStatus: "PAID",
            version: { increment: 1 },
          },
        });
        const result = { ...created, amountMinor: created.amountMinor.toString() };
        await tx.idempotencyKey.create({
          data: {
            key: b.idempotencyKey,
            scope,
            actorId: staffId,
            status: "COMPLETED",
            response: prismaJson(result),
          },
        });
        return { replay: undefined, receipt: { ...result, orderId: created.orderId } };
      });
      if (result.replay !== undefined) return result.replay;
      const receipt = result.receipt;
      if (!receipt) return reply.code(409).send({ error: "CASH_COLLECTION_FAILED" });
      await audit(
        staffId,
        "web_order.cash_received",
        "web_order",
        receipt.orderId,
        true,
        {
          amountMinor: b.amountMinor.toString(),
        },
        req,
      );
      return receipt;
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const duplicate = await findReceiptReplay();
        if (duplicate?.status === "COMPLETED") return duplicate.response;
      }
      const message = error instanceof Error ? error.message : "CASH_COLLECTION_FAILED";
      if (message === "ORDER_NOT_FOUND") return reply.code(404).send({ error: "NOT_FOUND" });
      if (message === "INVALID_CASH_COLLECTION") return reply.code(409).send({ error: message });
      return reply.code(400).send({ error: message });
    }
  },
);
app.get<ApiRouteGeneric>("/api/admin/purchases", { preHandler: staff() }, async () =>
  json(
    await prisma.purchase.findMany({
      orderBy: { createdAt: "desc" },
      take: 1000,
      include: {
        items: { include: { product: { select: { name: true } } } },
        supplier: { select: { id: true, name: true, phone: true } },
        createdBy: { select: { id: true, name: true, username: true } },
      },
    }),
  ),
);
app.get<ApiRouteGeneric>("/api/admin/payments", { preHandler: staff() }, async () =>
  json(
    await prisma.payment.findMany({
      orderBy: { createdAt: "desc" },
      take: 1000,
      include: { sale: { select: { id: true, invoiceNo: true } } },
    }),
  ),
);
app.get<ApiRouteGeneric>("/api/admin/customer-payments", { preHandler: staff() }, async () =>
  json(
    await prisma.customerPayment.findMany({
      orderBy: { createdAt: "desc" },
      take: 1000,
      include: { customer: { select: { id: true, name: true } } },
    }),
  ),
);
app.post<ApiRouteGeneric>(
  "/api/admin/customer-payments",
  { preHandler: staff() },
  async (req: RequestWithSession, reply) => {
    const parsed = customerPaymentInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_INPUT" });
    const b = parsed.data;
    const amount = money(b.amountMinor);
    const customerId = b.customerId;
    const x = await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findUnique({
        where: { id: customerId },
      });
      if (!customer) throw Error("NOT_FOUND");
      const payment = await tx.customerPayment.create({
        data: {
          customerId,
          amountMinor: amount,
          method: PaymentMethod[b.method],
          note: b.note || null,
        },
      });
      await tx.customer.update({
        where: { id: customerId },
        data: { balanceMinor: { decrement: amount } },
      });
      return payment;
    });
    await audit(
      requestStaff(req).staffUser.id,
      "customer.payment.create",
      "customer_payment",
      x.id,
      true,
      {},
      req,
    );
    return json(x);
  },
);
app.get<ApiRouteGeneric>("/api/admin/supplier-payments", { preHandler: staff() }, async () =>
  json(
    await prisma.supplierPayment.findMany({
      orderBy: { createdAt: "desc" },
      take: 1000,
      include: { supplier: { select: { id: true, name: true } } },
    }),
  ),
);
app.post<ApiRouteGeneric>(
  "/api/admin/supplier-payments",
  { preHandler: staff() },
  async (req: RequestWithSession, reply) => {
    const parsed = supplierPaymentInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_INPUT" });
    const b = parsed.data;
    const amount = money(b.amountMinor);
    const supplierId = b.supplierId;
    const x = await prisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.findUnique({
        where: { id: supplierId },
      });
      if (!supplier) throw Error("NOT_FOUND");
      const payment = await tx.supplierPayment.create({
        data: {
          supplierId,
          amountMinor: amount,
          method: PaymentMethod[b.method],
          note: b.note || null,
        },
      });
      await tx.supplier.update({
        where: { id: supplierId },
        data: { balanceMinor: { decrement: amount } },
      });
      return payment;
    });
    await audit(
      requestStaff(req).staffUser.id,
      "supplier.payment.create",
      "supplier_payment",
      x.id,
      true,
      {},
      req,
    );
    return json(x);
  },
);
app.get<ApiRouteGeneric>("/api/admin/cash-sessions", { preHandler: staff() }, async () =>
  json(
    await prisma.cashSession.findMany({
      orderBy: { openedAt: "desc" },
      take: 500,
      include: {
        openedBy: { select: { id: true, name: true } },
        terminal: { select: { id: true, name: true } },
      },
    }),
  ),
);
app.get<ApiRouteGeneric>("/api/admin/inventory", { preHandler: staff() }, async () =>
  json(
    await prisma.inventoryMovement.findMany({
      orderBy: { createdAt: "desc" },
      take: 1000,
      include: {
        product: {
          select: {
            id: true,
            sku: true,
            name: true,
            stock: true,
            version: true,
          },
        },
      },
    }),
  ),
);
app.get<ApiRouteGeneric>("/api/admin/categories", { preHandler: staff() }, async () =>
  json(await prisma.category.findMany({ orderBy: { name: "asc" } })),
);
app.post<ApiRouteGeneric>(
  "/api/admin/categories",
  { preHandler: staff() },
  async (req: RequestWithSession, reply) => {
    const parsed = categoryInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_INPUT" });
    const x = await prisma.category.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description || null,
      },
    });
    await audit(requestStaff(req).staffUser.id, "category.create", "category", x.id, true, {}, req);
    return json(x);
  },
);
type ProductWithOptionalCategory = Prisma.ProductGetPayload<{}> & {
  category?: Prisma.CategoryGetPayload<{}> | null;
};
const adminProductDto = async (userId: string, p: ProductWithOptionalCategory | null) => {
  if (await hasPermission(userId, "products.view_cost")) return json(p);
  if (!p) return null;
  const { costMinor: _costMinor, ...safe } = p;
  return json(safe);
};
app.get<ApiRouteGeneric>(
  "/api/admin/products",
  { preHandler: staff() },
  async (req: RequestWithSession) => {
    const rows = await prisma.product.findMany({
      where: { archivedAt: null },
      orderBy: { name: "asc" },
      include: { category: true },
    });
    return json(
      await Promise.all(rows.map((p) => adminProductDto(requestStaff(req).staffUser.id, p))),
    );
  },
);
app.post<ApiRouteGeneric>(
  "/api/admin/products",
  { preHandler: staff() },
  async (req: RequestWithSession, reply) => {
    const parsed = productCreateInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_INPUT" });
    const b = parsed.data;
    if (
      b.costMinor !== undefined &&
      !(await hasPermission(requestStaff(req).staffUser.id, "products.view_cost"))
    )
      return reply.code(403).send({ error: "FORBIDDEN" });
    const initialStock = b.stock ?? 0;
    const p = await prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          sku: b.sku,
          name: b.name,
          description: b.description,
          barcode: b.barcode || null,
          costMinor: b.costMinor === undefined ? 0n : money(b.costMinor),
          priceMinor: money(b.priceMinor),
          stock: initialStock,
          minStock: b.minStock ?? 0,
          categoryId: b.categoryId || null,
        },
      });
      if (initialStock > 0) {
        await tx.inventoryMovement.create({
          data: {
            productId: product.id,
            quantity: initialStock,
            type: "ADJUSTMENT",
            note: "Initial stock",
          },
        });
      }
      return product;
    });
    await audit(requestStaff(req).staffUser.id, "product.create", "product", p.id, true, {}, req);
    return adminProductDto(requestStaff(req).staffUser.id, p);
  },
);
app.patch<ApiRouteGeneric>(
  "/api/admin/products/:id",
  { preHandler: staff() },
  async (req: RequestWithSession, reply) => {
    const parsed = productUpdateInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_INPUT" });
    const parsedId = resourceId.safeParse(req.params.id);
    if (!parsedId.success) return reply.code(400).send({ error: "INVALID_ID" });
    const body = parsed.data;
    if (
      body.costMinor !== undefined &&
      !(await hasPermission(requestStaff(req).staffUser.id, "products.view_cost"))
    )
      return reply.code(403).send({ error: "FORBIDDEN" });
    const p = await prisma.product.findUnique({ where: { id: parsedId.data } });
    if (!p) return reply.code(404).send({ error: "NOT_FOUND" });
    if (Number(body.version) !== p.version)
      return reply.code(409).send({ error: "VERSION_CONFLICT" });
    const n = await prisma.product.updateMany({
      where: { id: p.id, version: p.version },
      data: {
        name: body.name ?? p.name,
        priceMinor: body.priceMinor === undefined ? p.priceMinor : money(body.priceMinor),
        costMinor: body.costMinor === undefined ? p.costMinor : money(body.costMinor),
        minStock: body.minStock ?? p.minStock,
        version: { increment: 1 },
      },
    });
    if (n.count !== 1) return reply.code(409).send({ error: "VERSION_CONFLICT" });
    await audit(requestStaff(req).staffUser.id, "product.update", "product", p.id, true, {}, req);
    return adminProductDto(
      requestStaff(req).staffUser.id,
      await prisma.product.findUnique({ where: { id: p.id } }),
    );
  },
);
app.delete<ApiRouteGeneric>(
  "/api/admin/products/:id",
  { preHandler: staff() },
  async (req: RequestWithSession, reply) => {
    const parsedId = resourceId.safeParse(req.params.id);
    if (!parsedId.success) return reply.code(400).send({ error: "INVALID_ID" });
    const product = await prisma.product.update({
      where: { id: parsedId.data },
      data: { archivedAt: new Date() },
    });
    await audit(
      requestStaff(req).staffUser.id,
      "product.archived",
      "product",
      product.id,
      true,
      {},
      req,
    );
    return json(product);
  },
);
app.get<ApiRouteGeneric>("/api/admin/customers", { preHandler: staff() }, async () =>
  json(await prisma.customer.findMany({ orderBy: { name: "asc" }, take: 1000 })),
);
app.post<ApiRouteGeneric>(
  "/api/admin/customers",
  { preHandler: staff() },
  async (req: RequestWithSession, reply) => {
    const parsed = customerCreateInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_INPUT" });
    const b = parsed.data,
      x = await prisma.customer.create({
        data: {
          name: String(b.name || "").trim(),
          phone: b.phone ? String(b.phone).trim() : null,
          email: b.email ? String(b.email).trim().toLowerCase() : null,
          address: b.address ? String(b.address).trim() : null,
        },
      });
    await audit(requestStaff(req).staffUser.id, "customer.create", "customer", x.id, true, {}, req);
    return json(x);
  },
);
app.patch<ApiRouteGeneric>(
  "/api/admin/customers/:id/account",
  { preHandler: staff() },
  async (req: RequestWithSession, reply) => {
    const parsed = customerAccountLinkInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_INPUT" });
    const parsedId = resourceId.safeParse(req.params.id);
    if (!parsedId.success) return reply.code(400).send({ error: "INVALID_ID" });
    const customerId = parsedId.data,
      accountId = parsed.data.accountId;
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });
    if (!customer) return reply.code(404).send({ error: "NOT_FOUND" });
    if (accountId) {
      const account = await prisma.customerAccount.findUnique({
        where: { id: accountId },
      });
      if (!account) return reply.code(404).send({ error: "ACCOUNT_NOT_FOUND" });
      if (account.businessCustomerId && account.businessCustomerId !== customerId)
        return reply.code(409).send({ error: "ACCOUNT_ALREADY_LINKED" });
    }
    const x = await prisma.$transaction(async (tx) => {
      if (accountId)
        await tx.customerAccount.update({
          where: { id: accountId },
          data: { businessCustomerId: customerId },
        });
      else {
        const current = await tx.customerAccount.findFirst({
          where: { businessCustomerId: customerId },
        });
        if (current)
          await tx.customerAccount.update({
            where: { id: current.id },
            data: { businessCustomerId: null },
          });
      }
      return tx.customer.findUnique({
        where: { id: customerId },
        include: { account: { select: { id: true, email: true, name: true } } },
      });
    });
    await audit(
      requestStaff(req).staffUser.id,
      "customer.account.linked",
      "customer",
      customerId,
      true,
      { accountId },
      req,
    );
    return json(x);
  },
);
app.get<ApiRouteGeneric>("/api/admin/suppliers", { preHandler: staff() }, async () =>
  json(await prisma.supplier.findMany({ orderBy: { name: "asc" }, take: 1000 })),
);
app.post<ApiRouteGeneric>(
  "/api/admin/suppliers",
  { preHandler: staff() },
  async (req: RequestWithSession, reply) => {
    const parsed = supplierCreateInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_INPUT" });
    const b = parsed.data,
      x = await prisma.supplier.create({
        data: {
          name: String(b.name || "").trim(),
          phone: b.phone?.trim() || null,
          email: b.email?.trim().toLowerCase() || null,
          address: b.address?.trim() || null,
        },
      });
    await audit(requestStaff(req).staffUser.id, "supplier.create", "supplier", x.id, true, {}, req);
    return json(x);
  },
);
app.post<ApiRouteGeneric>(
  "/api/admin/inventory/adjust",
  { preHandler: staff() },
  async (req: RequestWithSession, reply) => {
    const parsed = inventoryAdjustmentInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_INPUT" });
    const b = parsed.data,
      q = qty(b.quantity);
    const delta = Number(b.direction) == -1 ? -q : q;
    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: b.productId } });
      if (!product) throw Error("NOT_FOUND");
      const updated = await tx.product.updateMany({
        where: {
          id: product.id,
          version: b.version ?? product.version,
          stock: { gte: delta < 0 ? -delta : 0 },
        },
        data: { stock: { increment: delta }, version: { increment: 1 } },
      });
      if (updated.count !== 1) throw Error("VERSION_OR_STOCK_CONFLICT");
      const movement = await tx.inventoryMovement.create({
        data: { productId: product.id, quantity: delta, type: "ADJUSTMENT", note: b.note || null },
      });
      return { product, movement };
    });
    await audit(
      requestStaff(req).staffUser.id,
      "inventory.adjust",
      "product",
      result.product.id,
      true,
      { delta },
      req,
    );
    return json(result.movement);
  },
);
app.post<ApiRouteGeneric>(
  "/api/admin/purchases",
  { preHandler: staff() },
  async (req: RequestWithSession, reply) => {
    const parsed = purchaseInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_INPUT" });
    const b = parsed.data;
    const out = await prisma.$transaction(async (tx) => {
      let total = 0n;
      const rows: Array<{
        p: NonNullable<Awaited<ReturnType<typeof tx.product.findUnique>>>;
        q: number;
        cost: bigint;
        t: bigint;
      }> = [];
      for (const i of b.items || []) {
        const p = await tx.product.findUnique({ where: { id: i.productId } });
        if (!p) throw Error("PRODUCT_NOT_FOUND");
        const qMilli = qtyMilli(i.quantity),
          q = Number(qMilli) / 1000,
          cost = money(i.unitCostMinor),
          t = minorForQuantity(cost, i.quantity);
        total += t;
        rows.push({ p, q, cost, t });
      }
      if (!rows.length) throw Error("EMPTY_PURCHASE");
      const pu = await tx.purchase.create({
        data: {
          invoiceNo: b.invoiceNo || "PUR-" + Date.now(),
          subtotalMinor: total,
          totalMinor: total,
          supplierId: b.supplierId || null,
          createdById: requestStaff(req).staffUser.id,
          items: {
            create: rows.map((x) => ({
              productId: x.p.id,
              quantity: x.q,
              unitCostMinor: x.cost,
              totalMinor: x.t,
            })),
          },
        },
      });
      for (const x of rows) {
        await tx.product.update({
          where: { id: x.p.id },
          data: { stock: { increment: x.q }, version: { increment: 1 } },
        });
        await tx.inventoryMovement.create({
          data: {
            productId: x.p.id,
            quantity: x.q,
            type: "PURCHASE",
            referenceId: pu.id,
          },
        });
      }
      return pu;
    });
    await audit(
      requestStaff(req).staffUser.id,
      "purchase.create",
      "purchase",
      out.id,
      true,
      {},
      req,
    );
    return json(out);
  },
);
app.post<ApiRouteGeneric>(
  "/api/admin/expenses",
  {
    preHandler: staff(),
    config: { rateLimit: { max: 30, timeWindow: "1 hour" } },
  },
  async (req: RequestWithSession, reply) => {
    const parsed = expenseInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_INPUT" });
    const b = parsed.data;
    const x = await prisma.expense.create({
      data: {
        title: b.title,
        amountMinor: money(b.amountMinor),
        category: b.category,
        note: b.note?.trim() || null,
        createdById: requestStaff(req).staffUser.id,
      },
    });
    await audit(requestStaff(req).staffUser.id, "expense.create", "expense", x.id, true, {}, req);
    return json(x);
  },
);
app.get<ApiRouteGeneric>("/api/admin/expenses", { preHandler: staff() }, async () =>
  json(
    await prisma.expense.findMany({
      orderBy: { createdAt: "desc" },
      take: 1000,
    }),
  ),
);
app.post<ApiRouteGeneric>(
  "/api/admin/cash-sessions/open",
  { preHandler: staff() },
  async (req: RequestWithSession, reply) => {
    const parsed = cashOpenInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_INPUT" });
    const open = await prisma.cashSession.findFirst({
      where: { openedById: requestStaff(req).staffUser.id, status: CashStatus.OPEN },
    });
    if (open) return reply.code(409).send({ error: "CASH_SESSION_ALREADY_OPEN" });
    const x = await prisma.cashSession.create({
      data: {
        openingMinor: money(parsed.data.openingMinor),
        openedById: requestStaff(req).staffUser.id,
      },
    });
    await audit(
      requestStaff(req).staffUser.id,
      "cash_session.open",
      "cash_session",
      x.id,
      true,
      {},
      req,
    );
    return json(x);
  },
);
app.post<ApiRouteGeneric>(
  "/api/admin/cash-sessions/:id/close",
  { preHandler: staff() },
  async (req: RequestWithSession, reply) => {
    const parsed = cashCloseInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_INPUT" });
    const parsedId = resourceId.safeParse(req.params.id);
    if (!parsedId.success) return reply.code(400).send({ error: "INVALID_ID" });
    const c = await prisma.cashSession.findUnique({
      where: { id: parsedId.data },
    });
    if (!c || c.status !== CashStatus.OPEN)
      return reply.code(409).send({ error: "CASH_SESSION_NOT_OPEN" });
    const closing = money(parsed.data.closingMinor),
      variance = closing - (c.openingMinor || 0n);
    const closed = await prisma.cashSession.updateMany({
      where: { id: c.id, status: CashStatus.OPEN },
      data: {
        closingMinor: closing,
        status: CashStatus.CLOSED,
        closedAt: new Date(),
      },
    });
    if (closed.count !== 1) return reply.code(409).send({ error: "CASH_SESSION_NOT_OPEN" });
    const x = await prisma.cashSession.findUnique({ where: { id: c.id } });
    await audit(
      requestStaff(req).staffUser.id,
      "cash_session.close",
      "cash_session",
      c.id,
      true,
      { variance: variance.toString() },
      req,
    );
    return json(x);
  },
);
app.post<ApiRouteGeneric>(
  "/api/admin/terminals/enroll",
  { preHandler: [staff(), stepUp] },
  async (req: RequestWithSession) => {
    const raw = token();
    const e = await prisma.terminalEnrollment.create({
      data: { codeHash: sha(raw), expiresAt: new Date(Date.now() + 900000) },
    });
    return { enrollmentCode: raw, expiresAt: e.expiresAt };
  },
);
app.get<ApiRouteGeneric>("/api/admin/terminals", { preHandler: staff() }, async () =>
  json(await prisma.terminal.findMany({ orderBy: { createdAt: "desc" } })),
);
app.post<ApiRouteGeneric>(
  "/api/pos/auth/enroll",
  { config: { rateLimit: { max: 5, timeWindow: "15 minutes" } } },
  async (req: RequestWithSession, reply) => {
    const parsed = posEnrollmentInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_INPUT" });
    const enrollment = await prisma.terminalEnrollment.findUnique({
      where: { codeHash: sha(parsed.data.code) },
    });
    if (!enrollment || enrollment.usedAt || enrollment.expiresAt <= new Date())
      return reply.code(400).send({ error: "INVALID_ENROLLMENT" });
    const now = new Date();
    const consumed = await prisma.terminalEnrollment.updateMany({
      where: { id: enrollment.id, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    if (consumed.count !== 1) return reply.code(400).send({ error: "INVALID_ENROLLMENT" });
    const credential = token();
    try {
      const terminal = await prisma.terminal.create({
        data: { name: parsed.data.name, credentialHash: sha(credential) },
      });
      await prisma.terminalEnrollment.update({
        where: { id: enrollment.id },
        data: { terminalId: terminal.id },
      });
      reply.setCookie(POS_TERMINAL_COOKIE, credential, {
        ...cookieOpts,
        maxAge: POS_TERMINAL_CREDENTIAL_TTL_SECONDS,
      });
      await audit(
        undefined,
        "device.enrolled",
        "terminal",
        terminal.id,
        true,
        { surface: "pos" },
        req,
      );
      return { terminal: { id: terminal.id, name: terminal.name } };
    } catch (error) {
      await prisma.terminalEnrollment.updateMany({
        where: { id: enrollment.id, usedAt: now },
        data: { usedAt: null, terminalId: null },
      });
      throw error;
    }
  },
);
app.post<ApiRouteGeneric>(
  "/api/pos/auth/login",
  {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: "15 minutes",
        keyGenerator: (req: FastifyRequest) =>
          req.ip + ":" + String(bodyField(req.body, "username") || ""),
      },
    },
  },
  async (req: RequestWithSession, reply) => {
    const parsed = posLoginInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_INPUT" });
    const rawCredential = req.cookies[POS_TERMINAL_COOKIE];
    const credentialInput = opaqueToken.safeParse(rawCredential);
    const terminal = credentialInput.success
      ? await prisma.terminal.findUnique({ where: { credentialHash: sha(credentialInput.data) } })
      : null;
    if (!terminal) {
      const affected = rawCredential
        ? await prisma.terminal.findFirst({
            where: {
              OR: [
                { credentialHash: sha(rawCredential) },
                {
                  previousCredentialHash: sha(rawCredential),
                  previousCredentialExpiresAt: { gt: new Date() },
                },
              ],
            },
          })
        : null;
      if (affected) {
        const now = new Date();
        await prisma.$transaction([
          prisma.terminal.update({
            where: { id: affected.id },
            data: {
              isActive: false,
              previousCredentialHash: null,
              previousCredentialExpiresAt: null,
            },
          }),
          prisma.session.updateMany({
            where: { terminalId: affected.id, kind: SessionKind.POS, revokedAt: null },
            data: { revokedAt: now },
          }),
          prisma.deviceSession.updateMany({
            where: { terminalId: affected.id, revokedAt: null },
            data: { revokedAt: now },
          }),
          prisma.auditLog.create({
            data: {
              action: "device.credential.stale",
              entity: "terminal",
              entityId: affected.id,
              success: false,
              outcome: "failed",
              surface: "POS",
              metadata: { reason: "stale_or_invalid_terminal_credential" },
              ip: req.ip,
              userAgent: String(req.headers["user-agent"] || "") || undefined,
              requestId: req.requestId,
            },
          }),
        ]);
      }
      reply.clearCookie(POS_TERMINAL_COOKIE, cookieOpts);
      return reply.code(401).send({ error: "TERMINAL_REENROLLMENT_REQUIRED" });
    }
    if (!terminal.isActive) {
      reply.clearCookie(POS_TERMINAL_COOKIE, cookieOpts);
      return reply.code(401).send({ error: "TERMINAL_REENROLLMENT_REQUIRED" });
    }
    const { username, password } = parsed.data;
    const user = await prisma.staffUser.findUnique({ where: { username } });
    if (
      !user ||
      !user.isActive ||
      user.status !== StaffStatus.ACTIVE ||
      !user.passwordHash ||
      !(await hasPermission(user.id, "pos.use")) ||
      !(await verifyPassword(password, user.passwordHash))
    )
      return reply.code(401).send({ error: "INVALID_CREDENTIALS" });
    if (needsPasswordRehash(user.passwordHash)) {
      await prisma.staffUser.update({
        where: { id: user.id },
        data: { passwordHash: await hashPassword(password) },
      });
    }
    const now = new Date();
    const sessionId = token();
    const rotatedCredential = token();
    const { expiresAt, idleExpiresAt } = posSessionExpiries(now);
    await prisma.$transaction(async (tx) => {
      await tx.session.updateMany({
        where: { terminalId: terminal.id, kind: SessionKind.POS, revokedAt: null },
        data: { revokedAt: now },
      });
      await tx.terminal.update({
        where: { id: terminal.id },
        data: {
          credentialHash: sha(rotatedCredential),
          previousCredentialHash: sha(rawCredential!),
          previousCredentialExpiresAt: new Date(
            now.getTime() + POS_TERMINAL_CREDENTIAL_TTL_SECONDS * 1000,
          ),
          lastSeenAt: now,
        },
      });
      await tx.session.create({
        data: {
          tokenHash: sha(sessionId),
          kind: SessionKind.POS,
          state: "ACTIVE",
          staffUserId: user.id,
          terminalId: terminal.id,
          expiresAt,
          idleExpiresAt,
          lastSeenAt: now,
          ip: req.ip,
          userAgent: String(req.headers["user-agent"] || "") || null,
        },
      });
    });
    reply.setCookie("__Host-lingo_pos_sid", sessionId, { ...cookieOpts, maxAge: 12 * 60 * 60 });
    reply.setCookie("__Host-lingo_pos_terminal", rotatedCredential, {
      ...cookieOpts,
      maxAge: 180 * 24 * 60 * 60,
    });
    await audit(user.id, "pos.login", "terminal", terminal.id, true, { surface: "pos" }, req);
    return {
      user: { id: user.id, name: user.name, role: (await getStaffRoleNames(user.id))[0] ?? "" },
      terminal: { id: terminal.id, name: terminal.name },
    };
  },
);
app.post<ApiRouteGeneric>(
  "/api/pos/auth/unlock",
  { preHandler: pos },
  async (req: RequestWithSession, reply) => {
    const parsed = posUnlockInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_INPUT" });
    const { password } = parsed.data,
      u = requestStaff(req).staffUser;
    if (!u.passwordHash || !(await verifyPassword(password, u.passwordHash)))
      return reply.code(401).send({ error: "INVALID_CREDENTIALS" });
    return { ok: true };
  },
);
app.get<ApiRouteGeneric>(
  "/api/pos/auth/me",
  { preHandler: pos },
  async (req: RequestWithSession) => ({
    user: {
      id: requestStaff(req).staffUser.id,
      name: requestStaff(req).staffUser.name,
      role: (await getStaffRoleNames(requestStaff(req).staffUser.id))[0] ?? "",
    },
    terminal: { id: requestPos(req).terminal.id, name: requestPos(req).terminal.name },
  }),
);
app.post<ApiRouteGeneric>("/api/pos/auth/logout", async (req: RequestWithSession, reply) => {
  const raw = req.cookies[POS_SESSION_COOKIE];
  if (raw)
    await prisma.session.updateMany({
      where: { tokenHash: sha(raw), kind: SessionKind.POS, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  reply.clearCookie(POS_SESSION_COOKIE, cookieOpts);
  reply.clearCookie("__Host-lingo_pos_csrf", csrfOpts);
  return { ok: true };
});
app.get<ApiRouteGeneric>("/api/pos/products", { preHandler: pos }, async () =>
  json(
    await prisma.product.findMany({
      where: { archivedAt: null },
      select: {
        id: true,
        sku: true,
        barcode: true,
        name: true,
        priceMinor: true,
        stock: true,
        version: true,
      },
      orderBy: { name: "asc" },
    }),
  ),
);
app.get<ApiRouteGeneric>("/api/pos/catalog/products", { preHandler: pos }, async () =>
  json(
    await prisma.product.findMany({
      where: { archivedAt: null },
      select: {
        id: true,
        sku: true,
        barcode: true,
        name: true,
        priceMinor: true,
        stock: true,
        version: true,
      },
      orderBy: { name: "asc" },
    }),
  ),
);
app.get<ApiRouteGeneric>(
  "/api/pos/catalog/customers",
  { preHandler: pos },
  async (req: RequestWithSession, reply) => {
    const parsed = customerLookupQuery.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_QUERY" });
    const q = parsed.data.q ?? "";
    return json(
      await prisma.customer.findMany({
        where: {
          OR: [{ name: { contains: q } }, { phone: { contains: q } }],
        },
        select: { id: true, name: true, phone: true, email: true },
        take: 20,
        orderBy: { name: "asc" },
      }),
    );
  },
);
app.post<ApiRouteGeneric>(
  "/api/pos/catalog/customers",
  { preHandler: pos },
  async (req: RequestWithSession, reply) => {
    const parsed = customerCreateInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_INPUT" });
    const b = parsed.data;
    return json(
      await prisma.customer.create({
        data: {
          name: b.name.trim(),
          phone: b.phone || null,
          email: b.email || null,
          address: b.address || null,
        },
      }),
    );
  },
);
app.get<ApiRouteGeneric>(
  "/api/pos/cash-sessions/current",
  { preHandler: pos },
  async (req: RequestWithSession) =>
    json(
      await prisma.cashSession.findFirst({
        where: {
          openedById: requestStaff(req).staffUser.id,
          terminalId: requestPos(req).terminal.id,
          status: CashStatus.OPEN,
        },
        orderBy: { openedAt: "desc" },
      }),
    ),
);
app.post<ApiRouteGeneric>(
  "/api/pos/cash-sessions/open",
  { preHandler: pos },
  async (req: RequestWithSession, reply) => {
    const parsed = cashOpenInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_INPUT" });
    const open = await prisma.cashSession.findFirst({
      where: {
        openedById: requestStaff(req).staffUser.id,
        terminalId: requestPos(req).terminal.id,
        status: CashStatus.OPEN,
      },
    });
    if (open) return reply.code(409).send({ error: "CASH_SESSION_ALREADY_OPEN" });
    const c = await prisma.cashSession.create({
      data: {
        openingMinor: money(parsed.data.openingMinor),
        openedById: requestStaff(req).staffUser.id,
        terminalId: requestPos(req).terminal.id,
      },
    });
    await audit(
      requestStaff(req).staffUser.id,
      "cash_session.open",
      "cash_session",
      c.id,
      true,
      {},
      req,
    );
    return json(c);
  },
);
app.post<ApiRouteGeneric>(
  "/api/pos/cash-sessions/:id/close",
  { preHandler: pos },
  async (req: RequestWithSession, reply) => {
    const parsed = cashCloseInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_INPUT" });
    const parsedId = resourceId.safeParse(req.params.id);
    if (!parsedId.success) return reply.code(400).send({ error: "INVALID_ID" });
    const c = await prisma.cashSession.findUnique({
      where: { id: parsedId.data },
    });
    if (
      !c ||
      c.openedById !== requestStaff(req).staffUser.id ||
      c.terminalId !== requestPos(req).terminal.id ||
      c.status !== CashStatus.OPEN
    )
      return reply.code(404).send({ error: "NOT_FOUND" });
    const closing = money(parsed.data.closingMinor),
      variance = closing - c.openingMinor;
    const x = await prisma.cashSession.update({
      where: { id: c.id },
      data: {
        closingMinor: closing,
        status: CashStatus.CLOSED,
        closedAt: new Date(),
      },
    });
    await audit(
      requestStaff(req).staffUser.id,
      "cash_session.close",
      "cash_session",
      c.id,
      true,
      { variance: variance.toString() },
      req,
    );
    return json(x);
  },
);
app.post<ApiRouteGeneric>(
  "/api/pos/approvals",
  {
    preHandler: pos,
    config: { rateLimit: { max: 5, timeWindow: "5 minutes" } },
  },
  async (req: RequestWithSession, reply) => {
    const parsed = posApprovalInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_INPUT" });
    const b = parsed.data,
      requester = requestStaff(req).staffUser,
      username = b.username,
      password = b.password,
      action = b.action,
      reason = b.reason;
    const approver = await prisma.staffUser.findUnique({
      where: { username },
      include: { mfaCredentials: true },
    });
    if (
      !approver ||
      !approver.isActive ||
      approver.id === requester.id ||
      !approver.passwordHash ||
      !(await verifyPassword(password, approver.passwordHash)) ||
      !(await hasPermission(approver.id, "approvals.grant"))
    )
      return reply.code(403).send({ error: "APPROVAL_DENIED" });
    if (await hasPermission(approver.id, "admin.access")) {
      const otp = String(b.otp || "");
      if (
        !approver.mfaCredentials[0] ||
        !(await consumeTotp(
          approver.id,
          decryptMfaSecret(approver.mfaCredentials[0].secretEncrypted),
          otp,
        ))
      )
        return reply.code(403).send({ error: "APPROVAL_DENIED" });
    }
    const amount = b.amountMinor === undefined ? null : money(b.amountMinor);
    const a = await prisma.approval.create({
      data: {
        action,
        reason,
        grantorId: approver.id,
        terminalId: requestPos(req).terminal.id,
        cashierSessionId: requestSession(req).id,
        targetId: b.targetId ? String(b.targetId) : null,
        amountMinor: amount,
        expiresAt: new Date(Date.now() + 120000),
      },
    });
    await audit(
      approver.id,
      "approval.granted",
      "approval",
      a.id,
      true,
      { requesterId: requester.id, action, targetId: b.targetId || null },
      req,
    );
    return json(a);
  },
);
app.post<ApiRouteGeneric>(
  "/api/pos/sales",
  { preHandler: pos },
  async (req: RequestWithSession, reply) => {
    const input = createSaleInput.safeParse(req.body);
    if (!input.success) return reply.code(400).send({ error: "INVALID_SALE" });
    const b = input.data;
    const headerRaw = req.headers["idempotency-key"];
    const headerParsed = headerRaw === undefined ? null : idempotencyKey.safeParse(headerRaw);
    if (headerParsed && !headerParsed.success)
      return reply.code(400).send({ error: "INVALID_IDEMPOTENCY_KEY" });
    const headerKey = headerParsed?.success ? headerParsed.data : "";
    const key = b.idempotencyKey;
    const s = requestPos(req).session;
    if (headerKey && headerKey !== key)
      return reply.code(400).send({ error: "IDEMPOTENCY_KEY_MISMATCH" });
    const priorSale = await prisma.idempotencyKey.findUnique({
      where: { key_scope_actorId: { key, scope: "pos.sale", actorId: s.terminal.id } },
    });
    if (priorSale?.status === "COMPLETED") return priorSale.response;
    try {
      const discount = b.discountMinor;
      if (discount > 0n && !(await hasPermission(s.staffUser.id, "sales.discount")))
        return reply.code(403).send({ error: "DISCOUNT_NOT_ALLOWED" });
      const setting = await prisma.setting.findUnique({
        where: { key: "pos.discount.maxMinor" },
      });
      const limit = setting && typeof setting.value === "number" ? BigInt(setting.value) : 0n;
      const needsApproval = discount > limit;
      if (needsApproval) {
        const aid = b.approvalId || "";
        if (!aid) return reply.code(403).send({ error: "APPROVAL_REQUIRED" });
        const a = await prisma.approval.findUnique({ where: { id: aid } });
        if (
          !a ||
          a.usedAt ||
          a.expiresAt <= new Date() ||
          a.grantorId === s.staffUser.id ||
          a.terminalId !== s.terminal.id ||
          a.cashierSessionId !== s.id ||
          a.action !== "sale.discount" ||
          a.targetId !== key ||
          a.amountMinor !== discount
        )
          return reply.code(403).send({ error: "APPROVAL_INVALID" });
      }
      const r = await prisma.$transaction(async (tx) => {
        const old = await tx.idempotencyKey.findUnique({
          where: {
            key_scope_actorId: {
              key,
              scope: "pos.sale",
              actorId: s.terminal.id,
            },
          },
        });
        if (old?.status === "COMPLETED") return old.response;
        let sub = 0n;
        const rows: Array<{
          p: NonNullable<Awaited<ReturnType<typeof tx.product.findUnique>>>;
          q: number;
          qMilli: bigint;
          t: bigint;
        }> = [];
        for (const i of b.items || []) {
          const p = await tx.product.findUnique({ where: { id: i.productId } }),
            qMilli = qtyMilli(i.quantity),
            q = Number(qMilli) / 1000;
          if (!p || Number(p.stock) < q) throw Error("INSUFFICIENT_STOCK");
          const t = minorForQuantity(p.priceMinor, i.quantity);
          sub += t;
          rows.push({ p, q, qMilli, t });
        }
        if (!rows.length) throw Error("EMPTY_SALE");
        const total = sub - discount;
        if (total < 0n) throw Error("INVALID_DISCOUNT");
        const paid = b.payments.reduce((sum, payment) => sum + payment.amountMinor, 0n);
        if (paid < total) throw Error("INSUFFICIENT_PAYMENT");
        const sale = await tx.sale.create({
          data: {
            invoiceNo: "INV-" + Date.now() + "-" + randomBytes(4).toString("hex"),
            subtotalMinor: BigInt(sub),
            discountMinor: discount,
            totalMinor: total,
            paidMinor: paid,
            cashierId: s.staffUser.id,
            terminalId: s.terminal.id,
            items: {
              create: rows.map((x) => ({
                productId: x.p.id,
                quantity: x.q,
                unitPriceMinor: x.p.priceMinor,
                unitCostMinor: x.p.costMinor,
                totalMinor: x.t,
              })),
            },
            payments: {
              create: b.payments.map((payment) => ({
                amountMinor: payment.amountMinor,
                method: PaymentMethod[payment.method],
              })),
            },
          },
        });
        for (const x of rows) {
          const u = await tx.product.updateMany({
            where: { id: x.p.id, version: x.p.version, stock: { gte: x.q } },
            data: { stock: { decrement: x.q }, version: { increment: 1 } },
          });
          if (u.count !== 1) throw Error("CONCURRENT_STOCK_CHANGE");
          await tx.inventoryMovement.create({
            data: {
              productId: x.p.id,
              quantity: -x.q,
              type: "SALE",
              referenceId: sale.id,
            },
          });
        }
        if (needsApproval) {
          const used = await tx.approval.updateMany({
            where: { id: b.approvalId, usedAt: null },
            data: { usedAt: new Date(), usedById: s.staffUser.id },
          });
          if (used.count !== 1) throw Error("APPROVAL_INVALID");
        }
        const detailed = await tx.sale.findUniqueOrThrow({
          where: { id: sale.id },
          include: {
            items: { include: { product: { select: { name: true } } } },
            payments: true,
          },
        });
        const out = prismaJson(detailed);
        await tx.idempotencyKey.create({
          data: {
            key,
            scope: "pos.sale",
            actorId: s.terminal.id,
            status: "COMPLETED",
            response: out,
          },
        });
        return out;
      });
      await audit(
        s.staffUser.id,
        "sale.create",
        "sale",
        r && typeof r === "object" && "id" in r ? String(r.id) : undefined,
        true,
        { idempotencyKey: key },
        req,
      );
      return r;
    } catch (e: unknown) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        const duplicate = await prisma.idempotencyKey.findUnique({
          where: { key_scope_actorId: { key, scope: "pos.sale", actorId: s.terminal.id } },
        });
        if (duplicate?.status === "COMPLETED") return duplicate.response;
      }
      const message = e instanceof Error ? e.message : "SALE_FAILED";
      await audit(s.staffUser.id, "sale.create", "sale", undefined, false, { error: message }, req);
      return reply.code(400).send({ error: message });
    }
  },
);
app.post<ApiRouteGeneric>(
  "/api/pos/sales/:id/reprint",
  { preHandler: pos },
  async (req: RequestWithSession, reply) => {
    const parsedId = resourceId.safeParse(req.params.id);
    if (!parsedId.success) return reply.code(400).send({ error: "INVALID_ID" });
    const s = await prisma.sale.findUnique({
      where: { id: parsedId.data },
      include: {
        items: { include: { product: { select: { name: true } } } },
        payments: true,
      },
    });
    if (
      !s ||
      (s.cashierId !== requestStaff(req).staffUser.id &&
        !(await hasPermission(requestStaff(req).staffUser.id, "sales.view_all")))
    )
      return reply.code(404).send({ error: "NOT_FOUND" });
    await audit(
      requestStaff(req).staffUser.id,
      "sale.reprint",
      "sale",
      s.id,
      true,
      { terminalId: requestPos(req).terminal.id },
      req,
    );
    return json(s);
  },
);
app.post<ApiRouteGeneric>(
  "/api/pos/sales/:id/refund",
  { preHandler: pos },
  async (req: RequestWithSession, reply) => {
    const input = posRefundInput.safeParse(req.body);
    if (!input.success) return reply.code(400).send({ error: "INVALID_REFUND" });
    const b = input.data;
    const rawHeader = req.headers["idempotency-key"];
    const parsedHeader = rawHeader === undefined ? null : idempotencyKey.safeParse(rawHeader);
    if (parsedHeader && !parsedHeader.success)
      return reply.code(400).send({ error: "INVALID_IDEMPOTENCY_KEY" });
    const idempotencyHeader = parsedHeader?.success ? parsedHeader.data : "";
    if (idempotencyHeader && idempotencyHeader !== b.idempotencyKey)
      return reply.code(400).send({ error: "IDEMPOTENCY_KEY_MISMATCH" });
    const parsedId = resourceId.safeParse(req.params.id);
    if (!parsedId.success) return reply.code(400).send({ error: "INVALID_ID" });
    const saleId = parsedId.data;
    const terminalId = requestPos(req).terminal.id;
    const scope = `pos.refund:${terminalId}:${saleId}`;
    const old = await prisma.idempotencyKey.findUnique({
      where: {
        key_scope_actorId: {
          key: b.idempotencyKey,
          scope,
          actorId: terminalId,
        },
      },
    });
    if (old?.status === "COMPLETED") return old.response;
    let result: { saleId: string; response: unknown };
    try {
      result = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "Sale" WHERE "id" = ${saleId} FOR UPDATE`;
        const sale = await tx.sale.findUnique({
          where: { id: saleId },
          include: { refunds: true, items: true },
        });
        if (!sale || sale.terminalId !== requestPos(req).terminal.id)
          throw Error("REFUND_NOT_FOUND");
        const alreadyRefunded = sale.refunds.reduce((sum, refund) => sum + refund.amountMinor, 0n);
        if (alreadyRefunded + b.amountMinor > sale.totalMinor) throw Error("INVALID_REFUND_AMOUNT");
        if (b.restoreStock && !canRestoreSaleStock(sale.totalMinor, alreadyRefunded, b.amountMinor))
          throw Error("STOCK_RESTORATION_REQUIRES_FULL_REFUND");
        const setting = await tx.setting.findUnique({ where: { key: "pos.refund.maxMinor" } });
        const limit = setting && typeof setting.value === "number" ? BigInt(setting.value) : 0n;
        const needsApproval = b.amountMinor > limit;
        if (needsApproval) {
          const approval = await tx.approval.findUnique({ where: { id: b.approvalId ?? "" } });
          if (
            !approval ||
            approval.usedAt ||
            approval.expiresAt <= new Date() ||
            approval.grantorId === requestStaff(req).staffUser.id ||
            approval.terminalId !== requestPos(req).terminal.id ||
            approval.cashierSessionId !== requestSession(req).id ||
            approval.action !== "sale.refund" ||
            approval.targetId !== sale.id ||
            approval.amountMinor !== b.amountMinor
          )
            throw Error("APPROVAL_INVALID");
        }
        const refund = await tx.refund.create({
          data: {
            saleId: sale.id,
            amountMinor: b.amountMinor,
            reason: b.reason,
            approvedById: b.approvalId || null,
          },
        });
        if (b.restoreStock) {
          for (const item of sale.items) {
            await tx.product.update({
              where: { id: item.productId },
              data: { stock: { increment: item.quantity }, version: { increment: 1 } },
            });
            await tx.inventoryMovement.create({
              data: {
                productId: item.productId,
                quantity: item.quantity,
                type: "REFUND",
                referenceId: refund.id,
              },
            });
          }
        }
        if (needsApproval) {
          const used = await tx.approval.updateMany({
            where: { id: b.approvalId ?? "", usedAt: null },
            data: { usedAt: new Date(), usedById: requestStaff(req).staffUser.id },
          });
          if (used.count !== 1) throw Error("APPROVAL_INVALID");
        }
        await tx.sale.update({
          where: { id: sale.id },
          data: {
            status:
              alreadyRefunded + b.amountMinor === sale.totalMinor
                ? SaleStatus.REFUNDED
                : SaleStatus.PARTIAL_REFUND,
          },
        });
        const response = prismaJson(refund);
        await tx.idempotencyKey.create({
          data: {
            key: b.idempotencyKey,
            scope,
            actorId: terminalId,
            status: "COMPLETED",
            response,
          },
        });
        return { saleId: sale.id, response };
      });
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const duplicate = await prisma.idempotencyKey.findUnique({
          where: {
            key_scope_actorId: {
              key: b.idempotencyKey,
              scope,
              actorId: terminalId,
            },
          },
        });
        if (duplicate?.status === "COMPLETED") return duplicate.response;
      }
      const message = error instanceof Error ? error.message : "REFUND_FAILED";
      if (message === "REFUND_NOT_FOUND") return reply.code(404).send({ error: "NOT_FOUND" });
      if (message === "APPROVAL_INVALID") return reply.code(403).send({ error: message });
      return reply.code(400).send({ error: message });
    }
    await audit(
      requestStaff(req).staffUser.id,
      "sale.refund",
      "sale",
      result.saleId,
      true,
      { surface: "pos", amountMinor: b.amountMinor.toString(), idempotencyKey: b.idempotencyKey },
      req,
    );
    return result.response;
  },
);
app.post<ApiRouteGeneric>(
  "/api/pos/sync/sales",
  { preHandler: pos },
  async (req: RequestWithSession, reply) => {
    const parsed = offlineSaleInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_OFFLINE_SALE" });
    const b = parsed.data,
      s = requestPos(req).session;
    if (b.cashierId !== s.staffUser.id || b.terminalId !== s.terminal.id)
      return reply.code(403).send({ error: "OFFLINE_OWNER_MISMATCH" });
    try {
      const result = await prisma.$transaction(async (tx) => {
        const old = await tx.idempotencyKey.findUnique({
          where: {
            key_scope_actorId: {
              key: b.clientSaleId,
              scope: "pos.offline_sale",
              actorId: s.terminal.id,
            },
          },
        });
        if (old?.status === "COMPLETED") return old.response;
        let subtotal = 0n;
        let needsReview = false;
        const rows: Array<{
          p: {
            id: string;
            priceMinor: bigint;
            costMinor: bigint;
            version: number;
          };
          q: number;
          t: bigint;
        }> = [];
        for (const i of b.items) {
          const p = await tx.product.findUnique({ where: { id: i.productId } });
          if (!p) throw new Error("OFFLINE_PRODUCT_UNAVAILABLE");
          const q = qty(i.quantity);
          if (Number(p.stock) < Number(q)) needsReview = true;
          const t = minorForQuantity(p.priceMinor, i.quantity);
          subtotal += t;
          rows.push({
            p: {
              id: p.id,
              priceMinor: p.priceMinor,
              costMinor: p.costMinor,
              version: p.version,
            },
            q,
            t,
          });
        }
        const offlineMaxSaleSetting = await tx.setting.findUnique({
          where: { key: "pos.offline.maxSaleMinor" },
        });
        const offlineMaxHoursSetting = await tx.setting.findUnique({
          where: { key: "pos.offline.maxHours" },
        });
        const offlineMaxSale =
          offlineMaxSaleSetting && typeof offlineMaxSaleSetting.value === "number"
            ? BigInt(offlineMaxSaleSetting.value)
            : 1000000n;
        const offlineMaxHours =
          offlineMaxHoursSetting && typeof offlineMaxHoursSetting.value === "number"
            ? Number(offlineMaxHoursSetting.value)
            : 8;
        const occurred = Date.parse(b.occurredAtClient);
        if (
          !Number.isFinite(occurred) ||
          occurred > Date.now() + 5 * 60_000 ||
          Date.now() - occurred > offlineMaxHours * 3600000 ||
          subtotal > offlineMaxSale
        )
          needsReview = true;
        if (subtotal !== b.totalMinor) needsReview = true;
        const sale = await tx.sale.create({
          data: {
            invoiceNo: "OFF-" + Date.now() + "-" + randomBytes(4).toString("hex"),
            status: needsReview ? SaleStatus.NEEDS_REVIEW : SaleStatus.COMPLETED,
            subtotalMinor: subtotal,
            totalMinor: subtotal,
            paidMinor: subtotal,
            cashierId: s.staffUser.id,
            terminalId: s.terminal.id,
            occurredAtClient: new Date(b.occurredAtClient),
            items: {
              create: rows.map((x) => ({
                productId: x.p.id,
                quantity: x.q,
                unitPriceMinor: x.p.priceMinor,
                unitCostMinor: x.p.costMinor,
                totalMinor: x.t,
              })),
            },
            payments: {
              create: { amountMinor: subtotal, method: PaymentMethod.CASH },
            },
          },
        });
        for (const x of rows) {
          const u = await tx.product.updateMany({
            where: { id: x.p.id, version: x.p.version },
            data: { stock: { decrement: x.q }, version: { increment: 1 } },
          });
          if (u.count !== 1) throw new Error("OFFLINE_STOCK_VERSION_CONFLICT");
          await tx.inventoryMovement.create({
            data: {
              productId: x.p.id,
              quantity: -x.q,
              type: "SALE",
              referenceId: sale.id,
            },
          });
        }
        const out = prismaJson(sale);
        await tx.idempotencyKey.create({
          data: {
            key: b.clientSaleId,
            scope: "pos.offline_sale",
            actorId: s.terminal.id,
            status: "COMPLETED",
            response: out,
          },
        });
        return out;
      });
      await audit(
        s.staffUser.id,
        result && typeof result === "object" && "id" in result && "status" in result
          ? String(
              result.status === SaleStatus.NEEDS_REVIEW
                ? "offline.sale.needs_review"
                : "offline.sale.synced",
            )
          : "offline.sale.synced",
        "sale",
        result && typeof result === "object" && "id" in result ? String(result.id) : undefined,
        !(
          result &&
          typeof result === "object" &&
          "status" in result &&
          result.status === SaleStatus.NEEDS_REVIEW
        ),
        { clientSaleId: b.clientSaleId, occurredAtClient: b.occurredAtClient },
        req,
      );
      return result;
    } catch (e: unknown) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        const duplicate = await prisma.idempotencyKey.findUnique({
          where: {
            key_scope_actorId: {
              key: b.clientSaleId,
              scope: "pos.offline_sale",
              actorId: s.terminal.id,
            },
          },
        });
        if (duplicate?.status === "COMPLETED") return duplicate.response;
      }
      const message = e instanceof Error ? e.message : "SYNC_FAILED";
      await audit(
        s.staffUser.id,
        "offline.sale.needs_review",
        "sale",
        undefined,
        false,
        {
          clientSaleId: b.clientSaleId,
          error: message,
          occurredAtClient: b.occurredAtClient,
        },
        req,
      );
      return reply.code(409).send({
        error: message.startsWith("NEEDS_REVIEW") ? message : "SYNC_FAILED",
      });
    }
  },
);
app.post<ApiRouteGeneric>(
  "/api/admin/terminals/:id/revoke",
  { preHandler: [staff(), stepUp] },
  async (req: RequestWithSession, reply) => {
    const parsedId = resourceId.safeParse(req.params.id);
    if (!parsedId.success) return reply.code(400).send({ error: "INVALID_ID" });
    const t = await prisma.terminal.findUnique({
      where: { id: parsedId.data },
    });
    if (!t) return reply.code(404).send({ error: "NOT_FOUND" });
    await prisma.$transaction([
      prisma.terminal.update({
        where: { id: t.id },
        data: {
          isActive: false,
          previousCredentialHash: null,
          previousCredentialExpiresAt: null,
          credentialHash: sha(token()),
        },
      }),
      prisma.session.updateMany({
        where: { terminalId: t.id, kind: SessionKind.POS },
        data: { revokedAt: new Date() },
      }),
      prisma.deviceSession.updateMany({
        where: { terminalId: t.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    await audit(requestStaff(req).staffUser.id, "device.revoked", "terminal", t.id, true, {}, req);
    return { ok: true };
  },
);
app.get<ApiRouteGeneric>("/api/pos/sales", { preHandler: pos }, async (req: RequestWithSession) =>
  json(
    await prisma.sale.findMany({
      where: { terminalId: requestPos(req).terminal.id },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { items: true, payments: true, refunds: true },
    }),
  ),
);
app.post<ApiRouteGeneric>(
  "/api/admin/sales/:id/refund",
  { preHandler: [staff(), stepUp] },
  async (req: RequestWithSession, reply) => {
    const parsed = refundInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_INPUT" });
    const b = parsed.data,
      parsedId = resourceId.safeParse(req.params.id);
    if (!parsedId.success) return reply.code(400).send({ error: "INVALID_ID" });
    const saleId = parsedId.data,
      amount = b.amountMinor;
    const setting = await prisma.setting.findUnique({
      where: { key: "admin.refund.maxMinor" },
    });
    const limit = setting && typeof setting.value === "number" ? BigInt(setting.value) : 0n;
    const needsApproval = amount > limit;
    let saleIdForAudit = saleId;
    let r: Refund;
    try {
      r = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "Sale" WHERE "id" = ${saleId} FOR UPDATE`;
        const sale = await tx.sale.findUnique({
          where: { id: saleId },
          include: { refunds: true, items: true },
        });
        if (!sale) throw Error("NOT_FOUND");
        const refunded = sale.refunds.reduce((sum, refund) => sum + refund.amountMinor, 0n);
        if (refunded + amount > sale.totalMinor) throw Error("INVALID_REFUND_AMOUNT");
        if (b.restoreStock && !canRestoreSaleStock(sale.totalMinor, refunded, amount))
          throw Error("STOCK_RESTORATION_REQUIRES_FULL_REFUND");
        if (needsApproval) {
          const approval = await tx.approval.findUnique({ where: { id: b.approvalId ?? "" } });
          if (
            !approval ||
            approval.usedAt ||
            approval.expiresAt <= new Date() ||
            approval.grantorId === requestStaff(req).staffUser.id ||
            approval.action !== "sale.refund" ||
            approval.targetId !== sale.id ||
            approval.amountMinor !== amount
          )
            throw Error("APPROVAL_INVALID");
        }
        const refund = await tx.refund.create({
          data: {
            saleId: sale.id,
            amountMinor: amount,
            reason: b.reason,
            approvedById: b.approvalId || null,
          },
        });
        if (b.restoreStock) {
          for (const item of sale.items) {
            await tx.product.update({
              where: { id: item.productId },
              data: { stock: { increment: item.quantity }, version: { increment: 1 } },
            });
            await tx.inventoryMovement.create({
              data: {
                productId: item.productId,
                quantity: item.quantity,
                type: "REFUND",
                referenceId: refund.id,
              },
            });
          }
        }
        if (needsApproval) {
          const used = await tx.approval.updateMany({
            where: { id: b.approvalId ?? "", usedAt: null },
            data: { usedAt: new Date(), usedById: requestStaff(req).staffUser.id },
          });
          if (used.count !== 1) throw Error("APPROVAL_INVALID");
        }
        await tx.sale.update({
          where: { id: sale.id },
          data: {
            status:
              refunded + amount === sale.totalMinor
                ? SaleStatus.REFUNDED
                : SaleStatus.PARTIAL_REFUND,
          },
        });
        saleIdForAudit = sale.id;
        return refund;
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "REFUND_FAILED";
      const code = message === "NOT_FOUND" ? 404 : message === "APPROVAL_INVALID" ? 403 : 400;
      return reply.code(code).send({ error: message });
    }
    await audit(
      requestStaff(req).staffUser.id,
      "sale.refund",
      "sale",
      saleIdForAudit,
      true,
      { amountMinor: amount.toString() },
      req,
    );
    return json(r);
  },
);

app.post<ApiRouteGeneric>(
  "/api/admin/approvals",
  {
    preHandler: [staff(), stepUp],
    config: { rateLimit: { max: 5, timeWindow: "5 minutes" } },
  },
  async (req: RequestWithSession, reply) => {
    const parsed = adminApprovalInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_INPUT" });
    const { action, reason } = parsed.data,
      targetId = parsed.data.targetId ?? null,
      amountMinor = parsed.data.amountMinor === undefined ? null : money(parsed.data.amountMinor);
    if (action === "sale.refund" && (!targetId || amountMinor === null || amountMinor <= 0n))
      return reply.code(400).send({ error: "INVALID_APPROVAL" });
    const r = await prisma.approval.create({
      data: {
        action,
        reason,
        grantorId: requestStaff(req).staffUser.id,
        targetId,
        amountMinor,
        expiresAt: new Date(Date.now() + 300000),
      },
    });
    await audit(
      requestStaff(req).staffUser.id,
      "approval.granted",
      "approval",
      r.id,
      true,
      { action, targetId, amountMinor: amountMinor?.toString() || null },
      req,
    );
    return json(r);
  },
);
app.get<ApiRouteGeneric>(
  "/api/admin/reports/export",
  {
    preHandler: [staff(), stepUp],
    config: { rateLimit: { max: 5, timeWindow: "1 hour" } },
  },
  async (req: RequestWithSession, reply) => {
    const safe = (value: unknown) => {
      const text = String(value ?? "");
      return /^[=+\-@\t\r]/.test(text) ? "'" + text : text;
    };
    const rows = await prisma.sale.findMany({
      orderBy: { createdAt: "desc" },
      take: 10_000,
      select: {
        invoiceNo: true,
        status: true,
        totalMinor: true,
        paidMinor: true,
        createdAt: true,
      },
    });
    const csv = [
      "invoice_no,status,total_minor,paid_minor,created_at",
      ...rows.map((row) =>
        [row.invoiceNo, row.status, row.totalMinor, row.paidMinor, row.createdAt.toISOString()]
          .map(safe)
          .map((value) => `\"${value.replaceAll('\"', '\"\"')}\"`)
          .join(","),
      ),
    ].join("\n");
    await audit(
      requestStaff(req).staffUser.id,
      "reports.export",
      "sales",
      undefined,
      true,
      { rows: rows.length },
      req,
    );
    reply.header("content-type", "text/csv; charset=utf-8");
    reply.header("content-disposition", "attachment; filename=lingo-sales.csv");
    return csv;
  },
);
app.get<ApiRouteGeneric>(
  "/api/admin/reports/summary",
  { preHandler: staff() },
  async (req: RequestWithSession) => {
    const [s, web, p, e] = await Promise.all([
      prisma.sale.aggregate({ _sum: { totalMinor: true }, _count: true }),
      prisma.webOrder.aggregate({
        where: { paymentStatus: "PAID" },
        _sum: { totalMinor: true },
        _count: true,
      }),
      prisma.purchase.aggregate({ _sum: { totalMinor: true } }),
      prisma.expense.aggregate({ _sum: { amountMinor: true } }),
    ]);
    const out: {
      salesMinor: bigint;
      invoices: number;
      purchasesMinor: bigint;
      expensesMinor: bigint;
      profitMinor?: bigint;
    } = {
      salesMinor: (s._sum.totalMinor || 0n) + (web._sum.totalMinor || 0n),
      invoices: s._count + web._count,
      purchasesMinor: p._sum.totalMinor || 0n,
      expensesMinor: e._sum.amountMinor || 0n,
    };
    if (await hasPermission(requestStaff(req).staffUser.id, "reports.view_profit")) {
      const [items, webItems] = await Promise.all([
        prisma.saleItem.findMany({ select: { quantity: true, unitCostMinor: true } }),
        prisma.webOrderItem.findMany({
          where: { order: { paymentStatus: "PAID" } },
          select: { quantity: true, unitCostMinor: true },
        }),
      ]);
      let cost = 0n;
      for (const item of [...items, ...webItems]) {
        cost += minorForQuantity(item.unitCostMinor, item.quantity);
      }
      out.profitMinor = out.salesMinor - cost - out.expensesMinor;
    }
    return json(out);
  },
);
app.get<ApiRouteGeneric>("/api/admin/audit", { preHandler: staff() }, async () =>
  json(
    await prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 1000,
    }),
  ),
);
app.setErrorHandler(async (err, req, reply) => {
  req.log.error({ err, requestId: req.requestId });
  const status =
    err instanceof Error && "statusCode" in err && typeof err.statusCode === "number"
      ? err.statusCode
      : 500;
  const code =
    status >= 500
      ? "INTERNAL_ERROR"
      : err instanceof Error
        ? err.message || "REQUEST_FAILED"
        : "REQUEST_FAILED";
  return reply.code(status).send({
    error: {
      code,
      message: status >= 500 ? "Request failed" : code,
      requestId: req.requestId,
    },
  });
});
await registerWs(app);
await app.listen({
  port: Number(process.env.PORT || 4000),
  host: process.env.HOST || "127.0.0.1",
});
