import assert from "node:assert/strict";
import test from "node:test";
import {
  saleItemInput,
  webOrderCashReceiptInput,
  webOrderCreateInput,
  webOrderStatusInput,
} from "./index.js";

const productId = "00000000-0000-4000-8000-000000000001";
const idempotencyKey = "00000000-0000-4000-8000-000000000002";

test("web checkout only accepts product quantities and cash on delivery", () => {
  const valid = {
    idempotencyKey,
    items: [{ productId, quantity: 2 }],
    recipientName: "Customer",
    recipientPhone: "+201000000000",
    shippingAddress: "12 Example Street",
    paymentMethod: "CASH",
  };
  assert.equal(webOrderCreateInput.safeParse(valid).success, true);
  assert.equal(webOrderCreateInput.safeParse({ ...valid, totalMinor: 1 }).success, false);
  assert.equal(webOrderCreateInput.safeParse({ ...valid, paymentMethod: "CARD" }).success, false);
  assert.equal(
    webOrderCreateInput.safeParse({ ...valid, items: [{ productId, quantity: 0 }] }).success,
    false,
  );
});

test("order cancellation requires a reason and cash collection requires a key and positive amount", () => {
  assert.equal(webOrderStatusInput.safeParse({ status: "CANCELLED" }).success, false);
  assert.equal(
    webOrderStatusInput.safeParse({ status: "CANCELLED", reason: "Customer requested" }).success,
    true,
  );
  assert.equal(
    webOrderCashReceiptInput.safeParse({ idempotencyKey, amountMinor: 100 }).success,
    true,
  );
  assert.equal(
    webOrderCashReceiptInput.safeParse({ idempotencyKey, amountMinor: 0 }).success,
    false,
  );
});

test("sale and web order quantities use the inventory three-decimal precision", () => {
  assert.equal(saleItemInput.safeParse({ productId, quantity: 1.125 }).success, true);
  assert.equal(saleItemInput.safeParse({ productId, quantity: 1.0001 }).success, false);
});
