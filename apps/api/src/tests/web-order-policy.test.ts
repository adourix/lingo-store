import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateWebOrderPricing,
  canCollectCashForWebOrder,
  canTransitionWebOrder,
} from "../web-order-policy.js";

test("customer order states only move through allowed operational transitions", () => {
  assert.equal(canTransitionWebOrder("PENDING", "CONFIRMED"), true);
  assert.equal(canTransitionWebOrder("CONFIRMED", "PROCESSING"), true);
  assert.equal(canTransitionWebOrder("PROCESSING", "READY"), true);
  assert.equal(canTransitionWebOrder("READY", "COMPLETED"), false);
  assert.equal(canTransitionWebOrder("COMPLETED", "CANCELLED"), false);
  assert.equal(canTransitionWebOrder("CANCELLED", "CONFIRMED"), false);
});

test("cash on delivery collection must settle the exact unpaid ready order once", () => {
  const valid = {
    status: "READY" as const,
    paymentStatus: "UNPAID" as const,
    totalMinor: 12345n,
    previouslyCollectedMinor: 0n,
    amountMinor: 12345n,
  };
  assert.equal(canCollectCashForWebOrder(valid), true);
  assert.equal(canCollectCashForWebOrder({ ...valid, amountMinor: 12344n }), false);
  assert.equal(canCollectCashForWebOrder({ ...valid, previouslyCollectedMinor: 1n }), false);
  assert.equal(canCollectCashForWebOrder({ ...valid, status: "PROCESSING" }), false);
  assert.equal(canCollectCashForWebOrder({ ...valid, paymentStatus: "PAID" }), false);
});

test("order totals are calculated from current server prices in integer minor units", () => {
  const catalog = new Map([
    ["p1", { productName: "Item", unitPriceMinor: 123n, unitCostMinor: 90n }],
    ["p2", { productName: "Fractional", unitPriceMinor: 99n, unitCostMinor: 50n }],
  ]);
  const result = calculateWebOrderPricing(
    [
      { productId: "p1", quantity: 2 },
      { productId: "p2", quantity: 0.5 },
    ],
    catalog,
  );
  assert.equal(result.items[0]?.totalMinor, 246n);
  assert.equal(result.items[1]?.totalMinor, 50n);
  assert.equal(result.subtotalMinor, 296n);
  assert.throws(() => calculateWebOrderPricing([{ productId: "missing", quantity: 1 }], catalog));
});
