"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const API = "/api";

const labels: Record<string, string> = {
  users: "Users", roles: "Roles", products: "Products", categories: "Categories",
  inventory: "Inventory", sales: "Sales", purchases: "Purchases", customers: "Customers",
  suppliers: "Suppliers", payments: "Payments", expenses: "Expenses",
  "cash-sessions": "Cash Sessions", terminals: "Terminals", reports: "Reports",
  audit: "Audit", settings: "Settings", sessions: "Sessions",
};

async function get(path: string) {
  const response = await fetch(API + path, { credentials: "include" });
  return response.ok ? response.json() : null;
}

export default function Module() {
  const path = usePathname();
  const key = path.split("/")[1] || "dashboard";
  const [data, setData] = useState<unknown>(null);

  useEffect(() => {
    const map: Record<string, string> = {
      products: "/admin/products", categories: "/admin/categories",
      customers: "/admin/customers", suppliers: "/admin/suppliers",
      expenses: "/admin/expenses", terminals: "/admin/terminals",
      reports: "/admin/reports/summary", audit: "/admin/audit",
    };
    if (map[key]) get(map[key]).then(setData);
  }, [key]);

  return (
    <main dir="rtl" style={{ fontFamily: "system-ui", padding: 32 }}>
      <nav style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
        <a href="/dashboard">Dashboard</a>
        {Object.keys(labels).map((item) => (
          <a key={item} href={"/" + item}>{labels[item]}</a>
        ))}
      </nav>
      <h1>{labels[key] || "Dashboard"}</h1>
      {data ? (
        <pre style={{ whiteSpace: "pre-wrap", background: "#f4f4f4", padding: 20, borderRadius: 12 }}>
          {JSON.stringify(data, null, 2)}
        </pre>
      ) : (
        <section>
          <p>Module is ready for the API-backed workflow.</p>
          <p>Actions are permission-gated server-side. Use the module-specific API from this surface.</p>
        </section>
      )}
    </main>
  );
}
