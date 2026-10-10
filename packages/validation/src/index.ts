import { z } from "zod";

export const envBoolean = z.enum(["true", "false"]).transform((value) => value === "true");
export const nonEmptyString = z.string().trim().min(1);

export const username = z
  .string()
  .trim()
  .min(2)
  .max(40)
  .regex(/^[a-z0-9_-]+$/i);

export const email = z.string().trim().email().max(254).transform((value) => value.toLowerCase());
export const password = z.string().min(12).max(256);
export const totpCode = z.string().regex(/^\d{6}$/);
export const opaqueToken = z.string().min(32).max(512);

export const idempotencyKey = z
  .string()
  .trim()
  .min(16)
  .max(128)
  .regex(/^[A-Za-z0-9._:-]+$/);

export const pagination = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().trim().min(1).max(256).optional(),
});

export const adminLoginInput = z
  .object({
    username: username.optional(),
    email: email.optional(),
    password,
    otp: totpCode.optional(),
    recoveryCode: z.string().trim().min(8).max(128).optional(),
  })
  .refine((value) => Boolean(value.username || value.email), {
    message: "username or email is required",
    path: ["username"],
  });

export const customerLoginInput = z.object({ email, password });
export const customerRegistrationInput = z.object({
  email,
  password,
  name: nonEmptyString.max(120),
  phone: z.string().trim().max(32).optional(),
});

export const posRefreshInput = z.object({ refreshToken: opaqueToken });
export const terminalEnrollmentInput = z.object({
  code: z.string().trim().min(8).max(128),
  deviceName: nonEmptyString.max(120).optional(),
});

export const saleItemInput = z.object({
  productId: z.string().uuid(),
  quantity: z.coerce.number().positive().finite().max(1_000_000),
  unitPriceMinor: z.coerce.bigint().int().nonnegative(),
});

export const paymentInput = z.object({
  method: z.enum(["CASH", "CARD", "TRANSFER", "OTHER"]),
  amountMinor: z.coerce.bigint().int().positive(),
});

export const createSaleInput = z.object({
  idempotencyKey,
  items: z.array(saleItemInput).min(1).max(200),
  payments: z.array(paymentInput).min(1).max(20),
  customerId: z.string().uuid().optional(),
  discountMinor: z.coerce.bigint().int().nonnegative().default(0n),
});

export const refundInput = z.object({
  amountMinor: z.coerce.bigint().int().positive(),
  reason: nonEmptyString.max(500),
  approvalId: z.string().uuid().optional(),
  restoreStock: z.boolean().default(false),
});

export const customerLookupInput = z.object({
  query: nonEmptyString.max(254),
});

export const customerCreateInput = z.object({
  name: nonEmptyString.max(120),
  email: email.optional(),
  phone: z.string().trim().max(32).optional(),
});

export const mutationEnvelope = z.object({ idempotencyKey });

export const approvalInput = z.object({
  action: nonEmptyString.max(100),
  targetId: z.string().uuid(),
  amountMinor: z.coerce.bigint().int().positive().optional(),
});
