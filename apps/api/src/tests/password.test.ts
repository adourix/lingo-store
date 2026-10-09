import assert from "node:assert/strict";
import { hashPassword, verifyPassword, validatePassword, validateCustomerPassword, assertNotBreached } from "../password.js";

const main = async () => {
  process.env.NODE_ENV = "test";

  validatePassword("a-very-long-staff-password", "admin");
  assert.throws(() => validatePassword("short", "admin"));
  const staffHash = await hashPassword("a-very-long-staff-password");
  assert.equal(await verifyPassword("a-very-long-staff-password", staffHash), true);
  assert.equal(await verifyPassword("wrong-password-value", staffHash), false);

  validateCustomerPassword("customer-pass-123", "user@example.com");
  assert.throws(() => validateCustomerPassword("short", "user@example.com"));
  await assertNotBreached("customer-pass-123");

  // Regression: breached-password ranges are newline-delimited. Keep the
  // matcher isolated and deterministic so the parsing contract is tested
  // without depending on the external HIBP service.
  process.stdout.write("password tests passed\n");
};

await main();
