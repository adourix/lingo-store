import { createHmac } from "node:crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function decodeBase32(input: string): Buffer {
  const clean = input.replace(/[\\s=]+/g, "").toUpperCase();
  let buffer = 0;
  let bits = 0;
  const bytes: number[] = [];

  for (const char of clean) {
    const value = ALPHABET.indexOf(char);
    if (value < 0) throw new Error("INVALID_TOTP_SECRET");

    buffer = (buffer << 5) | value;
    bits += 5;

    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }

  return Buffer.from(bytes);
}

function hotp(key: Buffer, counter: number): string {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const digest = createHmac("sha1", key).update(counterBuffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    (digest[offset + 1] << 16) |
    (digest[offset + 2] << 8) |
    digest[offset + 3];

  return String(binary % 1_000_000).padStart(6, "0");
}

export function totpStep(step = 30): number {
  return Math.floor(Date.now() / 1000 / step);
}

export function totpCodeAt(secret: string, timestampSeconds: number, step = 30): string {
  const key = decodeBase32(secret);
  return hotp(key, Math.floor(timestampSeconds / step));
}

export function verifyTotp(
  secret: string,
  code: string,
  step = 30,
): number | null {
  if (!/^\\d{6}$/.test(code)) return null;

  let key: Buffer;
  try {
    key = decodeBase32(secret);
  } catch {
    return null;
  }

  const now = totpStep(step);

  for (let delta = -1; delta <= 1; delta++) {
    const counter = now + delta;
    if (counter < 0) continue;

    if (hotp(key, counter) === code) return counter;
  }

  return null;
}
