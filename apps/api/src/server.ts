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
import { sendStaffSetupMail, sendTransactionalMail } from "./mailer.js";
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
if (process.env.NODE_ENV === "production" && !process.env.MAILER_WEBHOOK_URL)
  throw Error("MAILER_WEBHOOK_URL_REQUIRED");
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
