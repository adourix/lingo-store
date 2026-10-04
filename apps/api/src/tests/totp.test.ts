import assert from "node:assert/strict";
import { totpCodeAt, verifyTotp } from "../totp.js";

const secret = "JBSWY3DPEHPK3PXP";

// RFC 6238 SHA-1 test vectors, using the application's 6-digit format.
assert.equal(totpCodeAt(secret, 59), "287082");
assert.equal(totpCodeAt(secret, 1111111109), "081804");
assert.equal(totpCodeAt(secret, 2000000000), "279037");

assert.equal(verifyTotp(secret, "000000"), null);

process.stdout.write("totp RFC 6238 tests passed\n");
