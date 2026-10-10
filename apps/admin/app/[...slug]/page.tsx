"use client";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
const API = process.env.NEXT_PUBLIC_API_URL || "/api";
type Row = Record<string, unknown>;
const labels: Record<string, string> = {
  dashboard: "Dashboard",
  sales: "Sales",
  orders: "Customer orders",
  products: "Products",
  categories: "Categories",
  inventory: "Inventory",
  purchases: "Purchases",
  customers: "Customers",
  suppliers: "Suppliers",
  payments: "Payments",
  expenses: "Expenses",
  "cash-sessions": "Cash sessions",
  terminals: "Terminals",
  reports: "Reports",
  audit: "Audit",
  users: "Users",
  roles: "Roles",
  sessions: "Sessions",
  settings: "Settings",
};
const endpoints: Record<string, string> = {
  dashboard: "/admin/dashboard",
  sales: "/admin/sales",
  orders: "/admin/orders",
  products: "/admin/products",
  categories: "/admin/categories",
  inventory: "/admin/inventory",
  purchases: "/admin/purchases",
  customers: "/admin/customers",
  suppliers: "/admin/suppliers",
  payments: "/admin/payments",
  expenses: "/admin/expenses",
  "cash-sessions": "/admin/cash-sessions",
  terminals: "/admin/terminals",
  reports: "/admin/reports/summary",
  audit: "/admin/audit",
  users: "/admin/users",
  roles: "/admin/roles",
  sessions: "/admin/sessions",
  settings: "/admin/settings",
};
function display(v: unknown) {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
async function csrf() {
  return fetch(API + "/admin/auth/csrf", { credentials: "include" }).then((r) => r.json());
}
export default function Module() {
  const path = usePathname(),
    key = path.split("/")[1] || "dashboard";
  const [rows, setRows] = useState<Row[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [name, setName] = useState(""),
    [sku, setSku] = useState(""),
    [price, setPrice] = useState(""),
    [cost, setCost] = useState(""),
    [amount, setAmount] = useState(""),
    [phone, setPhone] = useState(""),
    [email, setEmail] = useState("");
  const endpoint = endpoints[key] || endpoints.dashboard;
  async function load() {
    setLoading(true);
    setError("");
    const r = await fetch(API + endpoint, { credentials: "include" });
    if (r.status === 401) {
      location.href = "/login";
      return;
    }
    const j = await r.json().catch(() => null);
    if (!r.ok) {
      setError(j?.error?.message || j?.error || "Unable to load this module.");
      setRows([]);
    } else {
      const list = Array.isArray(j) ? j : j && typeof j === "object" ? [j] : [];
      setRows(list as Row[]);
    }
    setLoading(false);
  }
  useEffect(() => {
    load().catch(() => {
      setError("Unable to load this module.");
      setLoading(false);
    });
  }, [endpoint]);
  const columns = useMemo(() => {
    if (key === "orders")
      return [
        "invoiceNo",
        "status",
        "paymentStatus",
        "totalMinor",
        "recipientName",
        "recipientPhone",
        "shippingAddress",
        "items",
      ];
    const set = new Set<string>();
    rows.slice(0, 20).forEach((r) => Object.keys(r).forEach((k) => set.add(k)));
    return [...set].slice(0, 8);
  }, [key, rows]);
  async function create(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    let body: Row = {};
    let target = endpoint;
    if (key === "products")
      body = { sku, name, priceMinor: Number(price), costMinor: cost ? Number(cost) : undefined };
    else if (key === "categories") body = { name, description: amount };
    else if (key === "customers") body = { name, phone: phone || null, email: email || null };
    else if (key === "suppliers") body = { name, phone: phone || null, email: email || null };
    else if (key === "expenses") body = { title: name, amountMinor: Number(amount) };
    else return;
    const ct = await csrf();
    const r = await fetch(API + target, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json", "x-csrf-token": ct.token },
      body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setError(j.error?.message || j.error || "Create failed.");
      return;
    }
    setSuccess("Saved.");
    setName("");
    setSku("");
    setPrice("");
    setCost("");
    setAmount("");
    setPhone("");
    setEmail("");
    await load();
  }
  async function exportCsv() {
    const ct = await csrf();
    const r = await fetch(API + "/admin/reports/export", {
      credentials: "include",
      headers: { "x-csrf-token": ct.token },
    });
    if (!r.ok) {
      setError("Export requires a recent step-up authentication.");
      return;
    }
    const blob = await r.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "sales-export.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }
  async function stepUp(): Promise<string> {
    const token = await csrf();
    const password = window.prompt("Current admin password to confirm this order action:");
    const otp = window.prompt("Current authenticator code:");
    if (!password || !otp) throw new Error("Step-up authentication is required.");
    const response = await fetch(API + "/admin/auth/step-up", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json", "x-csrf-token": token },
      body: JSON.stringify({ password, otp }),
    });
    const data: unknown = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error("Step-up authentication failed.");
    return data && typeof data === "object" && "csrfToken" in data ? String(data.csrfToken) : token;
  }
  async function updateOrder(row: Row, status: string) {
    setError("");
    try {
      const id = String(row.id);
      const reason = status === "CANCELLED" ? window.prompt("Cancellation reason:") : undefined;
      if (status === "CANCELLED" && !reason?.trim()) return;
      const token = await stepUp();
      const response = await fetch(API + "/admin/orders/" + encodeURIComponent(id) + "/status", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json", "x-csrf-token": token },
        body: JSON.stringify({ status, ...(reason ? { reason } : {}) }),
      });
      const data: unknown = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error("Order status update failed.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Order status update failed.");
    }
  }
  async function receiveCash(row: Row) {
    setError("");
    try {
      const idempotencyKey = crypto.randomUUID();
      const token = await stepUp();
      const response = await fetch(
        API + "/admin/orders/" + encodeURIComponent(String(row.id)) + "/cash-payment",
        {
          method: "POST",
          credentials: "include",
          headers: {
            "content-type": "application/json",
            "x-csrf-token": token,
            "idempotency-key": idempotencyKey,
          },
          body: JSON.stringify({ idempotencyKey, amountMinor: String(row.totalMinor) }),
        },
      );
      const data: unknown = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error("Cash collection failed.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Cash collection failed.");
    }
  }
  const canCreate = ["products", "categories", "customers", "suppliers", "expenses"].includes(key);
  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          alignItems: "center",
          marginBottom: 22,
        }}
      >
        <div>
          <p className="admin-muted" style={{ margin: 0 }}>
            Lingo Store / Admin
          </p>
          <h1 style={{ margin: "6px 0" }}>{labels[key] || "Dashboard"}</h1>
        </div>
        {key === "reports" && (
          <button className="admin-button" onClick={exportCsv}>
            Export CSV
          </button>
        )}
      </div>
      {error && (
        <p className="admin-error" role="alert">
          {error}
        </p>
      )}
      {success && <p className="admin-success">{success}</p>}
      {canCreate && (
        <form className="admin-card admin-form" onSubmit={create} style={{ marginBottom: 18 }}>
          {key === "products" && (
            <>
              <label>
                SKU
                <input value={sku} onChange={(e) => setSku(e.target.value)} required />
              </label>
              <label>
                Name
                <input value={name} onChange={(e) => setName(e.target.value)} required />
              </label>
              <label>
                Price minor units
                <input
                  type="number"
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  required
                />
              </label>
              <label>
                Cost minor units
                <input
                  type="number"
                  min="0"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                />
              </label>
            </>
          )}
          {key === "categories" && (
            <>
              <label>
                Name
                <input value={name} onChange={(e) => setName(e.target.value)} required />
              </label>
              <label>
                Description
                <input value={amount} onChange={(e) => setAmount(e.target.value)} />
              </label>
            </>
          )}
          {(key === "customers" || key === "suppliers") && (
            <>
              <label>
                Name
                <input value={name} onChange={(e) => setName(e.target.value)} required />
              </label>
              <label>
                Phone
                <input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </label>
              <label>
                Email
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>
            </>
          )}
          {key === "expenses" && (
            <>
              <label>
                Title
                <input value={name} onChange={(e) => setName(e.target.value)} required />
              </label>
              <label>
                Amount minor units
                <input
                  type="number"
                  min="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </label>
            </>
          )}
          <div style={{ alignSelf: "end" }}>
            <button className="admin-button">Add</button>
          </div>
        </form>
      )}
      {loading ? (
        <div className="admin-card">
          <p>Loading…</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="admin-card">
          <h2>No records</h2>
          <p className="admin-muted">There is nothing to display for this module yet.</p>
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="admin-table">
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c}>{c}</th>
                ))}
                {key === "orders" && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={String(row.id || row.key || i)}>
                  {columns.map((c) => (
                    <td key={c}>
                      {c.toLowerCase().includes("minor")
                        ? display(row[c]) + " minor"
                        : display(row[c])}
                    </td>
                  ))}
                  {key === "orders" && (
                    <td className="admin-actions">
                      {row.status === "PENDING" && (
                        <button
                          className="admin-button secondary"
                          onClick={() => updateOrder(row, "CONFIRMED")}
                        >
                          Confirm
                        </button>
                      )}
                      {row.status === "CONFIRMED" && (
                        <button
                          className="admin-button secondary"
                          onClick={() => updateOrder(row, "PROCESSING")}
                        >
                          Start processing
                        </button>
                      )}
                      {row.status === "PROCESSING" && (
                        <button
                          className="admin-button secondary"
                          onClick={() => updateOrder(row, "READY")}
                        >
                          Mark ready
                        </button>
                      )}
                      {row.status === "READY" && row.paymentStatus === "UNPAID" && (
                        <button className="admin-button" onClick={() => receiveCash(row)}>
                          Receive cash and complete
                        </button>
                      )}
                      {["PENDING", "CONFIRMED", "PROCESSING", "READY"].includes(
                        String(row.status),
                      ) && (
                        <button
                          className="admin-button danger"
                          onClick={() => updateOrder(row, "CANCELLED")}
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
