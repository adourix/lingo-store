import assert from "node:assert/strict";
import {
  hashPassword,
  verifyPassword,
  validatePassword,
  validateCustomerPassword,
  assertNotBreached,
  containsBreachedPasswordHash,
} from "../password.js";

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

  assert.equal(containsBreachedPasswordHash("AAAA\r\nABCDEF:4\r\n123456:0\r\n", "abcdef"), true);
  assert.equal(containsBreachedPasswordHash("AAAA\r\nABCDEF:4\r\n", "notfound"), false);
  process.stdout.write("password tests passed\n");
};

await main();
