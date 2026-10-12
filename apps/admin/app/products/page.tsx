"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";
const IMAGE_UPLOAD = "/api/product-image";
const META_PREFIX = "[[LINGO_PRODUCT_META]]";
type Row = Record<string, unknown>;
type Category = { id: string; name: string };
type Meta = { description: string; imageUrl: string; brand: string; unit: string };

function display(value: unknown): string {
  return value === null || value === undefined || value === ""
    ? "—"
    : typeof value === "object"
      ? JSON.stringify(value)
      : String(value);
}
function money(value: unknown): string {
  const minor = Number(value);
  return Number.isFinite(minor) ? `${(minor / 100).toFixed(2)} EGP` : "—";
}
function parseMeta(value: unknown): Meta {
  const raw = typeof value === "string" ? value : "";
  if (!raw.startsWith(META_PREFIX)) return { description: raw, imageUrl: "", brand: "", unit: "" };
  const start = raw.indexOf("{", META_PREFIX.length);
  if (start < 0) return { description: raw, imageUrl: "", brand: "", unit: "" };
  for (let end = start + 1; end <= raw.length; end += 1) {
    if (raw[end - 1] !== "}") continue;
    try {
      const meta = JSON.parse(raw.slice(start, end)) as Record<string, unknown>;
      return {
        description: raw.slice(end).replace(/^\n/, "").trim(),
        imageUrl: typeof meta.imageUrl === "string" ? meta.imageUrl : "",
        brand: typeof meta.brand === "string" ? meta.brand : "",
        unit: typeof meta.unit === "string" ? meta.unit : "",
      };
    } catch {}
  }
  return { description: raw, imageUrl: "", brand: "", unit: "" };
}
function encodeDescription(description: string, brand: string, unit: string): string | null {
  const meta: Record<string, string> = {};
  if (brand.trim()) meta.brand = brand.trim();
  if (unit.trim()) meta.unit = unit.trim();
  const clean = description.trim();
  return Object.keys(meta).length
    ? `${META_PREFIX}${JSON.stringify(meta)}${clean ? `\n${clean}` : ""}`
    : clean || null;
}
function adminImageUrl(value: string): string {
  try {
    const url = new URL(value, window.location.origin);
    const filename = url.pathname.split("/").pop() || "";
    if (
      /^[a-f0-9-]+\.(?:jpg|jpeg|png|webp)$/i.test(filename) &&
      url.pathname.startsWith("/uploads/products/")
    )
      return `/uploads/products/${encodeURIComponent(filename)}`;
  } catch {}
  return "";
}
async function getCsrf(): Promise<string> {
  const response = await fetch(`${API}/admin/auth/csrf`, {
    credentials: "include",
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String(body.error || "CSRF unavailable"));
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
  const [rows, setRows] = useState<Row[]>([]),
    [categories, setCategories] = useState<Category[]>([]);
  const [sku, setSku] = useState(""),
    [name, setName] = useState(""),
    [categoryId, setCategoryId] = useState("");
  const [price, setPrice] = useState(""),
    [cost, setCost] = useState(""),
    [stock, setStock] = useState("0"),
    [minStock, setMinStock] = useState("0");
  const [barcode, setBarcode] = useState(""),
    [description, setDescription] = useState(""),
    [imageUrl, setImageUrl] = useState(""),
    [brand, setBrand] = useState(""),
    [unit, setUnit] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null),
    [imagePreview, setImagePreview] = useState("");
  const [query, setQuery] = useState(""),
    [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false),
    [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  const [editing, setEditing] = useState<Row | null>(null),
    [editName, setEditName] = useState(""),
    [editPrice, setEditPrice] = useState(""),
    [editCost, setEditCost] = useState(""),
    [editMinStock, setEditMinStock] = useState("0"),
    [editSaving, setEditSaving] = useState(false);

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
      if (!productsResponse.ok) {
        const body = await productsResponse.json().catch(() => ({}));
        throw new Error(errorMessage(body, "Unable to load products."));
      }
      const products = await productsResponse.json();
      setRows(Array.isArray(products) ? products : []);
      if (categoriesResponse.ok) {
        const data = await categoriesResponse.json();
        setCategories(
          Array.isArray(data)
            ? data.filter(
                (item): item is Category =>
                  Boolean(item) && typeof item.id === "string" && typeof item.name === "string",
              )
            : [],
        );
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

  const visibleRows = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const meta = parseMeta(row.description);
      return [row.sku, row.name, row.barcode, meta.brand, meta.description]
        .map((v) => String(v ?? "").toLocaleLowerCase())
        .some((v) => v.includes(q));
    });
  }, [rows, query]);

  async function uploadSelectedImage(): Promise<string> {
    if (!imageFile) return "";
    const token = await getCsrf();
    const form = new FormData();
    form.set("file", imageFile);
    const response = await fetch(IMAGE_UPLOAD, {
      method: "POST",
      credentials: "include",
      headers: { "x-csrf-token": token },
      body: form,
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(errorMessage(body, "Product image upload failed."));
    return String(body.imageUrl || "");
  }
  function clearImage() {
    setImageFile(null);
    setImageUrl("");
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview("");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    let uploadedImage = "";
    try {
      uploadedImage = await uploadSelectedImage();
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
          imageUrl: uploadedImage || imageUrl || null,
          description: encodeDescription(description, brand, unit),
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
      setImageUrl("");
      setBrand("");
      setUnit("");
      if (imagePreview) URL.revokeObjectURL(imagePreview);
      setImageFile(null);
      setImagePreview("");
      setSuccess("Product added successfully.");
      await load();
    } catch (cause) {
      if (uploadedImage) {
        const token = await getCsrf().catch(() => "");
        if (token)
          await fetch(`${IMAGE_UPLOAD}?imageUrl=${encodeURIComponent(uploadedImage)}`, {
            method: "DELETE",
            credentials: "include",
            headers: { "x-csrf-token": token },
          }).catch(() => undefined);
      }
      setError(cause instanceof Error ? cause.message : "Product creation failed.");
    } finally {
      setSaving(false);
    }
  }
  function beginEdit(row: Row) {
    setEditing(row);
    setEditName(String(row.name || ""));
    setEditPrice((Number(row.priceMinor || 0) / 100).toFixed(2));
    setEditCost((Number(row.costMinor || 0) / 100).toFixed(2));
    setEditMinStock(String(row.minStock ?? 0));
    setError("");
    setSuccess("");
  }
  async function saveEdit(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    setEditSaving(true);
    setError("");
    setSuccess("");
    const id = String(editing.id || "");
    try {
      const token = await getCsrf();
      const response = await fetch(`${API}/admin/products/${encodeURIComponent(id)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json", "x-csrf-token": token },
        body: JSON.stringify({
          name: editName.trim(),
          priceMinor: toMinor(editPrice),
          costMinor: toMinor(editCost),
          minStock: Number(editMinStock),
          version: Number(editing.version || 0),
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(
          errorMessage(
            body,
            response.status === 409
              ? "This product was changed by another session. Refresh and try again."
              : "Product update failed.",
          ),
        );
      setEditing(null);
      setSuccess("Product updated successfully.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Product update failed.");
    } finally {
      setEditSaving(false);
    }
  }
  async function deleteProduct(id: string, productName: string) {
    if (
      !window.confirm(
        `Delete product “${productName}”? It will be removed from the active catalog.`,
      )
    )
      return;
    setDeletingId(id);
    setError("");
    setSuccess("");
    try {
      const token = await getCsrf();
      const response = await fetch(`${API}/admin/products/${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
        headers: { "content-type": "application/json", "x-csrf-token": token },
        body: "{}",
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(errorMessage(body, "Product delete failed."));
      setSuccess("Product deleted.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Product delete failed.");
    } finally {
      setDeletingId(null);
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
      {error && (
        <p className="admin-error" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className="admin-success" role="status">
          {success}
        </p>
      )}
      <form className="admin-card admin-form admin-create-form" onSubmit={submit}>
        <div className="admin-section-heading">
          <div>
            <h2>Add product</h2>
            <p className="admin-muted">
              Create a product with its catalog image, category, stock and pricing.
            </p>
          </div>
        </div>
        <div className="admin-form-grid">
          <label>
            SKU
            <input value={sku} onChange={(e) => setSku(e.target.value)} required maxLength={80} />
          </label>
          <label>
            Product name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={160}
            />
          </label>
          <label>
            Brand
            <input
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              maxLength={120}
              placeholder="Optional"
            />
          </label>
          <label>
            Unit
            <input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              maxLength={40}
              placeholder="piece, box, kg…"
            />
          </label>
          <label>
            Category
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">No category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Barcode
            <input
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              maxLength={80}
              inputMode="numeric"
            />
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
              placeholder="Optional / permissioned"
            />
          </label>
          <label>
            Opening stock
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
          <label className="admin-form-wide">
            Product image
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                if (imagePreview) URL.revokeObjectURL(imagePreview);
                setImageFile(file);
                setImageUrl("");
                setImagePreview(file ? URL.createObjectURL(file) : "");
              }}
            />
            <small>JPG, PNG or WebP. Maximum 2 MB.</small>
          </label>
          {imagePreview && (
            <div className="admin-product-preview admin-form-wide">
              <img src={imagePreview} alt="Selected product preview" />
              <div>
                <strong>Image preview</strong>
                <button type="button" className="admin-button secondary" onClick={clearImage}>
                  Remove image
                </button>
              </div>
            </div>
          )}
          <label className="admin-form-wide">
            Description
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={5000}
              rows={4}
              placeholder="What is this product, and what should customers know?"
            />
          </label>
        </div>
        <div>
          <button className="admin-button" disabled={saving}>
            {saving ? "Saving…" : "Add product"}
          </button>
          {categories.length === 0 && (
            <a href="/categories" style={{ marginInlineStart: 12 }}>
              Create a category first
            </a>
          )}
        </div>
      </form>
      {editing && (
        <div className="admin-modal-backdrop">
          <form className="admin-card admin-modal" onSubmit={saveEdit}>
            <div className="admin-section-heading">
              <div>
                <p className="admin-muted">Edit product</p>
                <h2>{String(editing.name || editing.sku || "Product")}</h2>
              </div>
              <button
                type="button"
                className="admin-button secondary"
                onClick={() => setEditing(null)}
              >
                Close
              </button>
            </div>
            <div className="admin-form-grid">
              <label>
                Product name
                <input value={editName} onChange={(e) => setEditName(e.target.value)} required />
              </label>
              <label>
                Selling price (EGP)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                  required
                />
              </label>
              <label>
                Cost price (EGP)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editCost}
                  onChange={(e) => setEditCost(e.target.value)}
                />
              </label>
              <label>
                Minimum stock
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={editMinStock}
                  onChange={(e) => setEditMinStock(e.target.value)}
                />
              </label>
            </div>
            <p className="admin-muted">
              SKU, barcode, category and image remain unchanged in this quick editor.
            </p>
            <div className="admin-form-actions">
              <button
                className="admin-button secondary"
                type="button"
                onClick={() => setEditing(null)}
              >
                Cancel
              </button>
              <button className="admin-button" disabled={editSaving}>
                {editSaving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>
        </div>
      )}
      <section className="admin-card">
        <div className="admin-toolbar-inline">
          <div>
            <h2>Active catalog</h2>
            <p className="admin-muted">
              {visibleRows.length} product{visibleRows.length === 1 ? "" : "s"}
            </p>
          </div>
          <input
            aria-label="Search products"
            placeholder="Search SKU, name, brand…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {loading ? (
          <p>Loading…</p>
        ) : visibleRows.length === 0 ? (
          <div className="admin-empty">
            <h3>{query ? "No matching products" : "No products"}</h3>
            <p className="admin-muted">
              {query ? "Try another search." : "Add the first product above."}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Cost</th>
                  <th>Stock</th>
                  <th>Barcode</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row, index) => {
                  const id = String(row.id || index);
                  const meta = parseMeta(row.description);
                  const productName = String(row.name || row.sku || "this product");
                  const image = adminImageUrl(String(row.imageUrl || meta.imageUrl || ""));
                  return (
                    <tr key={id}>
                      <td>
                        <div className="admin-product-cell">
                          {image ? (
                            <img
                              src={image}
                              alt=""
                              onError={(event) => {
                                event.currentTarget.style.display = "none";
                              }}
                            />
                          ) : (
                            <span>{productName.slice(0, 1).toUpperCase()}</span>
                          )}
                          <div>
                            <strong>{productName}</strong>
                            <small>
                              {display(row.sku)}
                              {meta.brand ? ` · ${meta.brand}` : ""}
                            </small>
                          </div>
                        </div>
                      </td>
                      <td>{display((row.category as Row | undefined)?.name)}</td>
                      <td>{money(row.priceMinor)}</td>
                      <td>{money(row.costMinor)}</td>
                      <td>
                        {display(row.stock)}
                        <small> / min {display(row.minStock)}</small>
                      </td>
                      <td>{display(row.barcode)}</td>
                      <td className="admin-actions">
                        <button
                          type="button"
                          className="admin-button secondary"
                          onClick={() => beginEdit(row)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="admin-button danger"
                          disabled={deletingId === id}
                          onClick={() => void deleteProduct(id, productName)}
                        >
                          {deletingId === id ? "Deleting…" : "Delete"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}
