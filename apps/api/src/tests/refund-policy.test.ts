import assert from "node:assert/strict";
import test from "node:test";
import { canRestoreSaleStock } from "../refund-policy.js";

test("stock restoration is allowed only for one full-sale refund", () => {
  assert.equal(canRestoreSaleStock(10_000n, 0n, 10_000n), true);
  assert.equal(canRestoreSaleStock(10_000n, 0n, 4_000n), false);
  assert.equal(canRestoreSaleStock(10_000n, 4_000n, 6_000n), false);
  assert.equal(canRestoreSaleStock(10_000n, 10_000n, 1n), false);
});
