import assert from "node:assert/strict";
import test from "node:test";
import { idempotencyKey, mutationEnvelope } from "./index.js";

const validKey = "00000000-0000-4000-8000-000000000002";

test("accepts production-safe idempotency keys", () => {
  const key = validKey;
  assert.equal(idempotencyKey.parse(key), key);
});

test("rejects ambiguous or oversized idempotency keys", () => {
  assert.throws(() => idempotencyKey.parse(""));
  assert.throws(() => idempotencyKey.parse("sale:terminal-01:00000001"));
  assert.throws(() => idempotencyKey.parse("x".repeat(129)));
});

test("requires the mutation envelope key", () => {
  assert.throws(() => mutationEnvelope.parse({}));
  assert.equal(mutationEnvelope.parse({ idempotencyKey: validKey }).idempotencyKey, validKey);
});
