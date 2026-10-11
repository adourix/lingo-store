import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../../../../", import.meta.url));
const schema = readFileSync(`${root}/prisma/schema.prisma`, "utf8");
const migrationPath = `${root}/prisma/migrations/20261012_cash_on_delivery_orders/migration.sql`;
const migration = readFileSync(migrationPath, "utf8");

test("cash on delivery migration represents order tables and financial fields", () => {
  const expectedFields: Record<string, string[]> = {
    WebOrder: [
      "id",
      "invoiceNo",
      "customerAccountId",
      "status",
      "paymentStatus",
      "paymentMethod",
      "subtotalMinor",
      "totalMinor",
      "recipientName",
      "recipientPhone",
      "shippingAddress",
      "version",
      "createdAt",
      "updatedAt",
    ],
    WebOrderItem: [
      "id",
      "orderId",
      "productId",
      "productName",
      "quantity",
      "unitPriceMinor",
      "unitCostMinor",
      "totalMinor",
    ],
    WebOrderCashReceipt: [
      "id",
      "orderId",
      "amountMinor",
      "receivedByStaffId",
      "idempotencyKey",
      "createdAt",
    ],
  };
  for (const [model, fields] of Object.entries(expectedFields)) {
    assert.match(schema, new RegExp(`model ${model} \\{`));
    assert.match(migration, new RegExp(`CREATE TABLE "${model}"`));
    for (const field of fields)
      assert.match(
        migration,
        new RegExp(`"${field}"`),
        `${model}.${field} is absent from migration`,
      );
  }
  assert.match(migration, /FOREIGN KEY \("customerAccountId"\) REFERENCES "CustomerAccount"/);
  assert.match(migration, /FOREIGN KEY \("productId"\) REFERENCES "Product"/);
  assert.match(migration, /FOREIGN KEY \("receivedByStaffId"\) REFERENCES "StaffUser"/);
  assert.match(migration, /WebOrder_total_nonnegative/);
  assert.match(migration, /WebOrderItem_quantity_positive/);
  assert.match(migration, /WebOrderCashReceipt_amount_positive/);
  assert.match(schema, /@@unique\(\[orderId\]\)/);
  assert.match(migration, /WebOrderCashReceipt_orderId_key/);
});

test("order status, payment status, and immutable history have database defenses", () => {
  assert.match(migration, /lingo_web_order_transition_guard BEFORE UPDATE ON "WebOrder"/);
  assert.match(
    migration,
    /lingo_web_order_cash_receipt_guard BEFORE INSERT ON "WebOrderCashReceipt"/,
  );
  assert.match(
    migration,
    /lingo_immutable_web_order_item BEFORE UPDATE OR DELETE ON "WebOrderItem"/,
  );
  assert.match(
    migration,
    /lingo_immutable_web_order_cash_receipt BEFORE UPDATE OR DELETE ON "WebOrderCashReceipt"/,
  );
  assert.match(
    migration,
    /REVOKE UPDATE, DELETE ON "WebOrderItem", "WebOrderCashReceipt" FROM lingo_app/,
  );
  assert.match(
    migration,
    /GRANT UPDATE \("status", "paymentStatus", "version", "updatedAt"\) ON "WebOrder" TO lingo_app/,
  );
  assert.match(migration, /WebOrder_completion_payment_check/);

  assert.match(
    migration,
    /OLD\."status" = 'PENDING' AND NEW\."status" IN \('CONFIRMED','CANCELLED'\)/,
  );
  assert.match(
    migration,
    /OLD\."status" = 'CONFIRMED' AND NEW\."status" IN \('PROCESSING','CANCELLED'\)/,
  );
  assert.match(
    migration,
    /OLD\."status" = 'PROCESSING' AND NEW\."status" IN \('READY','CANCELLED'\)/,
  );
  assert.match(
    migration,
    /OLD\."status" = 'READY' AND NEW\."status" IN \('COMPLETED','CANCELLED'\)/,
  );
  assert.match(
    migration,
    /OLD\."paymentStatus" = 'UNPAID' AND NEW\."paymentStatus" = 'PAID' AND NEW\."status" = 'COMPLETED'/,
  );
  assert.match(migration, /ORDER_CASH_RECEIPT_REQUIRED/);
  assert.match(migration, /INVALID_CASH_COLLECTION/);
});

test("financial and customer snapshots cannot be changed through order transitions", () => {
  for (const field of [
    "customerAccountId",
    "invoiceNo",
    "paymentMethod",
    "subtotalMinor",
    "totalMinor",
    "recipientName",
    "recipientPhone",
    "shippingAddress",
  ]) {
    assert.match(
      migration,
      new RegExp(`NEW\\."${field}" IS DISTINCT FROM OLD\\."${field}"`),
      `missing immutability guard for WebOrder.${field}`,
    );
  }
});
