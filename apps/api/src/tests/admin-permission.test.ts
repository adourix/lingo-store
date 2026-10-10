import assert from "node:assert/strict";
import { permissionForAdminRoute } from "../admin-permission.js";

assert.equal(permissionForAdminRoute({ method: "GET", url: "/api/admin/dashboard" }), "dashboard.view");
assert.equal(permissionForAdminRoute({ method: "POST", url: "/api/admin/sales/123/refund" }), "sales.refund");
assert.equal(permissionForAdminRoute({ method: "DELETE", url: "/api/admin/products/123" }), "products.delete");
assert.equal(permissionForAdminRoute({ method: "GET", url: "/api/admin/reports/summary" }), "reports.view");
assert.equal(permissionForAdminRoute({ method: "GET", url: "/api/admin/unknown" }), null);
assert.equal(permissionForAdminRoute({ method: "PUT", url: "/api/admin/products/123" }), null);
process.stdout.write("admin permission policy tests passed\n");
