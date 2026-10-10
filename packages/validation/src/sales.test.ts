import assert from "node:assert/strict";
import test from "node:test";
import { idempotencyKey, mutationEnvelope } from "./index.js";

test("accepts production-safe idempotency keys", () => {
  assert.equal(idempotencyKey.parse("sale:terminal-01:00000001"), "sale:terminal-01:00000001");
});

test("rejects ambiguous or oversized idempotency keys", () => {
  assert.throws(() => idempotencyKey.parse(""));
  assert.throws(() => idempotencyKey.parse("sale key with spaces"));
  assert.throws(() => idempotencyKey.parse("x".repeat(129)));
});

test("requires the mutation envelope key", () => {
  assert.throws(() => mutationEnvelope.parse({}));
  assert.equal(mutationEnvelope.parse({ idempotencyKey: "refund:terminal-01:0001" }).idempotencyKey, "refund:terminal-01:0001");
});
