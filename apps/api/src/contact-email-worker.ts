import { PrismaClient } from "@prisma/client";
import { sendTransactionalMail } from "./mailer.js";

const db = new PrismaClient();
const POLL_INTERVAL_MS = 5_000;
const STALE_PROCESSING_MS = 10 * 60_000;
const MAX_ERROR_LENGTH = 1000;

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const contactRecipient = () =>
  process.env.EMAIL_CONTACT_TO?.trim() || process.env.EMAIL_REPLY_TO?.trim() || "support@lingostore.store";

const resetStaleJobs = async () => {
  await db.$executeRaw`
    UPDATE "ContactMessageEmailOutbox"
    SET "status" = 'PENDING', "updatedAt" = NOW(), "lastError" = 'WORKER_RESTART_RECOVERY'
    WHERE "status" = 'PROCESSING'
      AND "updatedAt" < NOW() - INTERVAL '10 minutes'
  `;
};

type ClaimedJob = { id: string; contactMessageId: string; attempts: number };

const claimNextJob = async (): Promise<ClaimedJob | null> => {
  const rows = await db.$queryRaw<ClaimedJob[]>`
    WITH candidate AS (
      SELECT "id"
      FROM "ContactMessageEmailOutbox"
      WHERE "status" = 'PENDING'
        AND "nextAttemptAt" <= NOW()
      ORDER BY "createdAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    UPDATE "ContactMessageEmailOutbox" AS outbox
    SET
      "status" = 'PROCESSING',
      "attempts" = outbox."attempts" + 1,
      "updatedAt" = NOW()
    FROM candidate
    WHERE outbox."id" = candidate."id"
    RETURNING outbox."id", outbox."contactMessageId", outbox."attempts"
  `;
  return rows[0] || null;
};

const markSent = async (id: string) => {
  await db.$executeRaw`
    UPDATE "ContactMessageEmailOutbox"
    SET "status" = 'SENT', "sentAt" = NOW(), "updatedAt" = NOW(), "lastError" = NULL
    WHERE "id" = ${id}
  `;
};

const markRetry = async (id: string, attempts: number, error: unknown) => {
  const message = String(error instanceof Error ? error.message : error).slice(0, MAX_ERROR_LENGTH);
  const delaySeconds = Math.min(60 * 2 ** Math.max(0, attempts - 1), 3600);
  await db.$executeRaw`
    UPDATE "ContactMessageEmailOutbox"
    SET
      "status" = 'PENDING',
      "nextAttemptAt" = NOW() + (${delaySeconds} * INTERVAL '1 second'),
      "updatedAt" = NOW(),
      "lastError" = ${message}
    WHERE "id" = ${id}
  `;
};

const sendContactMessage = async (contactMessageId: string) => {
  const message = await db.contactMessage.findUnique({ where: { id: contactMessageId } });
  if (!message) throw new Error("CONTACT_MESSAGE_NOT_FOUND");

  const text = [
    "New Lingo Store contact message",
    "",
    `Name: ${message.name}`,
    `Email: ${message.email}`,
    `Received: ${message.createdAt.toISOString()}`,
    "",
    "Message:",
    message.message,
  ].join("\n");

  const html = `<!doctype html><html><body style="margin:0;background:#f6f6f6;font-family:Arial,sans-serif;color:#222"><div style="max-width:640px;margin:32px auto;background:#fff;padding:32px;border:1px solid #e5e5e5;border-radius:12px"><h1 style="margin:0 0 20px">Lingo Store contact message</h1><p><strong>Name:</strong> ${escapeHtml(message.name)}</p><p><strong>Email:</strong> ${escapeHtml(message.email)}</p><p><strong>Received:</strong> ${escapeHtml(message.createdAt.toISOString())}</p><div style="margin-top:24px;padding:20px;background:#f8f8f8;border-radius:8px;white-space:pre-wrap">${escapeHtml(message.message)}</div></div></body></html>`;

  await sendTransactionalMail({
    to: contactRecipient(),
    replyTo: message.email,
    subject: `Lingo Store contact message from ${message.name}`,
    text,
    html,
  });
};

const processOne = async () => {
  const job = await claimNextJob();
  if (!job) return false;
  try {
    await sendContactMessage(job.contactMessageId);
    await markSent(job.id);
  } catch (error) {
    await markRetry(job.id, job.attempts, error);
  }
  return true;
};

let started = false;
let running = false;

export const startContactEmailWorker = () => {
  if (started) return;
  started = true;

  void (async () => {
    try {
      await resetStaleJobs();
    } catch (error) {
      console.error("contact email worker startup failed", error);
    }

    const tick = async () => {
      if (running) return;
      running = true;
      try {
        for (let i = 0; i < 10; i += 1) {
          if (!(await processOne())) break;
        }
      } catch (error) {
        console.error("contact email worker tick failed", error);
      } finally {
        running = false;
      }
    };

    await tick();
    setInterval(() => void tick(), POLL_INTERVAL_MS);
  })();
};
