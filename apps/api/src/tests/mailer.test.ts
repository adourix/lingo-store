import assert from "node:assert/strict";
import { decryptSetupDeliveryPayload, makeSetupDeliveryPayload } from "../mailer.js";

process.env.EMAIL_PAYLOAD_KEY = Buffer.alloc(32, 7).toString("base64");

const expiresAt = new Date(Date.now() + 60_000);
const secret = "JBSWY3DPEHPK3PXP";
const payload = makeSetupDeliveryPayload(secret, expiresAt);
const decrypted = decryptSetupDeliveryPayload(payload);

assert.equal(decrypted.totpSecret, secret);
assert.equal(decrypted.expiresAt.toISOString(), expiresAt.toISOString());
assert.throws(() => decryptSetupDeliveryPayload("not-a-payload"));

const expired = Buffer.from(JSON.stringify({
  version: 1,
  expiresAt: new Date(Date.now() - 1000).toISOString(),
  totpSecret: { iv: "AA", tag: "AA", ciphertext: "AA" },
})).toString("base64url");
assert.throws(() => decryptSetupDeliveryPayload(expired));

process.stdout.write("mailer tests passed\n");
