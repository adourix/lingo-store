"use client";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import AdminResourcePage from "../AdminResourcePage";
const API = process.env.NEXT_PUBLIC_API_URL || "/api";
type Row = Record<string, unknown>;
type JsonObject = Record<string, unknown>;
const labels: Record<string, string> = {
  dashboard: "Dashboard", sales: "Sales", orders: "Customer orders", products: "Products", categories: "Categories", inventory: "Inventory", purchases: "Purchases", customers: "Customers", suppliers: "Suppliers", payments: "Payments", expenses: "Expenses", "cash-sessions": "Cash sessions", terminals: "Terminals", reports: "Reports", audit: "Audit", users: "Users", roles: "Roles", sessions: "Sessions", settings: "Settings",
};
const endpoints: Record<string, string> = {
  dashboard: "/admin/dashboard", sales: "/admin/sales", orders: "/admin/orders", products: "/admin/products", categories: "/admin/categories", inventory: "/admin/inventory", purchases: "/admin/purchases", customers: "/admin/customers", suppliers: "/admin/suppliers", payments: "/admin/payments", expenses: "/admin/expenses", "cash-sessions": "/admin/cash-sessions", terminals: "/admin/terminals", reports: "/admin/reports/summary", audit: "/admin/audit", users: "/admin/users", roles: "/admin/roles", sessions: "/admin/sessions", settings: "/admin/settings",
};
function display(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "object") {
    const row = v as Row;
    if (typeof row.name === "string" && row.name.trim()) return row.name;
    if (typeof row.sku === "string" && row.sku.trim()) return row.sku;
    return "—";
  }
  return String(v);
}
function moneyMinor(v: unknown): string {
  const n = Number(v);
  return Number.isFinite(n) ? `${(n / 100).toFixed(2)} EGP` : "—";
}
function errorText(j: unknown, fallback: string): string {
  if (!j || typeof j !== "object") return fallback;
  const data = j as JsonObject;
  const error = data.error;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const message = (error as JsonObject).message;
    if (typeof message === "string") return message;
  }
  return fallback;
}
async function csrf(): Promise<JsonObject> {
  const response = await fetch(API + "/admin/auth/csrf", { credentials: "include" });
  const data: unknown = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(errorText(data, "CSRF unavailable."));
  return data && typeof data === "object" ? data as JsonObject : {};
}
export default function Module() {
  const path = usePathname(), key = path.split("/")[1] || "dashboard";
  const [rows, setRows] = useState<Row[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState(""), [success, setSuccess] = useState(""), [name, setName] = useState(""), [sku, setSku] = useState(""), [price, setPrice] = useState(""), [cost, setCost] = useState(""), [amount, setAmount] = useState(""), [phone, setPhone] = useState(""), [email, setEmail] = useState(""), [deletingId, setDeletingId] = useState<string | null>(null);
  const endpoint = endpoints[key] || endpoints.dashboard;
  async function load() {
    setLoading(true); setError("");
    const r = await fetch(API + endpoint, { credentials: "include", cache: "no-store" });
    if (r.status === 401) { location.href = "/login"; return; }
    const j: unknown = await r.json().catch(() => null);
    if (!r.ok) { setError(errorText(j, "Unable to load this module.")); setRows([]); } else { const list = Array.isArray(j) ? j : j && typeof j === "object" ? [j] : []; setRows(list as Row[]); }
    setLoading(false);
  }
  useEffect(() => { void load().catch(() => { setError("Unable to load this module."); setLoading(false); }); }, [endpoint]);
  const columns = useMemo(() => {
    if (key === "orders") return ["invoiceNo", "status", "paymentStatus", "totalMinor", "recipientName", "recipientPhone", "shippingAddress", "items"];
    if (key === "inventory") return ["id", "product", "quantity", "type", "referenceId", "note", "createdAt"];
    const set = new Set<string>(); rows.slice(0, 20).forEach((r) => Object.keys(r).forEach((k) => set.add(k)));
    return [...set].slice(0, 8);
  }, [key, rows]);
  async function create(e: FormEvent) {
    e.preventDefault(); setError(""); setSuccess("");
    let body: Row = {};
    if (key === "products") body = { sku, name, priceMinor: Number(price), costMinor: cost ? Number(cost) : undefined };
    else if (key === "categories") body = { name, description: amount };
    else if (key === "customers" || key === "suppliers") body = { name, phone: phone || null, email: email || null };
    else if (key === "expenses") body = { title: name, amountMinor: Number(amount) };
    else return;
    const ct = await csrf();
    const token = typeof ct.token === "string" ? ct.token : "";
    const r = await fetch(API + endpoint, { method: "POST", credentials: "include", headers: { "content-type": "application/json", "x-csrf-token": token }, body: JSON.stringify(body) });
    const j: unknown = await r.json().catch(() => ({}));
    if (!r.ok) { setError(errorText(j, "Create failed.")); return; }
    setSuccess("Saved."); setName(""); setSku(""); setPrice(""); setCost(""); setAmount(""); setPhone(""); setEmail(""); await load();
  }
  async function deleteCategory(row: Row) {
    const id = String(row.id || "");
    if (!id || !window.confirm(`Delete category “${String(row.name || "")}"? Products will become uncategorized.`)) return;
    setDeletingId(id); setError(""); setSuccess("");
    try {
      const ct = await csrf();
      const token = typeof ct.token === "string" ? ct.token : "";
      const r = await fetch(API + "/admin/categories/" + encodeURIComponent(id), { method: "DELETE", credentials: "include", headers: { "content-type": "application/json", "x-csrf-token": token }, body: "{}" });
      const j: unknown = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(errorText(j, "Category deletion failed."));
      setSuccess("Category deleted."); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Category deletion failed."); }
    finally { setDeletingId(null); }
  }
  async function deleteCustomer(row: Row) {
    const id = String(row.id || "");
    if (!id || !window.confirm(`Delete customer “${String(row.name || "")}"? Customers with sales or payment history cannot be deleted.`)) return;
    setDeletingId(id); setError(""); setSuccess("");
    try {
      const ct = await csrf();
      const token = typeof ct.token === "string" ? ct.token : "";
      const r = await fetch(API + "/admin/customers/" + encodeURIComponent(id), { method: "DELETE", credentials: "include", headers: { "content-type": "application/json", "x-csrf-token": token }, body: "{}" });
      const j: unknown = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(errorText(j, "Customer deletion failed."));
      setSuccess("Customer deleted."); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Customer deletion failed."); }
    finally { setDeletingId(null); }
  }
  async function exportCsv() {
    const ct = await csrf();
    const token = typeof ct.token === "string" ? ct.token : "";
    const r = await fetch(API + "/admin/reports/export", { credentials: "include", headers: { "x-csrf-token": token } });
    if (!r.ok) { setError("Export requires a recent step-up authentication."); return; }
    const blob = await r.blob(), a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "sales-export.csv"; a.click(); URL.revokeObjectURL(a.href);
  }
  async function stepUp(): Promise<string> {
    const token = await csrf(), password = window.prompt("Current admin password to confirm this order action:"), otp = window.prompt("Current authenticator code:");
    const csrfToken = typeof token.token === "string" ? token.token : "";
    if (!password || !otp) throw new Error("Step-up authentication is required.");
    const response = await fetch(API + "/admin/auth/step-up", { method: "POST", credentials: "include", headers: { "content-type": "application/json", "x-csrf-token": csrfToken }, body: JSON.stringify({ password, otp }) });
    const data: unknown = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(errorText(data, "Step-up authentication failed."));
    if (data && typeof data === "object" && typeof (data as JsonObject).csrfToken === "string") return String((data as JsonObject).csrfToken);
    return csrfToken;
  }
  async function updateOrder(row: Row, status: string) {
    setError(""); setSuccess("");
    try {
      const id = String(row.id), reason = status === "CANCELLED" ? window.prompt("Cancellation reason:") : undefined;
      if (status === "CANCELLED" && !reason?.trim()) return;
      const token = await stepUp();
      const response = await fetch(API + "/admin/orders/" + encodeURIComponent(id) + "/status", { method: "POST", credentials: "include", headers: { "content-type": "application/json", "x-csrf-token": token }, body: JSON.stringify({ status, ...(reason ? { reason: reason.trim() } : {}) }) });
      const data: unknown = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(errorText(data, `Order status update failed (${response.status}).`));
      setSuccess(`Order updated to ${status}.`);
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Order status update failed."); }
  }
  async function receiveCash(row: Row) {
    setError(""); setSuccess("");
    try {
      const idempotencyKey = crypto.randomUUID(), token = await stepUp(), response = await fetch(API + "/admin/orders/" + encodeURIComponent(String(row.id)) + "/cash-payment", { method: "POST", credentials: "include", headers: { "content-type": "application/json", "x-csrf-token": token, "idempotency-key": idempotencyKey }, body: JSON.stringify({ idempotencyKey, amountMinor: String(row.totalMinor) }) });
      const data: unknown = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(errorText(data, `Cash collection failed (${response.status}).`));
      setSuccess("Cash received and order completed.");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Cash collection failed."); }
  }
  if (key === "terminals") return <AdminResourcePage slug="terminals" />;
  const canCreate = ["products", "categories", "customers", "suppliers", "expenses"].includes(key);
  return (
    <div>
      <div className="admin-toolbar"><div><p className="admin-muted" style={{ margin: 0 }}>Lingo Store / Admin</p><h1 style={{ margin: "6px 0" }}>{labels[key] || "Dashboard"}</h1></div>{key === "reports" && <button className="admin-button" onClick={exportCsv}>Export CSV</button>}</div>
      {error && <p className="admin-error" role="alert">{error}</p>}{success && <p className="admin-success">{success}</p>}
      {canCreate && <form className="admin-card admin-form" onSubmit={create} style={{ marginBottom: 18 }}>
        {key === "products" && <><label>SKU<input value={sku} onChange={(e) => setSku(e.target.value)} required /></label><label>Name<input value={name} onChange={(e) => setName(e.target.value)} required /></label><label>Price minor units<input type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} required /></label><label>Cost minor units<input type="number" min="0" value={cost} onChange={(e) => setCost(e.target.value)} /></label></>}
        {key === "categories" && <><label>Name<input value={name} onChange={(e) => setName(e.target.value)} required /></label><label>Description<input value={amount} onChange={(e) => setAmount(e.target.value)} /></label></>}
        {(key === "customers" || key === "suppliers") && <><label>Name<input value={name} onChange={(e) => setName(e.target.value)} required /></label><label>Phone<input value={phone} onChange={(e) => setPhone(e.target.value)} /></label><label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label></>}
        {key === "expenses" && <><label>Title<input value={name} onChange={(e) => setName(e.target.value)} required /></label><label>Amount minor units<input type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} required /></label></>}
        <div style={{ alignSelf: "end" }}><button className="admin-button">Add</button></div>
      </form>}
      {loading ? <div className="admin-card"><p>Loading…</p></div> : rows.length === 0 ? <div className="admin-card"><h2>No records</h2><p className="admin-muted">There is nothing to display for this module yet.</p></div> : <div className="admin-card admin-table-wrap"><table className="admin-table"><thead><tr>{columns.map((c) => <th key={c}>{c === "product" ? "Product" : c === "productId" ? "Product ID" : c}</th>)}{(key === "categories" || key === "customers") && <th>Actions</th>}{key === "orders" && <th>Actions</th>}</tr></thead><tbody>{rows.map((row, i) => <tr key={String(row.id || row.key || i)}>{columns.map((c) => <td key={c}>{c === "product" ? <><strong>{display(row.product)}</strong>{row.product && typeof row.product === "object" && "sku" in row.product ? <span className="admin-muted" style={{ display: "block", fontSize: 12 }}>SKU {String((row.product as Row).sku)}</span> : null}</> : c.toLowerCase().includes("minor") || c === "amount" ? moneyMinor(row[c]) : display(row[c])}</td>)}{key === "categories" && <td className="admin-actions"><button type="button" className="admin-button danger" disabled={deletingId === String(row.id)} onClick={() => void deleteCategory(row)}>{deletingId === String(row.id) ? "Deleting…" : "Delete"}</button></td>}{key === "customers" && <td className="admin-actions"><button type="button" className="admin-button danger" disabled={deletingId === String(row.id)} onClick={() => void deleteCustomer(row)}>{deletingId === String(row.id) ? "Deleting…" : "Delete"}</button></td>}{key === "orders" && <td className="admin-actions">{row.status === "PENDING" && <button className="admin-button secondary" onClick={() => void updateOrder(row, "CONFIRMED")}>Confirm</button>}{row.status === "CONFIRMED" && <button className="admin-button secondary" onClick={() => void updateOrder(row, "PROCESSING")}>Start processing</button>}{row.status === "PROCESSING" && <button className="admin-button secondary" onClick={() => void updateOrder(row, "READY")}>Mark ready</button>}{row.status === "READY" && row.paymentStatus === "UNPAID" && <button className="admin-button" onClick={() => void receiveCash(row)}>Receive cash and complete</button>}{["PENDING", "CONFIRMED", "PROCESSING", "READY"].includes(String(row.status)) && <button className="admin-button danger" onClick={() => void updateOrder(row, "CANCELLED")}>Cancel</button>}</td>}</tr>)}</tbody></table></div>}
    </div>
  );
}
