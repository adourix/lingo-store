import assert from "node:assert/strict";
import { totpCodeAt, verifyTotp } from "../totp.js";

const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

assert.equal(totpCodeAt("12345678901234567890", 59), "94287082");
assert.equal(totpCodeAt("12345678901234567890", 1111111109), "07081804");
assert.equal(totpCodeAt("12345678901234567890", 2000000000), "65353130");

assert.equal(verifyTotp(secret, "000000"), null);

process.stdout.write("totp RFC 6238 tests passed\n");
