import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const here = dirname(fileURLToPath(import.meta.url));
const migration = readFileSync(
  resolve(here, "../../../../prisma/migrations/20261012_cash_on_delivery_orders/migration.sql"),
  "utf8",
);

test("web cash-order migration keeps financial snapshots immutable", () => {
  assert.match(migration, /REVOKE UPDATE, DELETE ON "WebOrderItem", "WebOrderCashReceipt" FROM lingo_app/);
  assert.match(migration, /REVOKE UPDATE, DELETE ON "WebOrder" FROM lingo_app/);
  assert.match(migration, /lingo_immutable_web_order_item/);
  assert.match(migration, /lingo_immutable_web_order_cash_receipt/);
  assert.match(migration, /lingo_web_order_transition_guard/);
  assert.match(migration, /lingo_web_order_cash_receipt_guard/);
});

test("web cash-order migration requires a paid completed order to have a receipt", () => {
  assert.match(migration, /NEW\."status" = 'COMPLETED' AND NOT EXISTS \(SELECT 1 FROM "WebOrderCashReceipt"/);
  assert.match(migration, /"WebOrder_completion_payment_check"/);
  assert.match(migration, /OLD\."paymentStatus" = 'UNPAID' AND NEW\."paymentStatus" = 'PAID'/);
});

test("web cash-order migration restricts operational transitions", () => {
  assert.match(migration, /OLD\."status" = 'PENDING' AND NEW\."status" IN \('CONFIRMED','CANCELLED'\)/);
  assert.match(migration, /OLD\."status" = 'CONFIRMED' AND NEW\."status" IN \('PROCESSING','CANCELLED'\)/);
  assert.match(migration, /OLD\."status" = 'PROCESSING' AND NEW\."status" IN \('READY','CANCELLED'\)/);
  assert.match(migration, /OLD\."status" = 'READY' AND NEW\."status" IN \('COMPLETED','CANCELLED'\)/);
});
