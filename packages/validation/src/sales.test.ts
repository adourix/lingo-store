import assert from "node:assert/strict";
import test from "node:test";
import { idempotencyKey, mutationEnvelope } from "./index.js";

test("accepts production-safe idempotency keys", () => {
  const key = "d9428888-122b-4f17-a3b1-6f2a2f3c7d01";
  assert.equal(idempotencyKey.parse(key), key);
});

test("rejects ambiguous or oversized idempotency keys", () => {
  assert.throws(() => idempotencyKey.parse(""));
  assert.throws(() => idempotencyKey.parse("sale:terminal-01:00000001"));
  assert.throws(() => idempotencyKey.parse("x".repeat(129)));
});

test("requires the mutation envelope key", () => {
  assert.throws(() => mutationEnvelope.parse({}));
  assert.equal(
    mutationEnvelope.parse({ idempotencyKey: "d9428888-122b-4f17-a3b1-6f2a2f3c7d01" })
      .idempotencyKey,
    "d9428888-122b-4f17-a3b1-6f2a2f3c7d01",
  );
});
