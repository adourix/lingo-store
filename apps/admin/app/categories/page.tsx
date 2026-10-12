"use client";

import { FormEvent, useEffect, useState } from "react";

const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL || "/api";
const PUBLIC_ORIGIN = process.env.NEXT_PUBLIC_PUBLIC_ORIGIN || "https://lingostore.store";
const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp"] as const;

type Category = { id: string; name: string };

function imageUrl(categoryId: string) {
  return IMAGE_EXTENSIONS.map((ext) => `${PUBLIC_ORIGIN}/uploads/categories/${categoryId}.${ext}`);
}

function normalizeCategories(data: unknown): Category[] {
  const raw = Array.isArray(data)
    ? data
    : data && typeof data === "object" && "categories" in data && Array.isArray(data.categories)
      ? data.categories
      : [];
  return raw.filter((value): value is Category => {
    if (!value || typeof value !== "object") return false;
    const candidate = value as Record<string, unknown>;
    return typeof candidate.id === "string" && typeof candidate.name === "string";
  });
}

async function csrfToken() {
  const response = await fetch(`${API_ORIGIN}/admin/auth/csrf`, { credentials: "include" });
  if (!response.ok) throw new Error("تعذر الحصول على CSRF token");
  const data = await response.json();
  return data.token || data.csrfToken;
}

async function apiRequest(path: string, init: RequestInit = {}) {
  const token = await csrfToken();
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json");
  headers.set("x-csrf-token", token);
  return fetch(`${API_ORIGIN}${path}`, { ...init, headers, credentials: "include" });
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadCategories() {
    setLoading(true); setError("");
    try {
      const response = await fetch(`${API_ORIGIN}/admin/categories`, { credentials: "include" });
      if (response.status === 401 || response.status === 403) throw new Error("غير مصرح لك بإدارة التصنيفات");
      if (!response.ok) throw new Error(`فشل تحميل التصنيفات (${response.status})`);
      setCategories(normalizeCategories(await response.json()));
    } catch (e) { setError(e instanceof Error ? e.message : "فشل تحميل التصنيفات"); }
    finally { setLoading(false); }
  }
  useEffect(() => { void loadCategories(); }, []);

  async function uploadImage(categoryId: string, file: File) {
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) throw new Error("الصورة يجب أن تكون PNG أو JPEG أو WebP");
    if (file.size > 3 * 1024 * 1024) throw new Error("حجم الصورة يجب ألا يتجاوز 3MB");
    const token = await csrfToken();
    const body = new FormData();
    // The upload route reads the multipart field named "file".
    body.append("file", file, file.name);
    const response = await fetch(`${API_ORIGIN.replace(/\/api$/, "")}/api/category-image?categoryId=${encodeURIComponent(categoryId)}`, {
      method: "POST", body, credentials: "include", headers: { "x-csrf-token": token },
    });
    if (!response.ok) throw new Error((await response.text()) || `فشل رفع الصورة (${response.status})`);
  }

  async function createCategory(event: FormEvent) {
    event.preventDefault(); if (!name.trim()) return; setError("");
    try {
      const response = await apiRequest("/admin/categories", { method: "POST", body: JSON.stringify({ name: name.trim() }) });
      if (!response.ok) throw new Error((await response.text()) || `فشل إنشاء التصنيف (${response.status})`);
      const created: unknown = await response.json();
      const category = created && typeof created === "object" && "category" in created ? created.category : created;
      if (image && category && typeof category === "object" && "id" in category && typeof category.id === "string") await uploadImage(category.id, image);
      setName(""); setImage(null); await loadCategories();
    } catch (e) { setError(e instanceof Error ? e.message : "فشل إنشاء التصنيف"); }
  }

  async function deleteCategory(id: string) {
    if (!window.confirm("هل تريد حذف هذا التصنيف؟")) return; setError("");
    try {
      const response = await apiRequest(`/admin/categories/${encodeURIComponent(id)}`, { method: "DELETE", body: JSON.stringify({}) });
      if (!response.ok) throw new Error((await response.text()) || `فشل حذف التصنيف (${response.status})`);
      await loadCategories();
    } catch (e) { setError(e instanceof Error ? e.message : "فشل حذف التصنيف"); }
  }

  async function replaceImage(id: string, file: File) {
    setError("");
    try { await uploadImage(id, file); await loadCategories(); }
    catch (e) { setError(e instanceof Error ? e.message : "فشل رفع الصورة"); }
  }

  return <main style={{ padding: 32, maxWidth: 1100, margin: "0 auto" }}>
    <h1>Categories</h1><p>إدارة تصنيفات المنتجات وصورها.</p>
    {error && <div style={{ padding: 12, margin: "16px 0", border: "1px solid #c00" }}>{error}</div>}
    <form onSubmit={createCategory} style={{ display: "flex", gap: 12, margin: "24px 0" }}>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم التصنيف" required />
      <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setImage(e.target.files?.[0] || null)} />
      <button type="submit">إضافة</button>
    </form>
    {loading ? <p>Loading...</p> : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 20 }}>
      {categories.map((category) => <article key={category.id} style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16 }}>
        <CategoryImage urls={imageUrl(category.id)} alt={category.name} /><h2>{category.name}</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <label>تغيير الصورة<input type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={(e) => { const file = e.target.files?.[0]; if (file) void replaceImage(category.id, file); e.currentTarget.value = ""; }} /></label>
          <button type="button" onClick={() => void deleteCategory(category.id)}>حذف</button>
        </div>
      </article>)}
    </div>}
  </main>;
}

function CategoryImage({ urls, alt }: { urls: string[]; alt: string }) {
  const [index, setIndex] = useState(0);
  if (index >= urls.length) return <div style={{ height: 160, display: "grid", placeItems: "center", background: "#f4f4f4" }}>No image</div>;
  return <img src={urls[index]} alt={alt} style={{ width: "100%", height: 160, objectFit: "contain" }} onError={() => setIndex((value) => value + 1)} />;
}
