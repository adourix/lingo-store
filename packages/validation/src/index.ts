import { z } from "zod";

export const envBoolean = z.enum(["true", "false"]).transform((value) => value === "true");
export const nonEmptyString = z.string().trim().min(1);

export const username = z
  .string()
  .trim()
  .min(2)
  .max(40)
  .regex(/^[a-z0-9_-]+$/i);

export const email = z
  .string()
  .trim()
  .email()
  .max(254)
  .transform((value) => value.toLowerCase());
export const password = z.string().min(12).max(256);
export const customerPassword = z.string().min(10).max(128);
export const totpCode = z.string().regex(/^\d{6}$/);
export const opaqueToken = z.string().min(32).max(512);
export const resourceId = z.string().uuid();

export const idempotencyKey = z.string().uuid();

export const pagination = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    cursor: z.string().trim().min(1).max(256).optional(),
  })
  .strict();

export const adminLoginInput = z
  .object({
    username: z.union([username, email]).optional(),
    email: email.optional(),
    password,
    otp: totpCode.optional(),
    recoveryCode: z.string().trim().min(8).max(128).optional(),
  })
  .refine((value) => Boolean(value.username || value.email), {
    message: "username or email is required",
    path: ["username"],
  })
  .strict();

export const customerLoginInput = z.object({ email, password: customerPassword }).strict();
export const customerRegistrationInput = z
  .object({
    email,
    password: customerPassword,
    name: nonEmptyString.max(120),
    phone: z.string().trim().max(32).optional(),
  })
  .strict();
export const customerProfileInput = z
  .object({
    name: nonEmptyString.max(120).optional(),
    phone: z.string().trim().max(32).nullable().optional(),
  })
  .strict();
export const passwordChangeInput = z
  .object({ currentPassword: z.string().min(1).max(256), newPassword: z.string().min(10).max(128) })
  .strict();
export const staffPasswordChangeInput = z
  .object({ currentPassword: z.string().min(1).max(256), newPassword: z.string().min(14).max(128) })
  .strict();
export const passwordResetInput = z
  .object({ token: opaqueToken, password: z.string().min(10).max(128) })
  .strict();
export const contactInput = z
  .object({
    email,
    name: nonEmptyString.max(120),
    message: nonEmptyString.max(5000),
    turnstileToken: z.string().min(1).max(4096),
  })
  .strict();
export const tokenInput = z.object({ token: opaqueToken }).strict();
export const emailInput = z.object({ email }).strict();
export const adminMfaInput = z
  .object({ otp: totpCode.optional(), recoveryCode: z.string().trim().min(8).max(128).optional() })
  .refine((v) => Boolean(v.otp || v.recoveryCode))
  .strict();
export const stepUpInput = z
  .object({
    password: z.string().min(1).max(256),
    otp: totpCode.optional(),
    recoveryCode: z.string().trim().min(8).max(128).optional(),
  })
  .strict();
export const staffSetupInput = z
  .object({
    token: opaqueToken,
    password: z.string().min(14).max(256),
    totpSecret: z.string().min(32).max(64),
    otp: totpCode,
  })
  .strict();
export const staffInvitationInput = z
  .object({
    email,
    name: nonEmptyString.max(120),
    username,
    roleName: username.optional(),
    role: username.optional(),
  })
  .strict();
export const staffStatusInput = z.object({ isActive: z.boolean() }).strict();
export const staffRoleInput = z.object({ role: username }).strict();
export const productCreateInput = z
  .object({
    sku: nonEmptyString.max(80),
    barcode: z.string().trim().max(80).nullable().optional(),
    name: nonEmptyString.max(160),
    description: z.string().max(5000).nullable().optional(),
    priceMinor: z.coerce.bigint().nonnegative(),
    costMinor: z.coerce.bigint().nonnegative().optional(),
    stock: z.coerce.number().finite().nonnegative().default(0),
    minStock: z.coerce.number().finite().nonnegative().default(0),
    categoryId: z.string().uuid().nullable().optional(),
  })
  .strict();
export const productUpdateInput = z
  .object({
    name: nonEmptyString.max(160).optional(),
    priceMinor: z.coerce.bigint().nonnegative().optional(),
    costMinor: z.coerce.bigint().nonnegative().optional(),
    minStock: z.coerce.number().finite().nonnegative().optional(),
    version: z.coerce.number().int().nonnegative(),
  })
  .strict();
export const settingUpdateInput = z.object({ value: z.json() }).strict();
export const customerPaymentInput = z
  .object({
    customerId: z.string().uuid(),
    amountMinor: z.coerce.bigint().positive(),
    method: z.enum(["CASH", "CARD", "TRANSFER", "OTHER"]).default("OTHER"),
    note: z.string().max(500).nullable().optional(),
  })
  .strict();
export const supplierPaymentInput = z
  .object({
    supplierId: z.string().uuid(),
    amountMinor: z.coerce.bigint().positive(),
    method: z.enum(["CASH", "CARD", "TRANSFER", "OTHER"]).default("OTHER"),
    note: z.string().max(500).nullable().optional(),
  })
  .strict();
export const approvalInput = z
  .object({
    action: nonEmptyString.max(100),
    targetId: z.string().uuid(),
    amountMinor: z.coerce.bigint().positive().optional(),
    reason: nonEmptyString.max(500),
  })
  .strict();

export const posRefreshInput = z.object({ refreshToken: opaqueToken }).strict();
export const terminalEnrollmentInput = z
  .object({
    code: z.string().trim().min(8).max(128),
    deviceName: nonEmptyString.max(120).optional(),
  })
  .strict();

export const saleItemInput = z
  .object({
    productId: z.string().uuid(),
    quantity: z.coerce
      .number()
      .positive()
      .finite()
      .max(1_000_000)
      .refine((value) => Math.abs(value * 1000 - Math.round(value * 1000)) < 1e-7),
  })
  .strict();

export const paymentInput = z
  .object({
    method: z.enum(["CASH", "CARD", "TRANSFER", "OTHER"]),
    amountMinor: z.coerce.bigint().positive(),
  })
  .strict();

export const createSaleInput = z
  .object({
    idempotencyKey,
    items: z.array(saleItemInput).min(1).max(200),
    payments: z.array(paymentInput).min(1).max(20),
    customerId: z.string().uuid().optional(),
    discountMinor: z.coerce.bigint().nonnegative().default(0n),
    approvalId: z.string().uuid().optional(),
  })
  .strict();

export const webOrderCreateInput = z
  .object({
    idempotencyKey,
    items: z.array(saleItemInput).min(1).max(50),
    recipientName: nonEmptyString.max(120),
    recipientPhone: z.string().trim().min(5).max(32),
    shippingAddress: nonEmptyString.max(500),
    paymentMethod: z.literal("CASH"),
  })
  .strict();

export const webOrderStatusInput = z
  .object({
    status: z.enum(["CONFIRMED", "PROCESSING", "READY", "CANCELLED"]),
    reason: z.string().trim().max(500).optional(),
  })
  .strict()
  .refine((value) => value.status !== "CANCELLED" || Boolean(value.reason?.trim()), {
    path: ["reason"],
    message: "cancellation reason is required",
  });

export const webOrderCashReceiptInput = z
  .object({ idempotencyKey, amountMinor: z.coerce.bigint().positive() })
  .strict();

export const refundInput = z
  .object({
    amountMinor: z.coerce.bigint().positive(),
    reason: nonEmptyString.max(500),
    approvalId: z.string().uuid().optional(),
    restoreStock: z.boolean().default(false),
  })
  .strict();
export const posRefundInput = refundInput.extend({ idempotencyKey });

export const customerLookupInput = z
  .object({
    query: nonEmptyString.max(254),
  })
  .strict();
export const customerLookupQuery = z.object({ q: z.string().trim().max(254).optional() }).strict();

export const customerCreateInput = z
  .object({
    name: nonEmptyString.max(120),
    email: email.optional(),
    phone: z.string().trim().max(32).optional(),
    address: z.string().trim().max(500).optional(),
  })
  .strict();

export const supplierCreateInput = customerCreateInput
  .extend({ address: z.string().trim().max(500).optional() })
  .strict();
export const inventoryAdjustmentInput = z
  .object({
    productId: z.string().uuid(),
    quantity: z.coerce.number().positive().finite(),
    direction: z.union([z.literal(-1), z.literal(1)]),
    version: z.coerce.number().int().nonnegative().optional(),
    note: z.string().max(500).nullable().optional(),
  })
  .strict();
export const purchaseInput = z
  .object({
    items: z
      .array(
        z
          .object({
            productId: z.string().uuid(),
            quantity: z.coerce.number().positive().finite(),
            unitCostMinor: z.coerce.bigint().nonnegative(),
          })
          .strict(),
      )
      .min(1)
      .max(500),
    invoiceNo: z.string().trim().max(120).optional(),
    supplierId: z.string().uuid().nullable().optional(),
  })
  .strict();
export const posLoginInput = z
  .object({ username: z.union([username, email]), password: z.string().min(1).max(256) })
  .strict();
export const offlineSaleInput = z
  .object({
    clientSaleId: idempotencyKey,
    cashierId: z.string().uuid(),
    terminalId: z.string().uuid(),
    occurredAtClient: z.string().datetime(),
    totalMinor: z.coerce.bigint().nonnegative(),
    items: z.array(saleItemInput).min(1).max(200),
  })
  .strict();
export const roleCreateInput = z.object({ name: username }).strict();
export const rolePermissionsInput = z
  .object({ permissions: z.array(z.string().min(1).max(120)).max(500) })
  .strict();
export const customerAccountLinkInput = z
  .object({ accountId: z.string().uuid().nullable() })
  .strict();
export const expenseInput = z
  .object({
    title: nonEmptyString.max(160),
    amountMinor: z.coerce.bigint().positive(),
    category: nonEmptyString.max(80),
    note: z.string().max(500).nullable().optional(),
  })
  .strict();
export const cashOpenInput = z
  .object({ openingMinor: z.coerce.bigint().nonnegative().default(0n) })
  .strict();
export const cashCloseInput = z.object({ closingMinor: z.coerce.bigint().nonnegative() }).strict();
export const posEnrollmentInput = z
  .object({
    code: z.string().trim().min(8).max(128),
    name: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9 _.-]{1,80}$/),
  })
  .strict();
export const posUnlockInput = z.object({ password: z.string().min(1).max(256) }).strict();
export const posApprovalInput = z
  .object({
    username,
    password: z.string().min(1).max(256),
    otp: totpCode.optional(),
    action: nonEmptyString.max(100),
    reason: nonEmptyString.max(500),
    targetId: z.string().uuid().optional(),
    amountMinor: z.coerce.bigint().positive().optional(),
  })
  .strict();
export const adminApprovalInput = z
  .object({
    action: nonEmptyString.max(100),
    reason: nonEmptyString.max(500),
    targetId: z.string().uuid().optional(),
    amountMinor: z.coerce.bigint().positive().optional(),
  })
  .strict();
export const categoryInput = z
  .object({
    name: nonEmptyString.max(120),
    description: z.string().max(1000).nullable().optional(),
  })
  .strict();

export const mutationEnvelope = z.object({ idempotencyKey }).strict();
