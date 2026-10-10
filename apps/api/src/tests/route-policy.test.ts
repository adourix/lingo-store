import assert from "node:assert/strict";
import { assertRoutePolicy, ROUTE_POLICY } from "../route-policy.js";

for (const route of ROUTE_POLICY) {
  const separator = route.indexOf(" ");
  assert.notEqual(separator, -1, `invalid route policy entry: ${route}`);
  const method = route.slice(0, separator);
  const url = route.slice(separator + 1);
  assert.doesNotThrow(() => assertRoutePolicy(method, url), route);
  assert.doesNotThrow(() => assertRoutePolicy(method.toLowerCase(), url), route);
}

assert.doesNotThrow(() => assertRoutePolicy("HEAD", "/api/admin/dashboard"));
assert.doesNotThrow(() => assertRoutePolicy(["GET", "HEAD"], "/api/admin/dashboard"));
assert.doesNotThrow(() => assertRoutePolicy("GET", "/health"));
assert.doesNotThrow(() => assertRoutePolicy("GET", "/api/admin/dashboard"));

assert.throws(
  () => assertRoutePolicy("GET", "/api/admin/secret-route"),
  /ROUTE_POLICY_MISSING/,
);
assert.throws(
  () => assertRoutePolicy("DELETE", "/api/admin/dashboard"),
  /ROUTE_POLICY_MISSING/,
);
assert.throws(
  () => assertRoutePolicy("OPTIONS", "/api/pos/sales"),
  /ROUTE_POLICY_MISSING/,
);
assert.throws(
  () => assertRoutePolicy("POST", "/api/admin/users"),
  /ROUTE_POLICY_MISSING/,
);
assert.throws(
  () => assertRoutePolicy("GET", "/api/pos/not-a-route"),
  /ROUTE_POLICY_MISSING/,
);

process.stdout.write(`route policy tests passed (${ROUTE_POLICY.size} routes)\n`);
