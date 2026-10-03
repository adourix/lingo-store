-- Align pre-existing databases with the v2 session/audit/invitation schema.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SessionState') THEN
    CREATE TYPE "SessionState" AS ENUM ('PENDING_MFA','ACTIVE');
  END IF;
END $$;
ALTER TABLE "StaffUser" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "StaffUser" ALTER COLUMN "passwordHash" DROP NOT NULL;
ALTER TABLE "StaffInvitation" ADD COLUMN IF NOT EXISTS "roleName" TEXT;
ALTER TABLE "StaffInvitation" ADD COLUMN IF NOT EXISTS "revokedAt" TIMESTAMPTZ;
ALTER TABLE "StaffInvitation" ADD COLUMN IF NOT EXISTS "mfaSecretEncrypted" TEXT;
ALTER TABLE "StaffInvitation" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "state" "SessionState" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "lastSeenAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "mfaVerifiedAt" TIMESTAMPTZ;
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "stepUpUntil" TIMESTAMPTZ;
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "ip" TEXT;
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "userAgent" TEXT;
ALTER TABLE "Terminal" ADD COLUMN IF NOT EXISTS "previousCredentialHash" TEXT;
ALTER TABLE "Terminal" ADD COLUMN IF NOT EXISTS "previousCredentialExpiresAt" TIMESTAMPTZ;
ALTER TABLE "Approval" ADD COLUMN IF NOT EXISTS "terminalId" TEXT;
ALTER TABLE "Approval" ADD COLUMN IF NOT EXISTS "cashierSessionId" TEXT;
ALTER TABLE "Approval" ADD COLUMN IF NOT EXISTS "targetId" TEXT;
ALTER TABLE "Approval" ADD COLUMN IF NOT EXISTS "amountMinor" BIGINT;
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "outcome" TEXT NOT NULL DEFAULT 'success';
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "actorType" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "actorRoleSnapshot" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "ip" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "userAgent" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "requestId" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "sessionRef" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "terminalId" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "changes" JSONB;

-- Lingo Store v2 hardening. Apply after the Prisma schema is present.
CREATE UNIQUE INDEX IF NOT EXISTS "StaffUser_email_key" ON "StaffUser" ("email") WHERE "email" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS cash_one_open_per_cashier ON "CashSession" ("openedById") WHERE "status" = 'OPEN';
CREATE INDEX IF NOT EXISTS session_active_staff_idx ON "Session" ("staffUserId","state","expiresAt") WHERE "revokedAt" IS NULL;
CREATE INDEX IF NOT EXISTS invitation_pending_idx ON "StaffInvitation" ("inviteeId","expiresAt") WHERE "usedAt" IS NULL AND "revokedAt" IS NULL;

CREATE OR REPLACE FUNCTION lingo_reject_financial_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'APPEND_ONLY_RECORD';
END $$;

DROP TRIGGER IF EXISTS sale_append_only ON "Sale";
CREATE TRIGGER sale_append_only BEFORE DELETE ON "Sale" FOR EACH ROW EXECUTE FUNCTION lingo_reject_financial_mutation();
DROP TRIGGER IF EXISTS payment_append_only ON "Payment";
CREATE TRIGGER payment_append_only BEFORE UPDATE OR DELETE ON "Payment" FOR EACH ROW EXECUTE FUNCTION lingo_reject_financial_mutation();
DROP TRIGGER IF EXISTS refund_append_only ON "Refund";
CREATE TRIGGER refund_append_only BEFORE UPDATE OR DELETE ON "Refund" FOR EACH ROW EXECUTE FUNCTION lingo_reject_financial_mutation();
DROP TRIGGER IF EXISTS inventory_movement_append_only ON "InventoryMovement";
CREATE TRIGGER inventory_movement_append_only BEFORE UPDATE OR DELETE ON "InventoryMovement" FOR EACH ROW EXECUTE FUNCTION lingo_reject_financial_mutation();
DROP TRIGGER IF EXISTS customer_payment_append_only ON "CustomerPayment";
CREATE TRIGGER customer_payment_append_only BEFORE UPDATE OR DELETE ON "CustomerPayment" FOR EACH ROW EXECUTE FUNCTION lingo_reject_financial_mutation();
DROP TRIGGER IF EXISTS supplier_payment_append_only ON "SupplierPayment";
CREATE TRIGGER supplier_payment_append_only BEFORE UPDATE OR DELETE ON "SupplierPayment" FOR EACH ROW EXECUTE FUNCTION lingo_reject_financial_mutation();
DROP TRIGGER IF EXISTS expense_append_only ON "Expense";
CREATE TRIGGER expense_append_only BEFORE UPDATE OR DELETE ON "Expense" FOR EACH ROW EXECUTE FUNCTION lingo_reject_financial_mutation();
DROP TRIGGER IF EXISTS audit_append_only ON "AuditLog";
CREATE TRIGGER audit_append_only BEFORE UPDATE OR DELETE ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION lingo_reject_financial_mutation();

DROP TRIGGER IF EXISTS purchase_append_only ON "Purchase";
CREATE TRIGGER purchase_append_only BEFORE UPDATE OR DELETE ON "Purchase" FOR EACH ROW EXECUTE FUNCTION lingo_reject_financial_mutation();

-- Financial item rows are also immutable.
DROP TRIGGER IF EXISTS sale_item_append_only ON "SaleItem";
CREATE TRIGGER sale_item_append_only BEFORE UPDATE OR DELETE ON "SaleItem" FOR EACH ROW EXECUTE FUNCTION lingo_reject_financial_mutation();
DROP TRIGGER IF EXISTS purchase_item_append_only ON "PurchaseItem";
CREATE TRIGGER purchase_item_append_only BEFORE UPDATE OR DELETE ON "PurchaseItem" FOR EACH ROW EXECUTE FUNCTION lingo_reject_financial_mutation();
