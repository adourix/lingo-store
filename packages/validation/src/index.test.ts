import assert from "node:assert/strict";
import test from "node:test";
import {
  adminLoginInput,
  approvalInput,
  createSaleInput,
  customerCreateInput,
  customerLoginInput,
  customerRegistrationInput,
  email,
  idempotencyKey,
  mutationEnvelope,
  pagination,
  paymentInput,
  posRefreshInput,
  refundInput,
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

test("requires an admin login identity", () => {
  assert.throws(() => adminLoginInput.parse({ password: "a-secure-password" }));
  assert.equal(
    adminLoginInput.parse({ username: "admin", password: "a-secure-password", otp: "123456" }).username,
    "admin",
  );
});

test("validates customer registration and login", () => {
  assert.equal(
    customerLoginInput.parse({ email: "customer@example.com", password: "a-secure-password" }).email,
    "customer@example.com",
  );
  assert.equal(
    customerRegistrationInput.parse({
      email: " Customer@Example.COM ",
      password: "a-secure-password",
      name: "Customer",
    }).email,
    "customer@example.com",
  );
});

test("validates terminal enrollment and POS refresh", () => {
  assert.equal(
    terminalEnrollmentInput.parse({ code: "ENROLL-1234", deviceName: "Counter 1" }).deviceName,
    "Counter 1",
  );
  assert.equal(posRefreshInput.parse({ refreshToken: "r".repeat(32) }).refreshToken.length, 32);
});

test("validates sales, payments, refunds, and approvals", () => {
  const sale = createSaleInput.parse({
    idempotencyKey: "sale-2026-00000001",
    items: [{ productId: "11111111-1111-4111-8111-111111111111", quantity: 2, unitPriceMinor: 1500 }],
    payments: [{ method: "CASH", amountMinor: 3000 }],
  });
  assert.equal(sale.items[0].unitPriceMinor, 1500n);
  assert.equal(sale.payments[0].amountMinor, 3000n);
  assert.equal(refundInput.parse({ amountMinor: 500, reason: "Customer return" }).restoreStock, false);
  assert.equal(
    approvalInput.parse({ action: "sale.refund", targetId: "11111111-1111-4111-8111-111111111111" }).action,
    "sale.refund",
  );
  assert.equal(paymentInput.parse({ method: "CARD", amountMinor: 1000 }).amountMinor, 1000n);
});

test("rejects unsafe sale and refund values", () => {
  assert.throws(() => createSaleInput.parse({
    idempotencyKey: "sale-2026-00000001",
    items: [],
    payments: [{ method: "CASH", amountMinor: 1000 }],
  }));
  assert.throws(() => refundInput.parse({ amountMinor: 0, reason: "bad" }));
  assert.throws(() => approvalInput.parse({ action: "sale.refund", targetId: "not-a-uuid" }));
});

test("validates customer lookup and creation", () => {
  assert.equal(customerCreateInput.parse({ name: "Ahmed", phone: "+201000000000" }).name, "Ahmed");
  assert.equal(customerCreateInput.parse({ name: "Ahmed", email: "A@EXAMPLE.COM" }).email, "a@example.com");
});

test("validates mutation envelopes and pagination", () => {
  assert.equal(mutationEnvelope.parse({ idempotencyKey: "sale-2026-00000001" }).idempotencyKey, "sale-2026-00000001");
  assert.throws(() => mutationEnvelope.parse({ idempotencyKey: "short" }));
  assert.deepEqual(pagination.parse({ limit: "25" }), { limit: 25 });
  assert.throws(() => pagination.parse({ limit: "101" }));
});

test("opaque tokens stay bounded", () => {
  assert.equal(posRefreshInput.parse({ refreshToken: "x".repeat(512) }).refreshToken.length, 512);
  assert.throws(() => posRefreshInput.parse({ refreshToken: "x".repeat(513) }));
  assert.equal(idempotencyKey.parse("sale_2026:00000001"), "sale_2026:00000001");
});
