"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import AdminResourcePage from "../AdminResourcePage";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";
type Row = Record<string, unknown>;
type JsonObject = Record<string, unknown>;

const labels: Record<string, string> = {
  dashboard: "Dashboard", sales: "Sales", orders: "Customer orders", products: "Products", categories: "Categories", inventory: "Inventory", purchases: "Purchases", customers: "Customers", suppliers: "Suppliers", payments: "Payments", expenses: "Expenses", "cash-sessions": "Cash sessions", terminals: "Terminals", reports: "Reports", audit: "Audit logs", users: "Users", roles: "Roles & permissions", sessions: "Sessions", settings: "Settings",
};

const endpoints: Record<string, string> = {
  dashboard: "/admin/dashboard", sales: "/admin/sales", orders: "/admin/orders", products: "/admin/products", categories: "/admin/categories", inventory: "/admin/inventory", purchases: "/admin/purchases", customers: "/admin/customers", suppliers: "/admin/suppliers", payments: "/admin/payments", expenses: "/admin/expenses", "cash-sessions": "/admin/cash-sessions", terminals: "/admin/terminals", reports: "/admin/reports/summary", audit: "/admin/audit", users: "/admin/users", roles: "/admin/roles", sessions: "/admin/sessions", settings: "/admin/settings",
};

const columns: Record<string, string[]> = {
  sales: ["invoiceNo", "status", "subtotalMinor", "discountMinor", "totalMinor", "createdAt"],
  orders: ["invoiceNo", "status", "paymentStatus", "totalMinor", "recipientName", "recipientPhone", "createdAt"],
  inventory: ["product", "quantity", "type", "referenceId", "note", "createdAt"],
  purchases: ["invoiceNo", "subtotalMinor", "totalMinor", "createdAt"],
  payments: ["amountMinor", "method", "createdAt"],
  expenses: ["title", "amountMinor", "category", "createdAt"],
  "cash-sessions": ["status", "openingMinor", "closingMinor", "openedAt", "closedAt"],
  audit: ["action", "entity", "entityId", "outcome", "createdAt"],
  sessions: ["kind", "state", "createdAt", "lastSeenAt", "expiresAt", "terminalId"],
  settings: ["key", "value", "updatedAt"],
  roles: ["name", "permissions"],
  users: ["username", "name", "status", "isActive", "mfaEnabled", "createdAt"],
  terminals: ["name", "isActive", "lastSeenAt", "createdAt"],
  customers: ["name", "phone", "email", "balanceMinor", "createdAt"],
  suppliers: ["name", "phone", "email", "balanceMinor", "createdAt"],
};

const fieldNames: Record<string, string> = {
  invoiceNo: "Invoice", paymentStatus: "Payment", subtotalMinor: "Subtotal", discountMinor: "Discount", totalMinor: "Total", recipientName: "Customer", recipientPhone: "Phone", createdAt: "Created", updatedAt: "Updated", openedAt: "Opened", closedAt: "Closed", lastSeenAt: "Last seen", expiresAt: "Expires", terminalId: "Terminal", referenceId: "Reference", amountMinor: "Amount", openingMinor: "Opening", closingMinor: "Closing", mfaEnabled: "MFA", isActive: "Active", entityId: "Entity ID", sku: "SKU", balanceMinor: "Balance",
};

function humanize(field: string): string {
  return fieldNames[field] || field.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
}

function display(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") {
    const row = value as Row;
    if (typeof row.name === "string" && row.name.trim()) return row.name;
    if (typeof row.sku === "string" && row.sku.trim()) return row.sku;
    if (Array.isArray(value)) return value.join(", ");
    return JSON.stringify(value);
  }
  return String(value);
}

function moneyMinor(value: unknown): string {
  const n = Number(value);
  return Number.isFinite(n) ? `${(n / 100).toFixed(2)} EGP` : "—";
}

function formatCell(field: string, value: unknown): string {
  if (field.toLowerCase().includes("minor")) return moneyMinor(value);
  if (["createdAt", "updatedAt", "openedAt", "closedAt", "lastSeenAt", "expiresAt"].includes(field)) {
    const date = new Date(String(value));
    return Number.isNaN(date.getTime()) ? display(value) : date.toLocaleString();
  }
  return display(value);
}

function errorText(value: unknown, fallback: string): string {
  if (!value || typeof value !== "object") return fallback;
  const error = (value as JsonObject).error;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && typeof (error as JsonObject).message === "string") return String((error as JsonObject).message);
  return fallback;
}

async function getCsrf(): Promise<string> {
  const response = await fetch(API + "/admin/auth/csrf", { credentials: "include" });
  const body: unknown = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(errorText(body, "CSRF unavailable."));
  return body && typeof body === "object" ? String((body as JsonObject).token || "") : "";
}

export default function Module() {
  const path = usePathname();
  const key = path.split("/")[1] || "dashboard";
  if (key === "terminals") return <AdminResourcePage slug="terminals" />;

  const endpoint = endpoints[key] || endpoints.dashboard;
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true); setError("");
    try {
      const response = await fetch(API + endpoint, { credentials: "include", cache: "no-store" });
      if (response.status === 401) { location.href = "/login"; return; }
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(errorText(body, "Unable to load this module."));
      const list = Array.isArray(body) ? body : body && typeof body === "object" ? [body] : [];
      setRows(list as Row[]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load this module.");
      setRows([]);
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(); setQuery(""); }, [endpoint]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => JSON.stringify(row).toLowerCase().includes(q));
  }, [rows, query]);

  const activeColumns = columns[key] || (() => {
    const set = new Set<string>();
    rows.slice(0, 30).forEach((row) => Object.keys(row).forEach((field) => set.add(field)));
    return [...set].slice(0, 8);
  })();

  async function create(event: FormEvent) {
    event.preventDefault();
    setSaving(true); setError(""); setSuccess("");
    try {
      let body: Row;
      if (key === "customers" || key === "suppliers") body = { name: name.trim(), phone: phone.trim() || null, email: email.trim() || null };
      else if (key === "expenses") {
        const numeric = Number(amount);
        if (!Number.isFinite(numeric) || numeric < 0) throw new Error("Enter a valid amount.");
        body = { title: name.trim(), amountMinor: Math.round(numeric * 100), category: category.trim() || undefined };
      } else return;
      const token = await getCsrf();
      const response = await fetch(API + endpoint, { method: "POST", credentials: "include", headers: { "content-type": "application/json", "x-csrf-token": token }, body: JSON.stringify(body) });
      const result: unknown = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(errorText(result, "Save failed."));
      setName(""); setPhone(""); setEmail(""); setAmount(""); setCategory(""); setSuccess("Saved successfully."); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Save failed."); }
    finally { setSaving(false); }
  }

  async function deleteCustomer(row: Row) {
    const id = String(row.id || "");
    if (!id || !window.confirm(`Delete customer “${String(row.name || "")}"? Customers with sales or payment history cannot be deleted.`)) return;
    setBusyId(id); setError(""); setSuccess("");
    try {
      const token = await getCsrf();
      const response = await fetch(API + "/admin/customers/" + encodeURIComponent(id), { method: "DELETE", credentials: "include", headers: { "content-type": "application/json", "x-csrf-token": token }, body: "{}" });
      const result: unknown = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(errorText(result, "Customer deletion failed."));
      setSuccess("Customer deleted."); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Customer deletion failed."); }
    finally { setBusyId(null); }
  }

  async function stepUp(): Promise<string> {
    const csrfToken = await getCsrf();
    const password = window.prompt("Current admin password to confirm this action:");
    const otp = window.prompt("Current authenticator code:");
    if (!password || !otp) throw new Error("Step-up authentication is required.");
    const response = await fetch(API + "/admin/auth/step-up", { method: "POST", credentials: "include", headers: { "content-type": "application/json", "x-csrf-token": csrfToken }, body: JSON.stringify({ password, otp }) });
    const body: unknown = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(errorText(body, "Step-up authentication failed."));
    return body && typeof body === "object" && typeof (body as JsonObject).csrfToken === "string" ? String((body as JsonObject).csrfToken) : csrfToken;
  }

  async function updateOrder(row: Row, status: string) {
    const id = String(row.id || "");
    if (!id) return;
    setBusyId(id); setError(""); setSuccess("");
    try {
      const reason = status === "CANCELLED" ? window.prompt("Cancellation reason:") : undefined;
      if (status === "CANCELLED" && !reason?.trim()) return;
      const token = await stepUp();
      const response = await fetch(API + "/admin/orders/" + encodeURIComponent(id) + "/status", { method: "POST", credentials: "include", headers: { "content-type": "application/json", "x-csrf-token": token }, body: JSON.stringify({ status, ...(reason ? { reason: reason.trim() } : {}) }) });
      const body: unknown = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(errorText(body, `Order status update failed (${response.status}).`));
      setSuccess(`Order updated to ${status}.`); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Order status update failed."); }
    finally { setBusyId(null); }
  }

  async function receiveCash(row: Row) {
    const id = String(row.id || "");
    if (!id) return;
    setBusyId(id); setError(""); setSuccess("");
    try {
      const token = await stepUp();
      const idempotencyKey = crypto.randomUUID();
      const response = await fetch(API + "/admin/orders/" + encodeURIComponent(id) + "/cash-payment", { method: "POST", credentials: "include", headers: { "content-type": "application/json", "x-csrf-token": token, "idempotency-key": idempotencyKey }, body: JSON.stringify({ idempotencyKey, amountMinor: String(row.totalMinor) }) });
      const body: unknown = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(errorText(body, `Cash collection failed (${response.status}).`));
      setSuccess("Cash received and order completed."); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Cash collection failed."); }
    finally { setBusyId(null); }
  }

  async function exportCsv() {
    setError("");
    try {
      const token = await getCsrf();
      const response = await fetch(API + "/admin/reports/export", { credentials: "include", headers: { "x-csrf-token": token } });
      if (!response.ok) throw new Error("Export requires recent step-up authentication.");
      const blob = await response.blob(); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "sales-export.csv"; a.click(); URL.revokeObjectURL(url);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Export failed."); }
  }

  const canCreate = key === "customers" || key === "suppliers" || key === "expenses";
  const title = labels[key] || "Admin";
  const description: Record<string, string> = { sales: "Review completed sales and invoices.", orders: "Manage customer orders from the storefront.", inventory: "Track stock movements and inventory history.", purchases: "Review supplier purchases and costs.", customers: "Manage customer accounts and balances.", suppliers: "Manage supplier records and balances.", payments: "Review recorded payments.", expenses: "Record and review business expenses.", "cash-sessions": "Review till sessions and cash movements.", audit: "Review security and operational activity.", users: "Manage staff accounts and account state.", roles: "Review roles and their permissions.", sessions: "Review active and historical sessions.", settings: "Review application settings.", reports: "Review operational reporting data." };

  return (
    <div className="admin-page admin-module-page">
      <div className="admin-breadcrumbs">Admin / {title}</div>
      <div className="admin-toolbar">
        <div><p className="admin-muted">{description[key] || "Back-office workspace"}</p><h1>{title}</h1></div>
        <div className="admin-actions">{key === "reports" && <button className="admin-button secondary" onClick={() => void exportCsv()}>Export CSV</button>}<button className="admin-button secondary" onClick={() => void load()}>Refresh</button></div>
      </div>

      {error && <p className="admin-error" role="alert">{error}</p>}
      {success && <p className="admin-success" role="status">{success}</p>}

      {canCreate && <form className="admin-card admin-create-panel" onSubmit={create}>
        <div className="admin-section-heading"><div><p className="admin-muted">New record</p><h2>Add {key === "expenses" ? "expense" : key.slice(0, -1)}</h2></div></div>
        <div className="admin-form-grid">
          <label>Name<input value={name} onChange={(e) => setName(e.target.value)} required /></label>
          {(key === "customers" || key === "suppliers") && <><label>Phone<input value={phone} onChange={(e) => setPhone(e.target.value)} /></label><label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label></>}
          {key === "expenses" && <><label>Amount (EGP)<input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required /></label><label>Category<input value={category} onChange={(e) => setCategory(e.target.value)} /></label></>}
        </div>
        <div className="admin-form-actions"><button className="admin-button" disabled={saving}>{saving ? "Saving…" : "Add record"}</button></div>
      </form>}

      {loading ? <div className="admin-card admin-loading"><span className="admin-loading-bar"/><span className="admin-loading-bar short"/><span className="admin-loading-grid"/></div> : rows.length === 0 ? <div className="admin-card admin-empty"><h2>No records yet</h2><p>There is no data available for this module.</p>{canCreate && <p className="admin-muted">Use the form above to create the first record.</p>}</div> : (
        <section className="admin-card admin-data-panel">
          <div className="admin-data-toolbar">
            <div><strong>{filteredRows.length}</strong><span className="admin-muted"> records</span></div>
            <label className="admin-table-search"><span aria-hidden="true">⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${title.toLowerCase()}…`} aria-label={`Search ${title}`} /></label>
          </div>
          <div className="admin-table-wrap"><table className="admin-table"><thead><tr>{activeColumns.map((field) => <th key={field}>{humanize(field)}</th>)}{(key === "customers" || key === "orders") && <th>Actions</th>}</tr></thead><tbody>
            {filteredRows.map((row, index) => {
              const rowId = String(row.id || row.invoiceNo || index);
              return <tr key={rowId}>{activeColumns.map((field) => <td key={field}>{field === "status" || field === "paymentStatus" || field === "outcome" ? <span className={`admin-status ${String(row[field]).toLowerCase().includes("cancel") || String(row[field]).toLowerCase().includes("fail") ? "danger" : String(row[field]).toLowerCase().includes("pending") || String(row[field]).toLowerCase().includes("open") ? "warning" : ""}`}>{display(row[field])}</span> : <span className={field === "invoiceNo" || field === "name" ? "admin-cell-primary" : ""}>{formatCell(field, row[field])}</span>}</td>)}
                {key === "customers" && <td><button className="admin-button danger" type="button" disabled={busyId === rowId} onClick={() => void deleteCustomer(row)}>{busyId === rowId ? "Deleting…" : "Delete"}</button></td>}
                {key === "orders" && <td><div className="admin-actions admin-table-actions">{row.status === "PENDING" && <button className="admin-button secondary" disabled={busyId === rowId} onClick={() => void updateOrder(row, "CONFIRMED")}>Confirm</button>}{row.status === "CONFIRMED" && <button className="admin-button secondary" disabled={busyId === rowId} onClick={() => void updateOrder(row, "PROCESSING")}>Process</button>}{row.status === "PROCESSING" && <button className="admin-button secondary" disabled={busyId === rowId} onClick={() => void updateOrder(row, "SHIPPED")}>Ship</button>}{row.status === "SHIPPED" && <button className="admin-button secondary" disabled={busyId === rowId} onClick={() => void updateOrder(row, "DELIVERED")}>Deliver</button>}{row.status !== "CANCELLED" && row.status !== "DELIVERED" && <button className="admin-button danger" disabled={busyId === rowId} onClick={() => void updateOrder(row, "CANCELLED")}>Cancel</button>}{row.paymentStatus === "PENDING" && <button className="admin-button" disabled={busyId === rowId} onClick={() => void receiveCash(row)}>Collect cash</button>}</div></td>}
              </tr>;
            })}
          </tbody></table></div>
          {filteredRows.length === 0 && <div className="admin-empty admin-empty-inline"><h3>No matching records</h3><p>Try a different search term.</p></div>}
        </section>
      )}
    </div>
  );
}
