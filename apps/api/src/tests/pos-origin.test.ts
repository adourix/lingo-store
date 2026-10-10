import assert from "node:assert/strict";
import test from "node:test";
import { posMutationOriginError } from "../origin-policy.js";

test("POS browser mutations require the configured origin", () => {
  assert.equal(
    posMutationOriginError(
      "POST",
      "/api/pos/sales",
      "https://pos.example.com",
      "https://pos.example.com",
      "",
    ),
    null,
  );
  assert.equal(
    posMutationOriginError("POST", "/api/pos/sales", "", "https://pos.example.com", ""),
    "POS_BROWSER_ORIGIN_FORBIDDEN",
  );
  assert.equal(
    posMutationOriginError(
      "POST",
      "/api/pos/sales",
      "https://public.example.com",
      "https://pos.example.com",
      "",
    ),
    "POS_BROWSER_ORIGIN_FORBIDDEN",
  );
});

test("cross-site POS mutations are rejected even with the configured origin", () => {
  assert.equal(
    posMutationOriginError(
      "POST",
      "/api/pos/sales",
      "https://pos.example.com",
      "https://pos.example.com",
      "cross-site",
    ),
    "CROSS_SITE_FORBIDDEN",
  );
});

test("POS Origin policy does not apply to reads or other surfaces", () => {
  assert.equal(
    posMutationOriginError(
      "GET",
      "/api/pos/sales",
      "https://evil.example.com",
      "https://pos.example.com",
      "",
    ),
    null,
  );
  assert.equal(
    posMutationOriginError("POST", "/api/admin/approvals", "", "https://pos.example.com", ""),
    null,
  );
});
