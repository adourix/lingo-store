import assert from "node:assert/strict";
import { permissionForAdminRoute } from "../admin-permission.js";
import { ROUTE_POLICY } from "../route-policy.js";

const allowed: Array<[string, string, string]> = [
  ["GET", "/api/admin/dashboard", "dashboard.view"],
  ["GET", "/api/admin/auth/me", "admin.access"],
  ["POST", "/api/admin/auth/logout", "admin.access"],
  ["POST", "/api/admin/account/security/password", "admin.access"],
  ["GET", "/api/admin/sessions", "admin.access"],
  ["POST", "/api/admin/sessions/123/revoke", "admin.access"],
  ["POST", "/api/admin/users/invitations", "users.create"],
  ["GET", "/api/admin/users", "users.view"],
  ["PATCH", "/api/admin/users/123/status", "users.disable"],
  ["PATCH", "/api/admin/users/123/role", "users.assign_role"],
  ["POST", "/api/admin/users/123/reset-mfa", "users.reset_mfa"],
  ["GET", "/api/admin/products", "products.view"],
  ["POST", "/api/admin/products", "products.create"],
  ["PATCH", "/api/admin/products/123", "products.update"],
  ["DELETE", "/api/admin/products/123", "products.delete"],
  ["GET", "/api/admin/inventory", "inventory.view"],
  ["POST", "/api/admin/inventory/adjust", "inventory.adjust"],
  ["GET", "/api/admin/customers", "customers.view"],
  ["PATCH", "/api/admin/customers/123/account", "customers.manage"],
  ["GET", "/api/admin/suppliers", "suppliers.view"],
  ["POST", "/api/admin/purchases", "purchases.create"],
  ["POST", "/api/admin/expenses", "expenses.create"],
  ["GET", "/api/admin/cash-sessions", "cash_session.open"],
  ["POST", "/api/admin/cash-sessions/open", "cash_session.open"],
  ["POST", "/api/admin/cash-sessions/123/close", "cash_session.close"],
  ["GET", "/api/admin/reports/summary", "reports.view"],
  ["GET", "/api/admin/reports/export", "reports.export"],
  ["GET", "/api/admin/audit", "audit.view"],
  ["POST", "/api/admin/sales/123/refund", "sales.refund"],
  ["GET", "/api/admin/sales", "sales.view"],
  ["GET", "/api/admin/orders", "sales.view"],
  ["POST", "/api/admin/orders/123/status", "orders.manage"],
  ["POST", "/api/admin/orders/123/cash-payment", "orders.manage"],
  ["POST", "/api/admin/approvals", "approvals.grant"],
  ["POST", "/api/admin/terminals/123/revoke", "devices.manage"],
];

for (const [method, url, permission] of allowed) {
  assert.equal(permissionForAdminRoute({ method, url }), permission, `${method} ${url}`);
}

const denied: Array<[string, string]> = [
  ["GET", "/api/admin/unknown"],
  ["PUT", "/api/admin/products/123"],
  ["DELETE", "/api/admin/customers/123"],
  ["POST", "/api/admin/reports/export"],
  ["GET", "/api/admin/sales/123/refund"],
  ["DELETE", "/api/admin/users/123/status"],
  ["PATCH", "/api/admin/approvals/123"],
];

for (const [method, url] of denied) {
  assert.equal(permissionForAdminRoute({ method, url }), null, `${method} ${url}`);
}

assert.equal(
  permissionForAdminRoute({ method: "GET", url: "/api/admin/dashboard?range=30d" }),
  "dashboard.view",
);

process.stdout.write(`admin permission policy tests passed (${allowed.length} allowed cases)\n`);

const publicAdminRoutes = new Set([
  "GET /api/admin/auth/csrf",
  "POST /api/admin/auth/request-password-reset",
  "POST /api/admin/auth/reset-password",
  "POST /api/admin/auth/login",
  "POST /api/admin/auth/mfa",
  "GET /api/admin/auth/setup/:token",
  "POST /api/admin/users/setup",
]);
for (const route of ROUTE_POLICY) {
  if (!route.includes("/api/admin/") || publicAdminRoutes.has(route)) continue;
  const split = route.indexOf(" ");
  assert.notEqual(
    permissionForAdminRoute({ method: route.slice(0, split), url: route.slice(split + 1) }),
    null,
    `unmapped staff endpoint: ${route}`,
  );
}
