import assert from "node:assert/strict";
import test from "node:test";
import { posMutationOriginError } from "../origin-policy.js";

const POS = "https://pos.example.com";

test("POS mutations require the exact configured origin", () => {
  assert.equal(posMutationOriginError("POST", "/api/pos/sales", POS, POS, "same-origin"), null);
  assert.equal(
    posMutationOriginError(
      "POST",
      "/api/pos/sales",
      "https://public.example.com",
      POS,
      "same-origin",
    ),
    "POS_BROWSER_ORIGIN_FORBIDDEN",
  );
  assert.equal(
    posMutationOriginError("POST", "/api/pos/sales", "", POS, "", ""),
    "POS_BROWSER_ORIGIN_FORBIDDEN",
  );
});

test("POS mutations validate Referer when Origin is absent", () => {
  assert.equal(
    posMutationOriginError("POST", "/api/pos/sales", "", POS, "same-origin", POS + "/checkout"),
    null,
  );
  assert.equal(
    posMutationOriginError("POST", "/api/pos/sales", "", POS, "", "https://evil.example/"),
    "POS_BROWSER_ORIGIN_FORBIDDEN",
  );
});

test("same-site Fetch Metadata is allowed and cross-site is rejected", () => {
  assert.equal(posMutationOriginError("POST", "/api/pos/sales", POS, POS, "same-site"), null);
  assert.equal(
    posMutationOriginError("DELETE", "/api/pos/sales/1", POS, POS, "cross-site"),
    "CROSS_SITE_FORBIDDEN",
  );
});

test("Origin policy does not apply to reads or other surfaces", () => {
  assert.equal(
    posMutationOriginError("GET", "/api/pos/sales", "https://evil.example.com", POS, "cross-site"),
    null,
  );
  assert.equal(posMutationOriginError("POST", "/api/admin/approvals", "", POS, ""), null);
});
