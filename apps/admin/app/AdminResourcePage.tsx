"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

type Row = Record<string, unknown>;
type Resource = {
  title: string;
  endpoint: string;
  permission: string;
  columns: string[];
  create?: { fields: string[]; endpoint?: string };
};

const resources: Record<string, Resource> = {
  products: { title: "Products", endpoint: "/admin/products", permission: "products.view", columns: ["sku","name","priceMinor","stock","version"], create: { fields: ["sku","name","priceMinor","costMinor","stock","minStock"] } },
  categories: { title: "Categories", endpoint: "/admin/categories", permission: "categories.manage", columns: ["name","description"], create: { fields: ["name","description"] } },
  customers: { title: "Customers", endpoint: "/admin/customers", permission: "customers.view", columns: ["name","phone","email","balanceMinor"], create: { fields: ["name","phone","email","address"] } },
  suppliers: { title: "Suppliers", endpoint: "/admin/suppliers", permission: "suppliers.view", columns: ["name","phone","email","balanceMinor"], create: { fields: ["name","phone","email","address"] } },
  sales: { title: "Sales", endpoint: "/admin/sales", permission: "sales.view", columns: ["invoiceNo","status","subtotalMinor","discountMinor","totalMinor","createdAt"] },
  purchases: { title: "Purchases", endpoint: "/admin/purchases", permission: "purchases.view", columns: ["invoiceNo","subtotalMinor","totalMinor","createdAt"] },
  payments: { title: "Payments", endpoint: "/admin/payments", permission: "payments.view", columns: ["amountMinor","method","createdAt"] },
  expenses: { title: "Expenses", endpoint: "/admin/expenses", permission: "expenses.view", columns: ["title","amountMinor","category","createdAt"], create: { fields: ["title","amountMinor","category","note"] } },
  "cash-sessions": { title: "Cash sessions", endpoint: "/admin/cash-sessions", permission: "cash_session.open", columns: ["status","openingMinor","closingMinor","openedAt","closedAt"] },
  inventory: { title: "Inventory ledger", endpoint: "/admin/inventory", permission: "inventory.view", columns: ["productId","quantity","type","note","createdAt"] },
  audit: { title: "Audit log", endpoint: "/admin/audit", permission: "audit.view", columns: ["action","entity","entityId","outcome","createdAt"] },
  sessions: { title: "Sessions", endpoint: "/admin/sessions", permission: "admin.access", columns: ["kind","state","createdAt","lastSeenAt","expiresAt","terminalId"] },
  settings: { title: "Settings", endpoint: "/admin/settings", permission: "settings.manage", columns: ["key","value","updatedAt"] },
  roles: { title: "Roles", endpoint: "/admin/roles", permission: "roles.manage", columns: ["name","permissions"] },
  reports: { title: "Reports", endpoint: "/admin/reports/summary", permission: "reports.view", columns: ["salesMinor","invoices","purchasesMinor","expensesMinor","profitMinor"] },
  terminals: { title: "POS terminals", endpoint: "/admin/terminals", permission: "terminals.manage", columns: ["name","isActive","lastSeenAt","createdAt"] },
};

function asRows(value: unknown): Row[] {
  if (Array.isArray(value)) return value.filter((x): x is Row => Boolean(x) && typeof x === "object");
  if (value && typeof value === "object") return [value as Row];
  return [];
}
function display(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
function money(value: unknown): string {
  const n = Number(value);
  return Number.isFinite(n) ? (n / 100).toFixed(2) + " EGP" : "—";
}
async function csrf(): Promise<string> {
  const r = await fetch(API + "/admin/auth/csrf", { credentials: "include" });
  if (!r.ok) throw new Error("CSRF unavailable");
  return String((await r.json()).token || "");
}

export default function AdminResourcePage({ slug }: { slug: string }) {
  const resource = resources[slug];
  const [rows, setRows] = useState<Row[]>([]);
  const [form, setForm] = useState<Row>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [denied, setDenied] = useState(false);
  const [enrollment, setEnrollment] = useState<Row | null>(null);

  const load = async () => {
    if (!resource) return;
    setLoading(true); setError(""); setDenied(false);
    try {
      const r = await fetch(API + resource.endpoint, { credentials: "include", cache: "no-store" });
      if (r.status === 401) { location.href = "/login"; return; }
      if (r.status === 403) { setDenied(true); return; }
      if (!r.ok) throw new Error("Request failed");
      setRows(asRows(await r.json()));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load data");
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [slug]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!resource?.create) return;
    setSaving(true); setError("");
    try {
      const token = await csrf();
      const endpoint = resource.create.endpoint || resource.endpoint;
      const r = await fetch(API + endpoint, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json", "x-csrf-token": token },
        body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error(display((await r.json().catch(() => ({}))).error) || "Save failed");
      setForm({}); await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally { setSaving(false); }
  };

  const terminalEnroll = async () => {
    try {
      const token = await csrf();
      const password = window.prompt("Current admin password (step-up):");
      const otp = window.prompt("Current authenticator code:");
      if (!password || !otp) return;
      const step = await fetch(API + "/admin/auth/step-up", {
        method: "POST", credentials: "include",
        headers: { "content-type": "application/json", "x-csrf-token": token },
        body: JSON.stringify({ password, otp }),
      });
      if (!step.ok) throw new Error("Step-up failed");
      const stepBody = await step.json();
      const r = await fetch(API + "/admin/terminals/enroll", {
        method: "POST", credentials: "include",
        headers: { "content-type": "application/json", "x-csrf-token": stepBody.csrfToken || token },
        body: "{}",
      });
      if (!r.ok) throw new Error("Unable to create enrollment code");
      setEnrollment(await r.json());
    } catch (e) { setError(e instanceof Error ? e.message : "Enrollment failed"); }
  };

  const revoke = async (id: string) => {
    try {
      const token = await csrf();
      const r = await fetch(API + "/admin/terminals/" + encodeURIComponent(id) + "/revoke", {
        method: "POST", credentials: "include",
        headers: { "content-type": "application/json", "x-csrf-token": token },
        body: "{}",
      });
      if (!r.ok) throw new Error("Revoke failed");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Revoke failed"); }
  };

  if (!resource) return <section className="admin-card"><h1>Not found</h1><p className="admin-muted">This admin module does not exist.</p></section>;
  if (denied) return <section className="admin-card"><h1>Access denied</h1><p className="admin-muted">Your current permissions do not allow this module.</p></section>;

  return <section>
    <header style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
      <div><p className="admin-muted">Lingo Store</p><h1>{resource.title}</h1></div>
      {slug === "terminals" && <button className="admin-button" onClick={terminalEnroll}>Register terminal</button>}
    </header>

    {enrollment && <article className="admin-card" style={{ marginBlock: 16 }}>
      <h2>Terminal enrollment code</h2>
      <p><strong>{display(enrollment.enrollmentCode)}</strong></p>
      <p className="admin-muted">Expires: {display(enrollment.expiresAt)}. Enter this once on the POS terminal at <code>/enroll</code>.</p>
    </article>}

    {resource.create && <form className="admin-card admin-form" onSubmit={submit} style={{ marginBlock: 16 }}>
      {resource.create.fields.map(field => <label key={field}>{field}
        <input
          value={display(form[field]) === "—" ? "" : display(form[field])}
          onChange={e => setForm(x => ({ ...x, [field]: field.toLowerCase().includes("minor") || field === "stock" || field === "minStock" ? e.target.value : e.target.value }))}
          required={field === "name" || field === "title" || field === "sku"}
        />
      </label>)}
      <div><button className="admin-button" disabled={saving}>{saving ? "Saving…" : "Save"}</button></div>
    </form>}

    {error && <p className="admin-error" role="alert">{error}</p>}
    {loading ? <section className="admin-card"><p>Loading…</p></section> :
      rows.length === 0 ? <section className="admin-card"><h2>No records</h2><p className="admin-muted">There is no data to display yet.</p></section> :
      slug === "reports" ? <div className="admin-grid">{rows[0] && Object.entries(rows[0]).map(([k,v]) => <article className="admin-card" key={k}><p className="admin-muted">{k}</p><strong>{k.toLowerCase().includes("minor") ? money(v) : display(v)}</strong></article>)}</div> :
      <div style={{ overflowX: "auto" }}><table className="admin-table"><thead><tr>{resource.columns.map(c => <th key={c}>{c}</th>)}{slug === "terminals" && <th>Actions</th>}</tr></thead><tbody>
        {rows.map((row, i) => <tr key={String(row.id || row.invoiceNo || i)}>{resource.columns.map(c => <td key={c}>{c.toLowerCase().includes("minor") ? money(row[c]) : display(row[c])}</td>)}{slug === "terminals" && <td>{row.isActive === true && <button className="admin-button secondary" onClick={() => revoke(String(row.id))}>Revoke</button>}</td>}</tr>)}
      </tbody></table></div>}
  </section>;
}
