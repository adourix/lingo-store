-- Durable contact-message email outbox.
-- A committed ContactMessage always gets a retryable email job.
CREATE TABLE "ContactMessageEmailOutbox" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "contactMessageId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastError" TEXT,
  "sentAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContactMessageEmailOutbox_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ContactMessageEmailOutbox_contactMessageId_key" UNIQUE ("contactMessageId"),
  CONSTRAINT "ContactMessageEmailOutbox_contactMessageId_fkey"
    FOREIGN KEY ("contactMessageId") REFERENCES "ContactMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ContactMessageEmailOutbox_status_check"
    CHECK ("status" IN ('PENDING', 'PROCESSING', 'SENT'))
);

CREATE INDEX "ContactMessageEmailOutbox_status_nextAttemptAt_idx"
  ON "ContactMessageEmailOutbox" ("status", "nextAttemptAt");

CREATE OR REPLACE FUNCTION "enqueue_contact_message_email"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO "ContactMessageEmailOutbox" ("contactMessageId")
  VALUES (NEW."id")
  ON CONFLICT ("contactMessageId") DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "ContactMessage_enqueue_email"
AFTER INSERT ON "ContactMessage"
FOR EACH ROW
EXECUTE FUNCTION "enqueue_contact_message_email"();
