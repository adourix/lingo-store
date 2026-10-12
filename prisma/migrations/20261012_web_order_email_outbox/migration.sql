-- Transactional order-confirmation outbox.
-- The row is created in the same transaction as WebOrder creation so a
-- successfully committed order always has a durable email job.
CREATE TABLE "WebOrderEmailOutbox" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "orderId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastError" TEXT,
  "sentAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WebOrderEmailOutbox_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WebOrderEmailOutbox_orderId_key" UNIQUE ("orderId"),
  CONSTRAINT "WebOrderEmailOutbox_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "WebOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "WebOrderEmailOutbox_status_check"
    CHECK ("status" IN ('PENDING', 'PROCESSING', 'SENT'))
);

CREATE INDEX "WebOrderEmailOutbox_status_nextAttemptAt_idx"
  ON "WebOrderEmailOutbox" ("status", "nextAttemptAt");

CREATE OR REPLACE FUNCTION "enqueue_web_order_email"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO "WebOrderEmailOutbox" ("orderId")
  VALUES (NEW."id")
  ON CONFLICT ("orderId") DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "WebOrder_enqueue_confirmation_email"
AFTER INSERT ON "WebOrder"
FOR EACH ROW
EXECUTE FUNCTION "enqueue_web_order_email"();
