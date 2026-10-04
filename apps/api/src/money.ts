export function money(value: unknown): bigint {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 0) throw new Error("INVALID_MONEY");
  return BigInt(n);
}

export function qtyMilli(value: unknown): bigint {
  const s = String(value).trim();
  if (!/^\d+(?:\.\d{1,3})?$/.test(s)) throw new Error("INVALID_QUANTITY");
  const [whole, fraction = ""] = s.split(".");
  const milli = BigInt(whole) * 1000n + BigInt((fraction + "000").slice(0, 3));
  if (milli <= 0n || milli > 1_000_000_000n) throw new Error("INVALID_QUANTITY");
  return milli;
}

export function qty(value: unknown): number {
  return Number(qtyMilli(value)) / 1000;
}

export function minorForQuantity(unitMinor: bigint, quantity: unknown): bigint {
  const raw = unitMinor * qtyMilli(quantity);\n  return (raw + 500n) / 1000n;
}
