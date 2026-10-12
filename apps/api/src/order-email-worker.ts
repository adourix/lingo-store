import { PrismaClient } from "@prisma/client";
import { sendTransactionalMail } from "./mailer.js";
import { startContactEmailWorker } from "./contact-email-worker.js";

const db = new PrismaClient();
const POLL_INTERVAL_MS = 5_000;
const STALE_PROCESSING_MS = 10 * 60_000;
const MAX_ERROR_LENGTH = 1000;

const moneyText = (minor: bigint) => (Number(minor) / 100).toFixed(2);

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const statusText = (status: string) =>
  ({
    PENDING: "Pending",
    CONFIRMED: "Confirmed",
    PROCESSING: "Processing",
    READY: "Ready",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
  })[status] || status;

const resetStaleJobs = async () => {
  await db.$executeRaw`
    UPDATE "WebOrderEmailOutbox"
    SET "status" = 'PENDING', "updatedAt" = NOW(), "lastError" = 'WORKER_RESTART_RECOVERY'
    WHERE "status" = 'PROCESSING'
      AND "updatedAt" < NOW() - INTERVAL '10 minutes'
  `;
};

type ClaimedJob = { id: string; orderId: string; attempts: number };

const claimNextJob = async (): Promise<ClaimedJob | null> => {
  const rows = await db.$queryRaw<ClaimedJob[]>`
    WITH candidate AS (
      SELECT "id"
      FROM "WebOrderEmailOutbox"
      WHERE "status" = 'PENDING'
        AND "nextAttemptAt" <= NOW()
      ORDER BY "createdAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    UPDATE "WebOrderEmailOutbox" AS outbox
    SET
      "status" = 'PROCESSING',
      "attempts" = outbox."attempts" + 1,
      "updatedAt" = NOW()
    FROM candidate
    WHERE outbox."id" = candidate."id"
    RETURNING outbox."id", outbox."orderId", outbox."attempts"
  `;
  return rows[0] || null;
};

const markSent = async (id: string) => {
  await db.$executeRaw`
    UPDATE "WebOrderEmailOutbox"
    SET "status" = 'SENT', "sentAt" = NOW(), "updatedAt" = NOW(), "lastError" = NULL
    WHERE "id" = ${id}
  `;
};

const markRetry = async (id: string, attempts: number, error: unknown) => {
  const message = String(error instanceof Error ? error.message : error).slice(0, MAX_ERROR_LENGTH);
  const delaySeconds = Math.min(60 * 2 ** Math.max(0, attempts - 1), 3600);
  await db.$executeRaw`
    UPDATE "WebOrderEmailOutbox"
    SET
      "status" = 'PENDING',
      "nextAttemptAt" = NOW() + (${delaySeconds} * INTERVAL '1 second'),
      "updatedAt" = NOW(),
      "lastError" = ${message}
    WHERE "id" = ${id}
  `;
};

const sendOrderConfirmation = async (orderId: string) => {
  const order = await db.webOrder.findUnique({
    where: { id: orderId },
    include: {
      customerAccount: { select: { email: true, name: true } },
      items: {
        select: {
          productName: true,
          quantity: true,
          unitPriceMinor: true,
          totalMinor: true,
        },
      },
    },
  });
  if (!order) throw new Error("ORDER_NOT_FOUND");

  const itemLines = order.items.map(
    (item) =>
      `${item.productName} x ${item.quantity.toString()} — ${moneyText(item.totalMinor)}`,
  );
  const itemRows = order.items
    .map(
      (item) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid #eee">${escapeHtml(item.productName)}</td><td style="padding:8px 0;border-bottom:1px solid #eee;text-align:center">${escapeHtml(item.quantity.toString())}</td><td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right">${escapeHtml(moneyText(item.totalMinor))}</td></tr>`,
    )
    .join("");

  const text = [
    `Hello ${order.customerAccount.name},`,
    "",
    "Thank you for your order from Lingo Store.",
    "",
    `Order: ${order.invoiceNo}`,
    `Status: ${statusText(order.status)}`,
    `Total: ${moneyText(order.totalMinor)}`,
    `Payment: ${order.paymentMethod}`,
    "",
    "Items:",
    ...itemLines,
    "",
    `Recipient: ${order.recipientName}`,
    `Phone: ${order.recipientPhone}`,
    `Shipping address: ${order.shippingAddress}`,
    "",
    "We will keep you updated when the order status changes.",
  ].join("\n");

  const html = `<!doctype html><html><body style="margin:0;background:#f6f6f6;font-family:Arial,sans-serif;color:#222"><div style="max-width:640px;margin:32px auto;background:#fff;padding:32px;border:1px solid #e5e5e5;border-radius:12px"><h1 style="margin:0 0 12px">Lingo Store</h1><p>Hello ${escapeHtml(order.customerAccount.name)},</p><p>Thank you for your order.</p><p><strong>Order:</strong> ${escapeHtml(order.invoiceNo)}<br><strong>Status:</strong> ${escapeHtml(statusText(order.status))}<br><strong>Payment:</strong> ${escapeHtml(order.paymentMethod)}</p><table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left;padding:8px 0">Item</th><th style="padding:8px 0">Qty</th><th style="text-align:right;padding:8px 0">Total</th></tr></thead><tbody>${itemRows}</tbody></table><p style="text-align:right;font-size:18px"><strong>Total: ${escapeHtml(moneyText(order.totalMinor))}</strong></p><p><strong>Delivery</strong><br>${escapeHtml(order.recipientName)}<br>${escapeHtml(order.recipientPhone)}<br>${escapeHtml(order.shippingAddress)}</p><p>We will keep you updated when the order status changes.</p></div></body></html>`;

  await sendTransactionalMail({
    to: order.customerAccount.email,
    subject: `Lingo Store order ${order.invoiceNo} received`,
    text,
    html,
  });
};

const processOne = async () => {
  const job = await claimNextJob();
  if (!job) return false;
  try {
    await sendOrderConfirmation(job.orderId);
    await markSent(job.id);
  } catch (error) {
    await markRetry(job.id, job.attempts, error);
  }
  return true;
};

let started = false;
let running = false;

export const startOrderEmailWorker = () => {
  if (started) return;
  started = true;
  startContactEmailWorker();

  void (async () => {
    try {
      await resetStaleJobs();
    } catch (error) {
      console.error("order email worker startup failed", error);
    }

    const tick = async () => {
      if (running) return;
      running = true;
      try {
        for (let i = 0; i < 10; i += 1) {
          if (!(await processOne())) break;
        }
      } catch (error) {
        console.error("order email worker tick failed", error);
      } finally {
        running = false;
      }
    };

    await tick();
    setInterval(() => void tick(), POLL_INTERVAL_MS);
  })();
};
