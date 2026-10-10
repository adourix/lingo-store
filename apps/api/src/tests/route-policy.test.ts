import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

assert.throws(() => assertRoutePolicy("GET", "/api/admin/secret-route"), /ROUTE_POLICY_MISSING/);
assert.throws(() => assertRoutePolicy("DELETE", "/api/admin/dashboard"), /ROUTE_POLICY_MISSING/);
assert.throws(() => assertRoutePolicy("OPTIONS", "/api/pos/sales"), /ROUTE_POLICY_MISSING/);
assert.throws(() => assertRoutePolicy("POST", "/api/admin/users"), /ROUTE_POLICY_MISSING/);
assert.throws(() => assertRoutePolicy("GET", "/api/pos/not-a-route"), /ROUTE_POLICY_MISSING/);

process.stdout.write(`route policy tests passed (${ROUTE_POLICY.size} routes)\n`);

const source = readFileSync(new URL("../server.ts", import.meta.url), "utf8");
const registrations = [
  ...source.matchAll(/app\.(get|post|put|patch|delete)<ApiRouteGeneric>\(\s*["`]([^"`]+)["`]/gs),
].map(([, method, url]) => `${method.toUpperCase()} ${url}`);
assert.equal(new Set(registrations).size, registrations.length, "duplicate literal Fastify routes");
for (const registration of registrations) {
  const separator = registration.indexOf(" ");
  assert.doesNotThrow(
    () => assertRoutePolicy(registration.slice(0, separator), registration.slice(separator + 1)),
    `missing policy for registered route ${registration}`,
  );
}
