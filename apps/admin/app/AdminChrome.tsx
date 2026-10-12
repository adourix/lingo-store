"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";
const items = [
  ["dashboard", "Dashboard", "dashboard.view"],
  ["sales", "Sales", "sales.view"],
  ["orders", "Customer orders", "orders.manage"],
  ["products", "Products", "products.view"],
  ["categories", "Categories", "categories.manage"],
  ["inventory", "Inventory", "inventory.view"],
  ["purchases", "Purchases", "purchases.view"],
  ["customers", "Customers", "customers.view"],
  ["suppliers", "Suppliers", "suppliers.view"],
  ["payments", "Payments", "payments.view"],
  ["expenses", "Expenses", "expenses.view"],
  ["cash-sessions", "Cash sessions", "cash_session.open"],
  ["terminals", "POS terminals", "devices.manage"],
  ["reports", "Reports", "reports.view"],
  ["audit", "Audit logs", "audit.view"],
  ["users", "Users", "users.view"],
  ["roles", "Roles & permissions", "roles.manage"],
  ["sessions", "Sessions", "admin.access"],
  ["settings", "Settings", "settings.manage"],
] as const;

function NavIcon({ name }: { name: string }) {
  const paths: Record<string, ReactNode> = {
    dashboard: <><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></>,
    products: <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/></>,
    categories: <><path d="M4 6h16M4 12h16M4 18h16"/><circle cx="8" cy="6" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="10" cy="18" r="1.5"/></>,
    inventory: <><path d="M4 7h16v13H4zM8 7V4h8v3M8 11h8M8 15h5"/></>,
    sales: <><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/></>,
    orders: <><path d="M5 6h14v14H5zM8 3v6M16 3v6M5 10h14"/></>,
    customers: <><circle cx="12" cy="8" r="3"/><path d="M5 20c.7-3.2 3-5 7-5s6.3 1.8 7 5"/></>,
    suppliers: <><path d="M4 6h16v13H4zM8 6V3h8v3M8 10h8M8 14h5"/></>,
    payments: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/></>,
    expenses: <><path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5"/></>,
    reports: <><path d="M5 19V9M12 19V5M19 19v-8"/><path d="M3 19h18"/></>,
    audit: <><circle cx="12" cy="12" r="8"/><path d="M12 8v5l3 2"/></>,
    users: <><circle cx="9" cy="8" r="3"/><path d="M3 20c.5-3.2 2.5-5 6-5s5.5 1.8 6 5M16 5.5a2.7 2.7 0 0 1 0 5.2M17 15c2.5.4 3.7 2 4 5"/></>,
    roles: <><path d="M7 4h10v16H7zM10 8h4M10 12h4M10 16h4"/></>,
    sessions: <><circle cx="12" cy="12" r="8"/><path d="M12 8v5l3 2"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="m19 15 1.5 1-2 3-1.7-.8a7.8 7.8 0 0 1-2.2 1.3L14.4 21h-4.8l-.2-2.5a7.8 7.8 0 0 1-2.2-1.3l-1.7.8-2-3L5 14a7.5 7.5 0 0 1 0-4L3.5 9l2-3 1.7.8a7.8 7.8 0 0 1 2.2-1.3L9.6 3h4.8l.2 2.5a7.8 7.8 0 0 1 2.2 1.3l1.7-.8 2 3L19 10a7.5 7.5 0 0 1 0 5Z"/></>,
  };
  return <svg className="admin-nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.dashboard}</svg>;
}

export default function AdminChrome({ children }: { children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const authPage = path === "/login" || path === "/mfa" || path === "/forgot-password" || path.startsWith("/setup/");
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (authPage) return;
    fetch(API + "/admin/auth/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((x) => {
        if (x) {
          setPermissions(new Set(x.permissions || []));
          setName(x.user?.name || x.user?.username || "");
        }
      })
      .catch(() => {});
  }, [authPage]);

  useEffect(() => setMobileOpen(false), [path]);

  const can = (permission: string) => permissions.has("admin.access") || permissions.has(permission);
  const visibleItems = useMemo(() => items.filter((item) => can(item[2])), [permissions]);

  async function logout() {
    const csrf = await fetch(API + "/admin/auth/csrf", { credentials: "include" }).then((r) => r.json());
    await fetch(API + "/admin/auth/logout", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json", "x-csrf-token": csrf.token },
      body: "{}",
    });
    location.href = "/login";
  }

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    const query = search.trim().toLowerCase();
    if (!query) return;
    const match = visibleItems.find((item) => item[1].toLowerCase().includes(query) || item[0].includes(query));
    if (match) {
      setSearch("");
      router.push("/" + match[0]);
    }
  }

  if (authPage) return <div className="admin-shell admin-auth-route">{children}</div>;

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <div className="admin-header-left">
          <button className="admin-mobile-menu" type="button" onClick={() => setMobileOpen((open) => !open)} aria-label="Toggle navigation" aria-expanded={mobileOpen}>☰</button>
          <a className="admin-header-brand" href="/" aria-label="Lingo Store admin home"><img src="/lingo-logo-admin.svg" alt="Lingo" /><span>Admin</span></a>
          <form className="admin-global-search" onSubmit={submitSearch} role="search">
            <span aria-hidden="true">⌕</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products, orders, customers…" aria-label="Search admin" />
            <kbd>⌘ K</kbd>
          </form>
        </div>
        <div className="admin-header-right">
          <a className="admin-icon-button" href="/audit" aria-label="Open audit log" title="Audit log">◷</a>
          <div className="admin-user-menu">
            <span className="admin-user-avatar" aria-hidden="true">{(name || "A").trim().charAt(0).toUpperCase()}</span>
            <span className="admin-user-copy"><strong>{name || "Administrator"}</strong><small>Administrator</small></span>
            <button className="admin-user-chevron" type="button" onClick={() => void logout()} aria-label="Sign out">⌄</button>
          </div>
        </div>
      </header>
      <div className="admin-layout">
        <aside className={`admin-sidebar${mobileOpen ? " is-open" : ""}`}>
          <a className="admin-sidebar-logo" href="/" aria-label="Lingo Admin home"><img src="/lingo-logo-admin.svg" alt="Lingo" /><span>Admin Panel</span></a>
          <nav className="admin-nav" aria-label="Admin navigation">
            <div className="admin-nav-section">Workspace</div>
            {visibleItems.slice(0, 12).map((item) => <a className="admin-nav-link" href={"/" + item[0]} aria-current={path === "/" + item[0] ? "page" : undefined} key={item[0]}><span className="admin-nav-icon"><NavIcon name={item[0]} /></span><span>{item[1]}</span></a>)}
            <div className="admin-nav-section">Insights & security</div>
            {visibleItems.slice(12).map((item) => <a className="admin-nav-link" href={"/" + item[0]} aria-current={path === "/" + item[0] ? "page" : undefined} key={item[0]}><span className="admin-nav-icon"><NavIcon name={item[0]} /></span><span>{item[1]}</span></a>)}
          </nav>
          <div className="admin-sidebar-footer"><div className="admin-sidebar-identity"><span className="admin-user-avatar">{(name || "A").trim().charAt(0).toUpperCase()}</span><div><strong>{name || "Administrator"}</strong><small>Administrator</small></div></div><button type="button" onClick={() => void logout()}><span>↪</span> Log out</button></div>
        </aside>
        {mobileOpen && <button className="admin-sidebar-backdrop" type="button" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
        <main className="admin-main">{children}</main>
      </div>
    </div>
  );
}
