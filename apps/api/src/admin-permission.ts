export type AdminRoute = { method: string; url: string };

/** Every staff route needs an explicit permission. Unmapped routes fail closed. */
export function permissionForAdminRoute(route: AdminRoute): string | null {
  const path = route.url.split("?")[0];
  const method = route.method.toUpperCase();

  if (path === "/api/admin/dashboard") return "dashboard.view";
  if (path === "/api/admin/auth/me" || path === "/api/admin/auth/step-up") return "admin.access";
  if (path === "/api/admin/users/assignable-roles") return "users.assign_role";
  if (path === "/api/admin/users/invitations" && method === "GET") return "users.create";
  if (/^\/api\/admin\/users\/invitations\/[^/]+\/(?:revoke|resend)$/.test(path) && method === "POST") return "users.create";
  if (path === "/api/admin/users" && method === "GET") return "users.view";
  if (path === "/api/admin/users/invite" && method === "POST") return "users.create";
  if (/^\/api\/admin\/users\/[^/]+\/status$/.test(path) && method === "PATCH") return "users.disable";
  if (/^\/api\/admin\/users\/[^/]+\/role$/.test(path) && method === "PATCH") return "users.assign_role";
  if (/^\/api\/admin\/users\/[^/]+\/reset-mfa$/.test(path) && method === "POST") return "users.reset_mfa";
  if (path.startsWith("/api/admin/roles")) return "roles.manage";

  if (path === "/api/admin/products") {
    if (method === "GET") return "products.view";
    if (method === "POST") return "products.create";
  }
  if (/^\/api\/admin\/products\/[^/]+$/.test(path)) {
    if (method === "GET") return "products.view";
    if (method === "PATCH") return "products.update";
    if (method === "DELETE") return "products.delete";
    return null;
  }
  if (path.startsWith("/api/admin/categories")) return "categories.manage";
  if (path.startsWith("/api/admin/customer-payments") || path.startsWith("/api/admin/supplier-payments") || path.startsWith("/api/admin/payments")) {
    if (method === "GET") return "payments.view";
    if (method === "POST") return "payments.create";
    return null;
  }
  if (path.startsWith("/api/admin/inventory")) {
    if (method === "GET") return "inventory.view";
    if (method === "POST") return "inventory.adjust";
    return null;
  }
  if (path.startsWith("/api/admin/customers")) {
    if (method === "GET") return "customers.view";
    if (method === "POST" || method === "PATCH") return "customers.manage";
    return null;
  }
  if (path.startsWith("/api/admin/suppliers")) {
    if (method === "GET") return "suppliers.view";
    if (method === "POST" || method === "PATCH") return "suppliers.manage";
    return null;
  }
  if (path.startsWith("/api/admin/purchases")) {
    if (method === "GET") return "purchases.view";
    if (method === "POST") return "purchases.create";
    return null;
  }
  if (path.startsWith("/api/admin/expenses")) {
    if (method === "GET") return "expenses.view";
    if (method === "POST") return "expenses.create";
    return null;
  }
  if (path.startsWith("/api/admin/cash-sessions")) {
    if (method === "GET") return "cash_session.open";
    if (method === "POST") return path.endsWith("/close") ? "cash_session.close" : "cash_session.open";
    return null;
  }
  if (path.startsWith("/api/admin/terminals")) return "devices.manage";
  if (path === "/api/admin/reports/export" && method === "GET") return "reports.export";
  if (path.startsWith("/api/admin/reports") && method === "GET") return "reports.view";
  if (path.startsWith("/api/admin/audit") && method === "GET") return "audit.view";
  if (path.startsWith("/api/admin/settings")) return "settings.manage";
  if (path.startsWith("/api/admin/sales")) {
    if (path.includes("/refund") && method === "POST") return "sales.refund";
    if (method === "GET") return "sales.view";
    if (method === "POST") return "sales.create";
    return null;
  }
  if (path.startsWith("/api/admin/approvals") && method === "POST") return "approvals.grant";
  return null;
}
