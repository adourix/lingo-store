"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

type Dashboard = {
  salesMinor: number | string;
  invoices: number;
  products: number;
  customers: number;
  expensesMinor: number | string;
  profitMinor?: number | string;
};

const money = (x: number | string | undefined) =>
  x === undefined ? "—" : `${(Number(x) / 100).toFixed(2)} EGP`;

const shortcuts = [
  ["Products", "Catalog, pricing and stock", "/products", "View catalog"],
  ["Customer orders", "Review and process web orders", "/orders", "Open orders"],
  ["Inventory", "Stock movements and adjustments", "/inventory", "View inventory"],
  ["Sales", "Invoices and transactions", "/sales", "View sales"],
  ["Customers", "Customer accounts and balances", "/customers", "View customers"],
  ["Reports", "Sales, purchases and expenses", "/reports", "Open reports"],
];

export default function Dashboard() {
  const [d, setD] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(API + "/admin/dashboard", { credentials: "include", cache: "no-store" })
      .then(async (r) => {
        if (r.status === 401) {
          location.href = "/login";
          return;
        }
        const j = await r.json();
        if (!r.ok) throw new Error(j.error?.message || j.error || "Unable to load dashboard.");
        setD(j);
      })
      .catch((e) => setError(e.message || "Unable to load dashboard."));
  }, []);

  return (
    <div className="admin-page dashboard-page">
      <div className="admin-breadcrumbs">Workspace / Overview</div>
      <div className="admin-toolbar">
        <div>
          <p className="admin-muted">Store operations</p>
          <h1>Dashboard</h1>
        </div>
        <div className="admin-actions">
          <Link className="admin-button secondary" href="/reports">Reports</Link>
          <Link className="admin-button" href="/sales">View sales</Link>
        </div>
      </div>

      {error && <p className="admin-error" role="alert">{error}</p>}
      {!d && !error && <div className="admin-card admin-loading"><span className="admin-loading-bar"/><span className="admin-loading-bar short"/><span className="admin-loading-grid"/></div>}

      {d && (
        <>
          <section className="admin-grid dashboard-kpis" aria-label="Operational summary">
            <article className="admin-card admin-kpi"><span className="admin-kpi-icon">↗</span><div><p className="admin-kpi-label">Total sales</p><strong>{money(d.salesMinor)}</strong><small>Recorded sales value</small></div></article>
            <article className="admin-card admin-kpi"><span className="admin-kpi-icon">#</span><div><p className="admin-kpi-label">Invoices</p><strong>{d.invoices}</strong><small>Recorded invoices</small></div></article>
            <article className="admin-card admin-kpi"><span className="admin-kpi-icon">□</span><div><p className="admin-kpi-label">Active products</p><strong>{d.products}</strong><small>Products in the catalog</small></div></article>
            <article className="admin-card admin-kpi"><span className="admin-kpi-icon">○</span><div><p className="admin-kpi-label">Customers</p><strong>{d.customers}</strong><small>Customer accounts</small></div></article>
            <article className="admin-card admin-kpi"><span className="admin-kpi-icon">−</span><div><p className="admin-kpi-label">Expenses</p><strong>{money(d.expensesMinor)}</strong><small>Recorded expenses</small></div></article>
            <article className="admin-card admin-kpi"><span className="admin-kpi-icon">=</span><div><p className="admin-kpi-label">Profit</p><strong>{money(d.profitMinor)}</strong><small>Calculated from available data</small></div></article>
          </section>

          <section className="admin-card dashboard-shortcuts">
            <div className="admin-section-heading">
              <div><p className="admin-muted">Common tasks</p><h2>Quick access</h2></div>
              <span className="admin-muted dashboard-section-note">Use the sidebar for the full workspace.</span>
            </div>
            <div className="dashboard-shortcut-list">
              {shortcuts.map(([title, description, href, action]) => (
                <Link className="dashboard-shortcut" href={href} key={href}>
                  <span className="dashboard-shortcut-mark" aria-hidden="true">→</span>
                  <span className="dashboard-shortcut-copy"><strong>{title}</strong><small>{description}</small></span>
                  <span className="dashboard-shortcut-action">{action}</span>
                </Link>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
