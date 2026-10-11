"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

type Row = Record<string, unknown>;
type Category = { id: string; name: string; description?: string | null };

type Resource = {
  title: string;
  endpoint: string;
  permission: string;
  columns: string[];
};

const resources: Record<string, Resource> = {
  products: { title: "Products", endpoint: "/admin/products", permission: "products.view", columns: ["sku", "name", "priceMinor", "stock", "minStock"] },
  categories: { title: "Categories", endpoint: "/admin/categories", permission: "categories.manage", columns: ["name", "description"] },
  customers: { title: "Customers", endpoint: "/admin/customers", permission: "customers.view", columns: ["name", "phone", "email", "balanceMinor"] },
  suppliers: { title: "Suppliers", endpoint: "/admin/suppliers", permission: "suppliers.view", columns: ["name", "phone", "email", "balanceMinor"] },
  sales: { title: "Sales", endpoint: "/admin/sales", permission: "sales.view", columns: ["invoiceNo", "status", "subtotalMinor", "discountMinor", "totalMinor", "createdAt"] },
  purchases: { title: "Purchases", endpoint: "/admin/purchases", permission: "purchases.view", columns: ["invoiceNo", "subtotalMinor", "totalMinor", "createdAt"] },
  payments: { title: "Payments", endpoint: "/admin/payments", permission: "payments.view", columns: ["amountMinor", "method", "createdAt"] },
  expenses: { title: "Expenses", endpoint: "/admin/expenses", permission: "expenses.view", columns: ["title", "amountMinor", "category", "createdAt"] },
  "cash-sessions": { title: "Cash sessions", endpoint: "/admin/cash-sessions", permission: "cash_session.open", columns: ["status", "openingMinor", "closingMinor", "openedAt", "closedAt"] },
  inventory: { title: "Inventory ledger", endpoint: "/admin/inventory", permission: "inventory.view", columns: ["productId", "quantity", "type", "note", "createdAt"] },
  audit: { title: "Audit log", endpoint: "/admin/audit", permission: "audit.view", columns: ["action", "entity", "entityId", "outcome", "createdAt"] },
  sessions: { title: "Sessions", endpoint: "/admin/sessions", permission: "admin.access", columns: ["kind", "state", "createdAt", "lastSeenAt", "expiresAt", "terminalId"] },
  settings: { title: "Settings", endpoint: "/admin/settings", permission: "settings.manage", columns: ["key", "value", "updatedAt"] },
  roles: { title: "Roles", endpoint: "/admin/roles", permission: "roles.manage", columns: ["name", "permissions"] },
  reports: { title: "Reports", endpoint: "/admin/reports/summary", permission: "reports.view", columns: ["salesMinor", "invoices", "purchasesMinor", "expensesMinor", "profitMinor"] },
  terminals: { title: "POS terminals", endpoint: "/admin/terminals", permission: "devices.manage", columns: ["name", "isActive", "lastSeenAt", "createdAt"] },
};

function asRows(value: unknown): Row[] {
  if (Array.isArray(value)) return value.filter((x): x is Row => Boolean(x) && typeof x === "object");
  if (value && typeof value === "object") return [value as Row];
  return [];
}

function display(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function money(value: unknown): string {
  const n = Number(value);
  return Number.isFinite(n) ? `${(n / 100).toFixed(2)} EGP` : "—";
}

function errorMessage(value: unknown, fallback: string): string {
  if (value && typeof value === "object" && "error" in value) return String(value.error) || fallback;
  return fallback;
}

async function csrf(): Promise<string> {
  const response = await fetch(`${API}/admin/auth/csrf`, { credentials: "include" });
  if (!response.ok) throw new Error("CSRF unavailable");
  return String((await response.json()).token || "");
}

function fieldLabel(field: string): string {
  const labels: Record<string, string> = {
    sku: "SKU",
    name: "Name",
    description: "Description",
    priceMinor: "Selling price",
    costMinor: "Cost price",
    stock: "Stock quantity",
    minStock: "Minimum stock",
    barcode: "Barcode",
    categoryId: "Category",
    phone: "Phone",
    email: "Email",
    address: "Address",
    title: "Title",
    amountMinor: "Amount",
    category: "Category",
    note: "Note",
  };
  return labels[field] || field;
}

function moneyFieldToMinor(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.round(n * 100);
}

function quantityValue(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return n;
}

export default function AdminResourcePage({ slug }: { slug: string }) {
  const resource = resources[slug];
  const [rows, setRows] = useState<Row[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState<Row>({});
  const [editForm, setEditForm] = useState<Row>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [denied, setDenied] = useState(false);
  const [search, setSearch] = useState("");
  const [enrollment, setEnrollment] = useState<Row | null>(null);

  const load = async () => {
    if (!resource) return;
    setLoading(true);
    setError("");
    setDenied(false);
    try {
      const response = await fetch(API + resource.endpoint, { credentials: "include", cache: "no-store" });
      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (response.status === 403) {
        setDenied(true);
        return;
      }
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(errorMessage(body, "Unable to load data"));
      setRows(asRows(body));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load data");
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    if (slug !== "products") return;
    try {
      const response = await fetch(`${API}/admin/categories`, { credentials: "include", cache: "no-store" });
      if (response.ok) {
        const body = await response.json();
        setCategories(asRows(body).map((row) => ({ id: String(row.id), name: String(row.name), description: row.description as string | null | undefined })));
      }
    } catch {
      // Product creation still works without a category.
    }
  };

  useEffect(() => {
    void load();
    void loadCategories();
    setSearch("");
    setEditingId(null);
    setForm({});
    setEditForm({});
  }, [slug]);

  const submitSimple = async (event: FormEvent) => {
    event.preventDefault();
    if (!resource) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const token = await csrf();
      let body: Row = {};
      if (slug === "categories") body = { name: String(form.name || "").trim(), description: String(form.description || "").trim() || undefined };
      else if (slug === "customers" || slug === "suppliers") body = { name: String(form.name || "").trim(), phone: String(form.phone || "").trim() || null, email: String(form.email || "").trim() || null, address: String(form.address || "").trim() || null };
      else if (slug === "expenses") body = { title: String(form.title || "").trim(), amountMinor: moneyFieldToMinor(String(form.amountMinor || "")), category: String(form.category || "").trim() || undefined, note: String(form.note || "").trim() || undefined };
      else return;
      const response = await fetch(API + resource.endpoint, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json", "x-csrf-token": token },
        body: JSON.stringify(body),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(errorMessage(result, "Save failed"));
      setForm({});
      setSuccess(`${resource.title.replace(/s$/, "")} saved.`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const submitProduct = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const priceMinor = moneyFieldToMinor(String(form.price || ""));
      const costMinor = moneyFieldToMinor(String(form.cost || ""));
      const stock = quantityValue(String(form.stock || ""));
      const minStock = quantityValue(String(form.minStock || ""));
      if (priceMinor === undefined) throw new Error("Selling price is required and must be valid.");
      if (costMinor === undefined) throw new Error("Cost price is required and must be valid.");
      if (stock === undefined) throw new Error("Stock quantity is required and must be valid.");
      if (minStock === undefined) throw new Error("Minimum stock is required and must be valid.");
      const token = await csrf();
      const body = {
        sku: String(form.sku || "").trim(),
        name: String(form.name || "").trim(),
        description: String(form.description || "").trim() || undefined,
        priceMinor,
        costMinor,
        stock,
        minStock,
        barcode: String(form.barcode || "").trim() || undefined,
        categoryId: String(form.categoryId || "").trim() || undefined,
      };
      const response = await fetch(API + "/admin/products", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json", "x-csrf-token": token },
        body: JSON.stringify(body),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(errorMessage(result, "Product save failed"));
      setForm({});
      setSuccess("Product saved.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Product save failed");
    } finally {
      setSaving(false);
    }
  };

  const beginProductEdit = (row: Row) => {
    setEditingId(String(row.id));
    setEditForm({
      name: String(row.name || ""),
      description: String(row.description || ""),
      price: Number(row.priceMinor || 0) / 100,
      cost: Number(row.costMinor || 0) / 100,
      minStock: String(row.minStock ?? "0"),
      barcode: String(row.barcode || ""),
      categoryId: String(row.categoryId || ""),
      version: row.version,
    });
    setError("");
    setSuccess("");
  };

  const saveProduct = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingId) return;
    setSaving(true);
    setError("");
    try {
      const priceMinor = moneyFieldToMinor(String(editForm.price || ""));
      const costMinor = moneyFieldToMinor(String(editForm.cost || ""));
      const minStock = quantityValue(String(editForm.minStock || ""));
      if (priceMinor === undefined || costMinor === undefined || minStock === undefined) throw new Error("Enter valid price, cost and minimum stock values.");
      const token = await csrf();
      const body = {
        name: String(editForm.name || "").trim(),
        description: String(editForm.description || "").trim() || undefined,
        priceMinor,
        costMinor,
        minStock,
        barcode: String(editForm.barcode || "").trim() || undefined,
        categoryId: String(editForm.categoryId || "").trim() || undefined,
        version: Number(editForm.version),
      };
      const response = await fetch(`${API}/admin/products/${encodeURIComponent(editingId)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json", "x-csrf-token": token },
        body: JSON.stringify(body),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(errorMessage(result, response.status === 409 ? "Product changed by another user. Reload and try again." : "Update failed"));
      setEditingId(null);
      setEditForm({});
      setSuccess("Product updated.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const archiveProduct = async (id: string) => {
    if (!window.confirm("Archive this product? It will disappear from the active catalog.")) return;
    setError("");
    try {
      const token = await csrf();
      const response = await fetch(`${API}/admin/products/${encodeURIComponent(id)}`, { method: "DELETE", credentials: "include", headers: { "content-type": "application/json", "x-csrf-token": token }, body: "{}" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(errorMessage(result, "Archive failed"));
      setEditingId(null);
      setSuccess("Product archived.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Archive failed");
    }
  };

  const beginCategoryEdit = (row: Row) => {
    setEditingId(String(row.id));
    setEditForm({ name: String(row.name || ""), description: String(row.description || "") });
    setError("");
    setSuccess("");
  };

  const saveCategory = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingId) return;
    setSaving(true);
    setError("");
    try {
      const token = await csrf();
      const response = await fetch(`${API}/admin/categories/${encodeURIComponent(editingId)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json", "x-csrf-token": token },
        body: JSON.stringify({ name: String(editForm.name || "").trim(), description: String(editForm.description || "").trim() || undefined }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(errorMessage(result, "Category update failed"));
      setEditingId(null);
      setEditForm({});
      setSuccess("Category updated.");
      await load();
      await loadCategories();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Category update failed");
    } finally {
      setSaving(false);
    }
  };

  const deleteCategory = async (id: string) => {
    if (!window.confirm("Delete this category? Products will keep their data but become uncategorized.")) return;
    setError("");
    try {
      const token = await csrf();
      const response = await fetch(`${API}/admin/categories/${encodeURIComponent(id)}`, { method: "DELETE", credentials: "include", headers: { "content-type": "application/json", "x-csrf-token": token }, body: "{}" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(errorMessage(result, "Category delete failed"));
      setEditingId(null);
      setSuccess("Category deleted.");
      await load();
      await loadCategories();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Category delete failed");
    }
  };

  const terminalEnroll = async () => {
    try {
      const token = await csrf();
      const password = window.prompt("Current admin password (step-up):");
      const otp = window.prompt("Current authenticator code:");
      if (!password || !otp) return;
      const step = await fetch(API + "/admin/auth/step-up", { method: "POST", credentials: "include", headers: { "content-type": "application/json", "x-csrf-token": token }, body: JSON.stringify({ password, otp }) });
      const stepBody: unknown = await step.json().catch(() => ({}));
      if (!step.ok) throw new Error(errorMessage(stepBody, "Step-up failed"));
      const nextToken = stepBody && typeof stepBody === "object" && "csrfToken" in stepBody ? String(stepBody.csrfToken) : token;
      const response = await fetch(API + "/admin/terminals/enroll", { method: "POST", credentials: "include", headers: { "content-type": "application/json", "x-csrf-token": nextToken }, body: "{}" });
      const result: unknown = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(errorMessage(result, "Unable to create enrollment code"));
      setEnrollment(asRows(result)[0] || null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Enrollment failed");
    }
  };

  const revoke = async (id: string) => {
    if (!window.confirm("Revoke this terminal? It will no longer be usable.")) return;
    try {
      const token = await csrf();
      const response = await fetch(`${API}/admin/terminals/${encodeURIComponent(id)}/revoke`, { method: "POST", credentials: "include", headers: { "content-type": "application/json", "x-csrf-token": token }, body: "{}" });
      if (!response.ok) throw new Error("Revoke failed");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Revoke failed");
    }
  };

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) => Object.values(row).some((value) => display(value).toLowerCase().includes(query)));
  }, [rows, search]);

  const moneyColumns = new Set(["priceMinor", "costMinor", "balanceMinor", "subtotalMinor", "discountMinor", "totalMinor", "amountMinor", "openingMinor", "closingMinor", "salesMinor", "purchasesMinor", "expensesMinor", "profitMinor"]);

  if (!resource) return <section className="admin-card"><h1>Not found</h1><p className="admin-muted">This admin module does not exist.</p></section>;
  if (denied) return <section className="admin-card"><h1>Access denied</h1><p className="admin-muted">Your current permissions do not allow this module.</p></section>;

  const isCreatePage = ["products", "categories", "customers", "suppliers", "expenses"].includes(slug);

  return (
    <section>
      <header className="admin-toolbar">
        <div>
          <p className="admin-muted">Lingo Store / Admin</p>
          <h1>{resource.title}</h1>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button type="button" className="admin-button secondary" onClick={() => { void load(); if (slug === "products") void loadCategories(); }}>Refresh</button>
          {slug === "terminals" && <button className="admin-button" onClick={terminalEnroll}>Register terminal</button>}
        </div>
      </header>

      {enrollment && slug === "terminals" && (
        <article className="admin-card admin-notice">
          <h2>Terminal enrollment code</h2>
          <p className="admin-enrollment-code">{display(enrollment.enrollmentCode)}</p>
          <p className="admin-muted">Expires: {display(enrollment.expiresAt)}. Enter this once on the POS terminal at <code>/enroll</code>.</p>
        </article>
      )}

      {slug === "products" && isCreatePage && !editingId && (
        <form className="admin-card admin-form admin-create-form" onSubmit={submitProduct}>
          <h2>Add product</h2>
          <div className="admin-form-grid">
            <label>SKU<input value={String(form.sku || "")} onChange={(e) => setForm((x) => ({ ...x, sku: e.target.value }))} required /></label>
            <label>Name<input value={String(form.name || "")} onChange={(e) => setForm((x) => ({ ...x, name: e.target.value }))} required /></label>
            <label>Category<select value={String(form.categoryId || "")} onChange={(e) => setForm((x) => ({ ...x, categoryId: e.target.value }))}><option value="">Uncategorized</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
            <label>Selling price (EGP)<input type="number" min="0" step="0.01" value={String(form.price || "")} onChange={(e) => setForm((x) => ({ ...x, price: e.target.value }))} required /></label>
            <label>Cost price (EGP)<input type="number" min="0" step="0.01" value={String(form.cost || "")} onChange={(e) => setForm((x) => ({ ...x, cost: e.target.value }))} required /></label>
            <label>Stock quantity<input type="number" min="0" step="0.001" value={String(form.stock || "")} onChange={(e) => setForm((x) => ({ ...x, stock: e.target.value }))} required /></label>
            <label>Minimum stock<input type="number" min="0" step="0.001" value={String(form.minStock || "")} onChange={(e) => setForm((x) => ({ ...x, minStock: e.target.value }))} required /></label>
            <label>Barcode<input value={String(form.barcode || "")} onChange={(e) => setForm((x) => ({ ...x, barcode: e.target.value }))} /></label>
            <label className="admin-field-wide">Description<textarea value={String(form.description || "")} onChange={(e) => setForm((x) => ({ ...x, description: e.target.value }))} rows={3} /></label>
          </div>
          <button className="admin-button" disabled={saving}>{saving ? "Saving…" : "Add product"}</button>
        </form>
      )}

      {slug === "categories" && !editingId && (
        <form className="admin-card admin-form admin-create-form" onSubmit={submitSimple}>
          <h2>Add category</h2>
          <div className="admin-form-grid">
            <label>Name<input value={String(form.name || "")} onChange={(e) => setForm((x) => ({ ...x, name: e.target.value }))} required /></label>
            <label className="admin-field-wide">Description<textarea value={String(form.description || "")} onChange={(e) => setForm((x) => ({ ...x, description: e.target.value }))} rows={3} /></label>
          </div>
          <button className="admin-button" disabled={saving}>{saving ? "Saving…" : "Add category"}</button>
        </form>
      )}

      {(slug === "customers" || slug === "suppliers") && (
        <form className="admin-card admin-form admin-create-form" onSubmit={submitSimple}>
          <h2>Add {slug === "customers" ? "customer" : "supplier"}</h2>
          <div className="admin-form-grid">
            <label>Name<input value={String(form.name || "")} onChange={(e) => setForm((x) => ({ ...x, name: e.target.value }))} required /></label>
            <label>Phone<input value={String(form.phone || "")} onChange={(e) => setForm((x) => ({ ...x, phone: e.target.value }))} /></label>
            <label>Email<input type="email" value={String(form.email || "")} onChange={(e) => setForm((x) => ({ ...x, email: e.target.value }))} /></label>
            <label>Address<input value={String(form.address || "")} onChange={(e) => setForm((x) => ({ ...x, address: e.target.value }))} /></label>
          </div>
          <button className="admin-button" disabled={saving}>{saving ? "Saving…" : "Add"}</button>
        </form>
      )}

      {slug === "expenses" && (
        <form className="admin-card admin-form admin-create-form" onSubmit={submitSimple}>
          <h2>Add expense</h2>
          <div className="admin-form-grid">
            <label>Title<input value={String(form.title || "")} onChange={(e) => setForm((x) => ({ ...x, title: e.target.value }))} required /></label>
            <label>Amount (EGP)<input type="number" min="0.01" step="0.01" value={String(form.amountMinor || "")} onChange={(e) => setForm((x) => ({ ...x, amountMinor: e.target.value }))} required /></label>
            <label>Category<input value={String(form.category || "")} onChange={(e) => setForm((x) => ({ ...x, category: e.target.value }))} /></label>
            <label>Note<input value={String(form.note || "")} onChange={(e) => setForm((x) => ({ ...x, note: e.target.value }))} /></label>
          </div>
          <button className="admin-button" disabled={saving}>{saving ? "Saving…" : "Add expense"}</button>
        </form>
      )}

      {editingId && slug === "products" && (
        <form className="admin-card admin-form" onSubmit={saveProduct}>
          <h2>Edit product</h2>
          <div className="admin-form-grid">
            <label>Name<input value={String(editForm.name || "")} onChange={(e) => setEditForm((x) => ({ ...x, name: e.target.value }))} required /></label>
            <label>Category<select value={String(editForm.categoryId || "")} onChange={(e) => setEditForm((x) => ({ ...x, categoryId: e.target.value }))}><option value="">Uncategorized</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
            <label>Selling price (EGP)<input type="number" min="0" step="0.01" value={String(editForm.price ?? "")} onChange={(e) => setEditForm((x) => ({ ...x, price: e.target.value }))} required /></label>
            <label>Cost price (EGP)<input type="number" min="0" step="0.01" value={String(editForm.cost ?? "")} onChange={(e) => setEditForm((x) => ({ ...x, cost: e.target.value }))} required /></label>
            <label>Minimum stock<input type="number" min="0" step="0.001" value={String(editForm.minStock ?? "")} onChange={(e) => setEditForm((x) => ({ ...x, minStock: e.target.value }))} required /></label>
            <label>Barcode<input value={String(editForm.barcode || "")} onChange={(e) => setEditForm((x) => ({ ...x, barcode: e.target.value }))} /></label>
            <label className="admin-field-wide">Description<textarea value={String(editForm.description || "")} onChange={(e) => setEditForm((x) => ({ ...x, description: e.target.value }))} rows={3} /></label>
          </div>
          <div style={{ display: "flex", gap: 8 }}><button className="admin-button" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button><button type="button" className="admin-button secondary" onClick={() => setEditingId(null)}>Cancel</button></div>
        </form>
      )}

      {editingId && slug === "categories" && (
        <form className="admin-card admin-form" onSubmit={saveCategory}>
          <h2>Edit category</h2>
          <div className="admin-form-grid">
            <label>Name<input value={String(editForm.name || "")} onChange={(e) => setEditForm((x) => ({ ...x, name: e.target.value }))} required /></label>
            <label className="admin-field-wide">Description<textarea value={String(editForm.description || "")} onChange={(e) => setEditForm((x) => ({ ...x, description: e.target.value }))} rows={3} /></label>
          </div>
          <div style={{ display: "flex", gap: 8 }}><button className="admin-button" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button><button type="button" className="admin-button secondary" onClick={() => setEditingId(null)}>Cancel</button></div>
        </form>
      )}

      {error && <p className="admin-error" role="alert">{error}</p>}
      {success && <p className="admin-success" role="status">{success}</p>}

      <section className="admin-card">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
          <div><h2 style={{ margin: 0 }}>{resource.title}</h2><p className="admin-muted" style={{ margin: "4px 0 0" }}>{filteredRows.length} record{filteredRows.length === 1 ? "" : "s"}</p></div>
          <input aria-label={`Search ${resource.title}`} placeholder={`Search ${resource.title.toLowerCase()}…`} value={search} onChange={(e) => setSearch(e.target.value)} style={{ minWidth: 240 }} />
        </div>
        {loading ? <p>Loading…</p> : filteredRows.length === 0 ? <><h3>No records</h3><p className="admin-muted">{search ? "No records match your search." : "There is no data to display yet."}</p></> : (
          <div style={{ overflowX: "auto" }}>
            <table className="admin-table">
              <thead><tr>{resource.columns.map((column) => <th key={column}>{fieldLabel(column)}</th>)}{(slug === "products" || slug === "categories" || slug === "terminals") && <th>Actions</th>}</tr></thead>
              <tbody>{filteredRows.map((row, index) => {
                const id = String(row.id || row.key || index);
                return <tr key={id}>
                  {resource.columns.map((column) => <td key={column}>{moneyColumns.has(column) ? money(row[column]) : column === "isActive" ? (row[column] ? "Active" : "Revoked") : display(row[column])}</td>)}
                  {slug === "products" && <td className="admin-actions"><button className="admin-button secondary" onClick={() => beginProductEdit(row)}>Edit</button><button className="admin-button danger" onClick={() => void archiveProduct(id)}>Archive</button></td>}
                  {slug === "categories" && <td className="admin-actions"><button className="admin-button secondary" onClick={() => beginCategoryEdit(row)}>Edit</button><button className="admin-button danger" onClick={() => void deleteCategory(id)}>Delete</button></td>}
                  {slug === "terminals" && <td className="admin-actions">{row.isActive ? <button className="admin-button danger" onClick={() => void revoke(id)}>Revoke</button> : <span className="admin-muted">Revoked</span>}</td>}
                </tr>;
              })}</tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}
