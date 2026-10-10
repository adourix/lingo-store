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
  x === undefined ? "—" : (Number(x) / 100).toFixed(2) + " EGP";
export default function Dashboard() {
  const [d, setD] = useState<Dashboard | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    fetch(API + "/admin/dashboard", { credentials: "include" })
      .then(async (r) => {
        if (r.status === 401) {
          location.href = "/login";
          return;
        }
        const j = await r.json();
        if (!r.ok) throw new Error(j.error?.message || j.error);
        setD(j);
      })
      .catch((e) => setError(e.message || "Unable to load dashboard."));
  }, []);
  return (
    <div>
      <div className="admin-breadcrumbs">Workspace / Dashboard</div>
      <div className="admin-toolbar">
        <div>
          <p className="admin-muted">Operational overview</p>
          <h1>Dashboard</h1>
        </div>
        <div className="admin-actions">
          <Link className="admin-button secondary" href="/reports">
            View reports
          </Link>
          <Link className="admin-button" href="/sales">
            View sales
          </Link>
        </div>
      </div>
      {error && <p className="admin-error">{error}</p>}
      {d && (
        <>
          <div className="admin-grid">
            {[
              ["Total sales", money(d.salesMinor)],
              ["Invoices", String(d.invoices)],
              ["Active products", String(d.products)],
              ["Customers", String(d.customers)],
              ["Expenses", money(d.expensesMinor)],
              ["Profit", money(d.profitMinor)],
            ].map(([label, value]) => (
              <article className="admin-card" key={label}>
                <p className="admin-kpi-label">{label}</p>
                <strong>{value}</strong>
              </article>
            ))}
          </div>
          <section className="admin-card" style={{ marginTop: 18 }}>
            <div className="admin-toolbar">
              <div>
                <p className="admin-muted">Store operations</p>
                <h2>Quick access</h2>
              </div>
            </div>
            <div className="admin-grid">
              {[
                ["Products", "Manage catalog and pricing", "/products"],
                ["Inventory", "Review stock and adjustments", "/inventory"],
                ["Sales", "Invoices and transactions", "/sales"],
                ["Customers", "Customer ledger", "/customers"],
                ["Cash sessions", "Open and close tills", "/cash-sessions"],
                ["Reports", "Performance and profit", "/reports"],
              ].map(([title, description, href]) => (
                <Link className="admin-card" href={href} key={href}>
                  <strong>{title}</strong>
                  <p className="admin-muted">{description}</p>
                  <span className="admin-button secondary">Open →</span>
                </Link>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
