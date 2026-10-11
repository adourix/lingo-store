"use client";

import { FormEvent, useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

type Row = Record<string, unknown>;

type Category = {
  id: string;
  name: string;
};

function display(value: unknown): string {
  if (value === null || value === undefined) return "—";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

function money(value: unknown): string {
  const minor = Number(value);
  return Number.isFinite(minor) ? `${(minor / 100).toFixed(2)} EGP` : "—";
}

async function getCsrf(): Promise<string> {
  const response = await fetch(`${API}/admin/auth/csrf`, { credentials: "include" });
  if (!response.ok) throw new Error("CSRF unavailable");
  const body = (await response.json()) as { token?: string };
  return String(body.token || "");
}

function errorMessage(value: unknown, fallback: string): string {
  if (value && typeof value === "object" && "error" in value) {
    const error = (value as { error?: unknown }).error;
    if (typeof error === "object" && error && "message" in error)
      return String((error as { message?: unknown }).message || fallback);
    return String(error || fallback);
  }
  return fallback;
}

function toMinor(value: string): string {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) throw new Error("Enter a valid non-negative price.");
  return String(Math.round(amount * 100));
}

export default function ProductsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [price, setPrice] = useState("");
  const [cost, setCost] = useState("");
  const [stock, setStock] = useState("0");
  const [minStock, setMinStock] = useState("0");
  const [barcode, setBarcode] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [productsResponse, categoriesResponse] = await Promise.all([
        fetch(`${API}/admin/products`, { credentials: "include", cache: "no-store" }),
        fetch(`${API}/admin/categories`, { credentials: "include", cache: "no-store" }),
      ]);

      if (productsResponse.status === 401 || categoriesResponse.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (productsResponse.status === 403) throw new Error("You do not have permission to view products.");
      if (!productsResponse.ok) {
        const body = await productsResponse.json().catch(() => ({}));
        throw new Error(errorMessage(body, "Unable to load products."));
      }

      const products = await productsResponse.json();
      setRows(Array.isArray(products) ? products : []);

      if (categoriesResponse.ok) {
        const categoryData = await categoriesResponse.json();
        setCategories(
          Array.isArray(categoryData)
            ? categoryData.filter(
                (item): item is Category =>
                  Boolean(item) && typeof item.id === "string" && typeof item.name === "string",
              )
            : [],
        );
      } else if (categoriesResponse.status !== 403) {
        setCategories([]);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load products.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const token = await getCsrf();
      const response = await fetch(`${API}/admin/products`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json", "x-csrf-token": token },
        body: JSON.stringify({
          sku: sku.trim(),
          name: name.trim(),
          categoryId: categoryId || null,
          priceMinor: toMinor(price),
          ...(cost.trim() ? { costMinor: toMinor(cost) } : {}),
          stock: Number(stock),
          minStock: Number(minStock),
          barcode: barcode.trim() || null,
          description: description.trim() || null,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(errorMessage(body, "Product creation failed."));

      setSku("");
      setName("");
      setCategoryId("");
      setPrice("");
      setCost("");
      setStock("0");
      setMinStock("0");
      setBarcode("");
      setDescription("");
      setSuccess("Product added successfully.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Product creation failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <header className="admin-toolbar">
        <div>
          <p className="admin-muted">Lingo Store / Admin</p>
          <h1>Products</h1>
        </div>
      </header>

      {error && <p className="admin-error" role="alert">{error}</p>}
      {success && <p className="admin-success">{success}</p>}

      <form className="admin-card admin-form admin-create-form" onSubmit={submit}>
        <h2>Add product</h2>
        <div className="admin-form-grid">
          <label>
            SKU
            <input value={sku} onChange={(e) => setSku(e.target.value)} required maxLength={80} />
          </label>
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={160} />
          </label>
          <label>
            Category
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">No category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </label>
          <label>
            Selling price (EGP)
            <input
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
            />
          </label>
          <label>
            Cost price (EGP)
            <input
              type="number"
              min="0"
              step="0.01"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
            />
          </label>
          <label>
            Quantity in stock
            <input
              type="number"
              min="0"
              step="0.001"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              required
            />
          </label>
          <label>
            Minimum stock
            <input
              type="number"
              min="0"
              step="0.001"
              value={minStock}
              onChange={(e) => setMinStock(e.target.value)}
            />
          </label>
          <label>
            Barcode
            <input value={barcode} onChange={(e) => setBarcode(e.target.value)} maxLength={80} />
          </label>
          <label>
            Description
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={5000} rows={3} />
          </label>
        </div>
        <div>
          <button className="admin-button" disabled={saving}>
            {saving ? "Saving…" : "Add product"}
          </button>
          {categories.length === 0 && (
            <a href="/categories" style={{ marginInlineStart: 12 }}>Create a category first</a>
          )}
        </div>
      </form>

      {loading ? (
        <section className="admin-card"><p>Loading…</p></section>
      ) : rows.length === 0 ? (
        <section className="admin-card">
          <h2>No products</h2>
          <p className="admin-muted">Add the first product above.</p>
        </section>
      ) : (
        <section className="admin-card" style={{ overflowX: "auto" }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Name</th>
                <th>Category</th>
                <th>Price</th>
                <th>Cost</th>
                <th>Quantity</th>
                <th>Min stock</th>
                <th>Barcode</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={String(row.id || index)}>
                  <td>{display(row.sku)}</td>
                  <td>{display(row.name)}</td>
                  <td>{display((row.category as Row | undefined)?.name)}</td>
                  <td>{money(row.priceMinor)}</td>
                  <td>{money(row.costMinor)}</td>
                  <td>{display(row.stock)}</td>
                  <td>{display(row.minStock)}</td>
                  <td>{display(row.barcode)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </section>
  );
}
