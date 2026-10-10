CREATE TYPE "WebOrderStatus" AS ENUM ('PENDING','CONFIRMED','PROCESSING','READY','COMPLETED','CANCELLED');
CREATE TYPE "WebOrderPaymentStatus" AS ENUM ('UNPAID','PAID');

CREATE TABLE "WebOrder" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "invoiceNo" TEXT NOT NULL,
  "customerAccountId" TEXT NOT NULL,
  "status" "WebOrderStatus" NOT NULL DEFAULT 'PENDING',
  "paymentStatus" "WebOrderPaymentStatus" NOT NULL DEFAULT 'UNPAID',
  "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CASH',
  "subtotalMinor" BIGINT NOT NULL,
  "totalMinor" BIGINT NOT NULL,
  "recipientName" TEXT NOT NULL,
  "recipientPhone" TEXT NOT NULL,
  "shippingAddress" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "WebOrder_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WebOrder_invoiceNo_key" UNIQUE ("invoiceNo"),
  CONSTRAINT "WebOrder_total_nonnegative" CHECK ("totalMinor" >= 0),
  CONSTRAINT "WebOrder_subtotal_nonnegative" CHECK ("subtotalMinor" >= 0),
  CONSTRAINT "WebOrder_no_discount_mismatch" CHECK ("totalMinor" = "subtotalMinor"),
  CONSTRAINT "WebOrder_version_positive" CHECK ("version" > 0),
  CONSTRAINT "WebOrder_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "WebOrder_customerAccountId_createdAt_idx" ON "WebOrder"("customerAccountId","createdAt");
CREATE INDEX "WebOrder_status_createdAt_idx" ON "WebOrder"("status","createdAt");

CREATE TABLE "WebOrderItem" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "orderId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "productName" TEXT NOT NULL,
  "quantity" DECIMAL(14,3) NOT NULL,
  "unitPriceMinor" BIGINT NOT NULL,
  "unitCostMinor" BIGINT NOT NULL,
  "totalMinor" BIGINT NOT NULL,
  CONSTRAINT "WebOrderItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WebOrderItem_quantity_positive" CHECK ("quantity" > 0),
  CONSTRAINT "WebOrderItem_unit_price_nonnegative" CHECK ("unitPriceMinor" >= 0),
  CONSTRAINT "WebOrderItem_unit_cost_nonnegative" CHECK ("unitCostMinor" >= 0),
  CONSTRAINT "WebOrderItem_total_nonnegative" CHECK ("totalMinor" >= 0),
  CONSTRAINT "WebOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "WebOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "WebOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "WebOrderItem_orderId_idx" ON "WebOrderItem"("orderId");
CREATE INDEX "WebOrderItem_productId_idx" ON "WebOrderItem"("productId");

CREATE TABLE "WebOrderCashReceipt" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "orderId" TEXT NOT NULL,
  "amountMinor" BIGINT NOT NULL,
  "receivedByStaffId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WebOrderCashReceipt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WebOrderCashReceipt_amount_positive" CHECK ("amountMinor" > 0),
  CONSTRAINT "WebOrderCashReceipt_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "WebOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "WebOrderCashReceipt_receivedByStaffId_fkey" FOREIGN KEY ("receivedByStaffId") REFERENCES "StaffUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "WebOrderCashReceipt_receivedByStaffId_createdAt_idx" ON "WebOrderCashReceipt"("receivedByStaffId","createdAt");

CREATE FUNCTION lingo_reject_web_order_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'IMMUTABLE_RECORD: %', TG_TABLE_NAME USING ERRCODE = '55006';
END;
$$;
CREATE TRIGGER lingo_immutable_web_order_item BEFORE UPDATE OR DELETE ON "WebOrderItem" FOR EACH ROW EXECUTE FUNCTION lingo_reject_web_order_history_mutation();
CREATE TRIGGER lingo_immutable_web_order_cash_receipt BEFORE UPDATE OR DELETE ON "WebOrderCashReceipt" FOR EACH ROW EXECUTE FUNCTION lingo_reject_web_order_history_mutation();

REVOKE UPDATE, DELETE ON "WebOrderItem", "WebOrderCashReceipt" FROM lingo_app;
REVOKE UPDATE, DELETE ON "WebOrder" FROM lingo_app;
GRANT UPDATE ("status", "paymentStatus", "version", "updatedAt") ON "WebOrder" TO lingo_app;

CREATE UNIQUE INDEX "WebOrderCashReceipt_orderId_key" ON "WebOrderCashReceipt"("orderId");
CREATE FUNCTION lingo_web_order_transition_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."customerAccountId" IS DISTINCT FROM OLD."customerAccountId"
     OR NEW."invoiceNo" IS DISTINCT FROM OLD."invoiceNo"
     OR NEW."paymentMethod" IS DISTINCT FROM OLD."paymentMethod"
     OR NEW."subtotalMinor" IS DISTINCT FROM OLD."subtotalMinor"
     OR NEW."totalMinor" IS DISTINCT FROM OLD."totalMinor"
     OR NEW."recipientName" IS DISTINCT FROM OLD."recipientName"
     OR NEW."recipientPhone" IS DISTINCT FROM OLD."recipientPhone"
     OR NEW."shippingAddress" IS DISTINCT FROM OLD."shippingAddress" THEN
    RAISE EXCEPTION 'IMMUTABLE_RECORD: WebOrder financial/customer snapshot' USING ERRCODE = '55006';
  END IF;
  IF NEW."status" IS DISTINCT FROM OLD."status" AND NOT (
    (OLD."status" = 'PENDING' AND NEW."status" IN ('CONFIRMED','CANCELLED')) OR
    (OLD."status" = 'CONFIRMED' AND NEW."status" IN ('PROCESSING','CANCELLED')) OR
    (OLD."status" = 'PROCESSING' AND NEW."status" IN ('READY','CANCELLED')) OR
    (OLD."status" = 'READY' AND NEW."status" IN ('COMPLETED','CANCELLED'))
  ) THEN
    RAISE EXCEPTION 'INVALID_ORDER_TRANSITION' USING ERRCODE = '23514';
  END IF;
  IF NEW."status" = 'COMPLETED' AND NOT EXISTS (SELECT 1 FROM "WebOrderCashReceipt" WHERE "orderId" = NEW."id") THEN
    RAISE EXCEPTION 'ORDER_CASH_RECEIPT_REQUIRED' USING ERRCODE = '23514';
  END IF;
  IF NEW."paymentStatus" IS DISTINCT FROM OLD."paymentStatus" AND NOT (
    OLD."paymentStatus" = 'UNPAID' AND NEW."paymentStatus" = 'PAID' AND NEW."status" = 'COMPLETED'
  ) THEN
    RAISE EXCEPTION 'INVALID_ORDER_PAYMENT_TRANSITION' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER lingo_web_order_transition_guard BEFORE UPDATE ON "WebOrder" FOR EACH ROW EXECUTE FUNCTION lingo_web_order_transition_guard();
CREATE FUNCTION lingo_web_order_cash_receipt_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  order_status "WebOrderStatus";
  payment_status "WebOrderPaymentStatus";
  order_total BIGINT;
BEGIN
  SELECT "status", "paymentStatus", "totalMinor"
    INTO order_status, payment_status, order_total
    FROM "WebOrder" WHERE "id" = NEW."orderId" FOR UPDATE;
  IF NOT FOUND OR order_status <> 'READY' OR payment_status <> 'UNPAID' OR NEW."amountMinor" <> order_total THEN
    RAISE EXCEPTION 'INVALID_CASH_COLLECTION' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER lingo_web_order_cash_receipt_guard BEFORE INSERT ON "WebOrderCashReceipt" FOR EACH ROW EXECUTE FUNCTION lingo_web_order_cash_receipt_guard();
ALTER TABLE "WebOrder" ADD CONSTRAINT "WebOrder_completion_payment_check"
  CHECK (("status" = 'COMPLETED' AND "paymentStatus" = 'PAID') OR ("status" <> 'COMPLETED' AND "paymentStatus" = 'UNPAID'));
