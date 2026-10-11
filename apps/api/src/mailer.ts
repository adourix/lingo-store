import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export type SetupMail = {
  to: string;
  name: string;
  setupUrl: string;
  totpSecret: string;
  expiresAt: Date;
};

type TransactionalMail = { to: string; subject: string; text: string };
export type SetupDeliveryPayload = {
  version: 1;
  expiresAt: string;
  totpSecret: { iv: string; tag: string; ciphertext: string };
};

export const validateEmailPayloadKey = () => {
  const encoded = process.env.EMAIL_PAYLOAD_KEY || "";
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32 || key.toString("base64") !== encoded) {
    throw new Error("EMAIL_PAYLOAD_KEY must be a base64-encoded 32-byte key");
  }
  return key;
};

const encryptSetupSecret = (secret: string) => {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", validateEmailPayloadKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return {
    iv: iv.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
    ciphertext: ciphertext.toString("base64url"),
  };
};

const decryptSetupSecret = (value: SetupDeliveryPayload["totpSecret"]) => {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    validateEmailPayloadKey(),
    Buffer.from(value.iv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(value.tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(value.ciphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
};

const sendViaResend = async (mail: TransactionalMail) => {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!apiKey || !from) {
    if (process.env.NODE_ENV === "production") throw new Error("MAILER_NOT_CONFIGURED");
    return;
  }

  const endpoint = new URL(process.env.RESEND_API_URL?.trim() || "https://api.resend.com/emails");
  if (
    endpoint.protocol !== "https:" ||
    endpoint.hostname !== "api.resend.com" ||
    endpoint.username ||
    endpoint.password
  ) {
    throw new Error("RESEND_API_URL_INVALID");
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [mail.to],
      subject: mail.subject,
      text: mail.text,
      ...(process.env.EMAIL_REPLY_TO?.trim()
        ? { reply_to: process.env.EMAIL_REPLY_TO.trim() }
        : {}),
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error("MAILER_FAILED");
};

export const makeSetupDeliveryPayload = (secret: string, expiresAt: Date) =>
  Buffer.from(
    JSON.stringify({
      version: 1,
      expiresAt: expiresAt.toISOString(),
      totpSecret: encryptSetupSecret(secret),
    } satisfies SetupDeliveryPayload),
  ).toString("base64url");

export function decryptSetupDeliveryPayload(payload: string) {
  if (!payload || payload.length > 4096) {
    throw new Error("INVALID_SETUP_DELIVERY_PAYLOAD");
  }
  let decoded: SetupDeliveryPayload;
  try {
    decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SetupDeliveryPayload;
  } catch {
    throw new Error("INVALID_SETUP_DELIVERY_PAYLOAD");
  }
  if (
    decoded.version !== 1 ||
    typeof decoded.expiresAt !== "string" ||
    !decoded.totpSecret ||
    typeof decoded.totpSecret.iv !== "string" ||
    typeof decoded.totpSecret.tag !== "string" ||
    typeof decoded.totpSecret.ciphertext !== "string" ||
    !Number.isFinite(Date.parse(decoded.expiresAt)) ||
    Date.parse(decoded.expiresAt) <= Date.now()
  ) {
    throw new Error("INVALID_SETUP_DELIVERY_PAYLOAD");
  }
  return {
    totpSecret: decryptSetupSecret(decoded.totpSecret),
    expiresAt: new Date(decoded.expiresAt),
  };
}

export async function sendStaffSetupMail(mail: SetupMail) {
  const url = new URL(mail.setupUrl);
  url.searchParams.set("delivery", makeSetupDeliveryPayload(mail.totpSecret, mail.expiresAt));
  await sendViaResend({
    to: mail.to,
    subject: "Lingo Store staff account setup",
    text: [
      `Hello ${mail.name},`,
      "",
      "Use this secure, single-use link to choose your password and enroll MFA:",
      "",
      url.toString(),
      "",
      `The link expires at ${mail.expiresAt.toISOString()}.`,
      "If you were not expecting this invitation, contact your store administrator.",
    ].join("\n"),
  });
}

export async function sendTransactionalMail(mail: TransactionalMail) {
  await sendViaResend(mail);
}
