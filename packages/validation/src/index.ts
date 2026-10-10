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

export const adminLoginInput = z.object({
  username: username.optional(),
  email: email.optional(),
  password: password,
  otp: totpCode.optional(),
  recoveryCode: z.string().trim().min(8).max(128).optional(),
});

export const customerLoginInput = z.object({
  email,
  password,
});

export const posRefreshInput = z.object({
  refreshToken: opaqueToken,
});

export const terminalEnrollmentInput = z.object({
  code: z.string().trim().min(8).max(128),
  deviceName: nonEmptyString.max(120).optional(),
});

export const mutationEnvelope = z.object({
  idempotencyKey,
});
