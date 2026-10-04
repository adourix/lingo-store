import assert from "node:assert/strict";
import { assertRoutePolicy } from "../route-policy.js";

assert.doesNotThrow(() => assertRoutePolicy("GET", "/api/admin/dashboard"));
assert.doesNotThrow(() => assertRoutePolicy("HEAD", "/api/admin/dashboard"));
assert.throws(() => assertRoutePolicy("GET", "/api/admin/secret-route"), /ROUTE_POLICY_MISSING/);
process.stdout.write("route policy tests passed\n");
