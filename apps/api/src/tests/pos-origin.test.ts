import assert from "node:assert/strict";
import test from "node:test";

const mutating = ["POST", "PUT", "PATCH", "DELETE"];

const validatePosOrigin = (method: string, url: string, origin: string, posOrigin: string, fetchSite = "") => {
  if (!mutating.includes(method)) return;
  const path = url.split("?")[0];
  if (!path.startsWith("/api/pos/")) return;
  if (origin && origin !== posOrigin) throw new Error("POS_BROWSER_ORIGIN_FORBIDDEN");
  if (fetchSite === "cross-site") throw new Error("CROSS_SITE_FORBIDDEN");
};

test("allows native POS mutation without Origin", () => {
  assert.doesNotThrow(() => validatePosOrigin("POST", "/api/pos/sales", "", "https://pos.example.com"));
});

test("allows browser POS mutation only from configured POS origin", () => {
  assert.doesNotThrow(() => validatePosOrigin("POST", "/api/pos/sales", "https://pos.example.com", "https://pos.example.com"));
  assert.throws(() => validatePosOrigin("POST", "/api/pos/sales", "https://public.example.com", "https://pos.example.com"), /POS_BROWSER_ORIGIN_FORBIDDEN/);
});

test("rejects cross-site POS mutation even with the expected origin", () => {
  assert.throws(() => validatePosOrigin("POST", "/api/pos/sales", "https://pos.example.com", "https://pos.example.com", "cross-site"), /CROSS_SITE_FORBIDDEN/);
});

test("does not apply POS mutation origin policy to reads", () => {
  assert.doesNotThrow(() => validatePosOrigin("GET", "/api/pos/sales", "https://evil.example.com", "https://pos.example.com"));
});
