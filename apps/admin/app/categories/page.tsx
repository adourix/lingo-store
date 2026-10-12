"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import "./categories.css";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";
const EXTENSIONS = ["png", "jpg", "jpeg", "webp"] as const;
type Category = { id: string; name: string };

function normalize(data: unknown): Category[] {
  const raw: unknown[] = Array.isArray(data)
    ? data
    : data && typeof data === "object" && Array.isArray((data as Record<string, unknown>).categories)
      ? ((data as Record<string, unknown>).categories as unknown[])
      : [];
  return raw.filter(
    (value): value is Category =>
      !!value &&
      typeof value === "object" &&
      typeof (value as Record<string, unknown>).id === "string" &&
      typeof (value as Record<string, unknown>).name === "string",
  );
}

async function csrf(): Promise<string> {
  const response = await fetch(`${API}/admin/auth/csrf`, { credentials: "include", cache: "no-store" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String(body.error || "تعذر الحصول على CSRF token"));
  return String(body.token || body.csrfToken || "");
}

async function apiRequest(path: string, init: RequestInit = {}) {
  const token = await csrf();
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json");
  headers.set("x-csrf-token", token);
  return fetch(`${API}${path}`, { ...init, headers, credentials: "include", cache: "no-store" });
}

function imageCandidates(id: string, version: number) {
  return EXTENSIONS.map((ext) => `/uploads/categories/${id}.${ext}?v=${version}`);
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [version, setVersion] = useState(Date.now());

  async function loadCategories() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API}/admin/categories`, { credentials: "include", cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(String(body.error || `فشل تحميل التصنيفات (${response.status})`));
      setCategories(normalize(body));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "فشل تحميل التصنيفات");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCategories();
  }, []);

  async function uploadImage(categoryId: string, file: File) {
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
      throw new Error("الصورة يجب أن تكون PNG أو JPEG أو WebP");
    if (file.size <= 0 || file.size > 3 * 1024 * 1024)
      throw new Error("حجم الصورة يجب ألا يتجاوز 3MB");
    const token = await csrf();
    const form = new FormData();
    form.append("file", file, file.name);
    const response = await fetch(`/api/category-image?categoryId=${encodeURIComponent(categoryId)}`, {
      method: "POST",
      body: form,
      credentials: "include",
      headers: { "x-csrf-token": token },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(String(body.error || `فشل رفع الصورة (${response.status})`));
  }

  async function createCategory(event: FormEvent) {
    event.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const response = await apiRequest("/admin/categories", {
        method: "POST",
        body: JSON.stringify({ name: cleanName }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(String(body.error || "فشل إنشاء التصنيف"));
      const category = body.category || body;
      if (image && category?.id) await uploadImage(String(category.id), image);
      setName("");
      setImage(null);
      setVersion(Date.now());
      setSuccess("تم إنشاء التصنيف بنجاح.");
      await loadCategories();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "فشل إنشاء التصنيف");
    } finally {
      setSaving(false);
    }
  }

  async function replaceImage(id: string, file: File) {
    setError("");
    setSuccess("");
    try {
      await uploadImage(id, file);
      setVersion(Date.now());
      setSuccess("تم تحديث صورة التصنيف.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "فشل رفع الصورة");
    }
  }

  async function deleteCategory(category: Category) {
    if (!window.confirm(`حذف التصنيف «${category.name}»؟ المنتجات ستبقى بدون تصنيف.`)) return;
    setError("");
    setSuccess("");
    try {
      const imageResponse = await fetch(`/api/category-image?categoryId=${encodeURIComponent(category.id)}`, {
        method: "DELETE",
        credentials: "include",
        headers: { "x-csrf-token": await csrf() },
      });
      if (!imageResponse.ok && imageResponse.status !== 404)
        throw new Error("فشل حذف صورة التصنيف");
      const response = await apiRequest(`/admin/categories/${encodeURIComponent(category.id)}`, {
        method: "DELETE",
        body: "{}",
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(String(body.error || "فشل حذف التصنيف"));
      setSuccess("تم حذف التصنيف.");
      await loadCategories();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "فشل حذف التصنيف");
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? categories.filter((category) => category.name.toLowerCase().includes(q)) : categories;
  }, [categories, search]);

  return (
    <main className="categories-workspace">
      <section className="categories-hero">
        <div>
          <p className="categories-kicker">Catalog management</p>
          <h1>Categories</h1>
          <p>Organize your products and keep the POS catalog aligned with the storefront.</p>
        </div>
        <button className="categories-primary" type="button" onClick={() => document.getElementById("category-name")?.focus()}>
          ＋ Add category
        </button>
      </section>
      {error && <div className="categories-alert error" role="alert">{error}</div>}
      {success && <div className="categories-alert success" role="status">{success}</div>}
      <section className="categories-stats">
        <div className="categories-stat"><span>Total categories</span><strong>{categories.length}</strong><small>Managed from this workspace</small></div>
        <div className="categories-stat"><span>Category images</span><strong>Live</strong><small>Served from the shared category store</small></div>
        <div className="categories-stat"><span>POS catalog</span><strong>Synced</strong><small>Products use the same category relation</small></div>
      </section>
      <div className="categories-layout">
        <section className="categories-card">
          <div className="categories-card-head">
            <div><h2>All categories</h2><p>Search, replace images, or remove a category.</p></div>
            <input className="categories-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search categories..." aria-label="Search categories" />
          </div>
          {loading ? <div className="categories-loading">Loading categories…</div> : filtered.length === 0 ? <div className="categories-empty">{search ? "No categories match your search." : "No categories yet."}</div> : <div className="category-grid">{filtered.map((category) => <CategoryCard key={category.id} category={category} version={version} onReplace={replaceImage} onDelete={deleteCategory} />)}</div>}
        </section>
        <aside className="categories-card category-form">
          <h2>Add new category</h2>
          <p>Create a category once and it becomes available to products and the POS catalog through the same database relationship.</p>
          <form onSubmit={createCategory}>
            <label className="category-field"><span>Category name *</span><input id="category-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Phones, Accessories" maxLength={120} required /></label>
            <div className="category-field"><span>Image</span><div className="category-upload"><strong>Upload category image</strong><span>PNG, JPG or WebP · max 3MB</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e: ChangeEvent<HTMLInputElement>) => setImage(e.target.files?.[0] || null)} /></div></div>
            <button className="category-submit" type="submit" disabled={saving}>{saving ? "Creating…" : "Add category"}</button>
          </form>
        </aside>
      </div>
    </main>
  );
}

function CategoryCard({ category, version, onReplace, onDelete }: { category: Category; version: number; onReplace: (id: string, file: File) => Promise<void>; onDelete: (category: Category) => Promise<void> }) {
  const [index, setIndex] = useState(0);
  const urls = imageCandidates(category.id, version);
  const upload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.currentTarget.value = "";
    if (file) void onReplace(category.id, file);
  };
  return <article className="category-card">
    <div className="category-image">{index < urls.length ? <img src={urls[index]} alt={category.name} onError={() => setIndex((value) => value + 1)} /> : <div className="category-image-fallback">{category.name.slice(0, 1).toUpperCase()}</div>}</div>
    <div className="category-body"><h3 className="category-name" title={category.name}>{category.name}</h3><div className="category-actions"><label className="category-action">Change image<input type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={upload} /></label><button className="category-action danger" type="button" onClick={() => void onDelete(category)}>Delete</button></div></div>
  </article>;
}
