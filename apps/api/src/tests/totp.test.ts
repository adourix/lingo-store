import assert from "node:assert/strict";
import { totpCodeAt, verifyTotp } from "../totp.js";

const alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const bytes=Buffer.from("12345678901234567890");
let bits="";for(const byte of bytes)bits+=byte.toString(2).padStart(8,"0");
let secret="";for(let i=0;i<bits.length;i+=5)secret+=alphabet[parseInt(bits.slice(i,i+5).padEnd(5,"0"),2)];

// RFC 6238 SHA-1 test vectors, using the application's 6-digit format.
assert.equal(totpCodeAt(secret, 59), "287082");
assert.equal(totpCodeAt(secret, 1111111109), "081804");
assert.equal(totpCodeAt(secret, 2000000000), "279037");

assert.equal(verifyTotp(secret, "000000"), null);

process.stdout.write("totp RFC 6238 tests passed\\n");
