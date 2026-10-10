import assert from "node:assert/strict";
import test from "node:test";
import {
  adminLoginInput,
  customerLoginInput,
  email,
  idempotencyKey,
  mutationEnvelope,
  pagination,
  posRefreshInput,
  terminalEnrollmentInput,
  totpCode,
  username,
} from "./index.js";

test("normalizes valid email and username", () => {
  assert.equal(email.parse(" User@Example.COM "), "user@example.com");
  assert.equal(username.parse("cashier_01"), "cashier_01");
});

test("rejects malformed identity values", () => {
  assert.throws(() => email.parse("not-an-email"));
  assert.throws(() => username.parse("bad username"));
  assert.throws(() => totpCode.parse("12345"));
});

test("validates admin login alternatives", () => {
  const parsed = adminLoginInput.parse({
    username: "admin",
    password: "a-secure-password",
    otp: "123456",
  });
  assert.equal(parsed.username, "admin");
  assert.equal(parsed.otp, "123456");
});

test("validates customer login and POS refresh", () => {
  assert.equal(
    customerLoginInput.parse({
      email: "customer@example.com",
      password: "a-secure-password",
    }).email,
    "customer@example.com",
  );
  assert.equal(
    posRefreshInput.parse({ refreshToken: "r".repeat(32) }).refreshToken.length,
    32,
  );
});

test("validates terminal enrollment and mutation envelopes", () => {
  assert.equal(
    terminalEnrollmentInput.parse({ code: "ENROLL-1234", deviceName: "Counter 1" }).deviceName,
    "Counter 1",
  );
  assert.equal(
    mutationEnvelope.parse({ idempotencyKey: "sale-2026-00000001" }).idempotencyKey,
    "sale-2026-00000001",
  );
  assert.throws(() => mutationEnvelope.parse({ idempotencyKey: "short" }));
});

test("normalizes bounded pagination", () => {
  assert.deepEqual(pagination.parse({ limit: "25" }), { limit: 25 });
  assert.throws(() => pagination.parse({ limit: "101" }));
});

test("opaque tokens stay bounded", () => {
  assert.equal(posRefreshInput.parse({ refreshToken: "x".repeat(512) }).refreshToken.length, 512);
  assert.throws(() => posRefreshInput.parse({ refreshToken: "x".repeat(513) }));
  assert.equal(idempotencyKey.parse("sale_2026:00000001"), "sale_2026:00000001");
});
