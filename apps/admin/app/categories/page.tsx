"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";
const PUBLIC_ORIGIN = (process.env.NEXT_PUBLIC_PUBLIC_ORIGIN || "https://lingostore.store").replace(/\/$/, "");
const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp"] as const;

type Category = {
  id: string;
  name: string;
  description: string | null;
  createdAt?: string;
};

type JsonObject = Record<string, unknown>;

function errorText(value: unknown, fallback: string): string {
  if (!value || typeof value !== "object") return fallback;
  const error = (value as JsonObject).error;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && typeof (error as JsonObject).message === "string") return String((error as JsonObject).message);
  return fallback;
}

async function csrf(): Promise<string> {
  const response = await fetch(`${API}/admin/auth/csrf`, { credentials: "include", cache: "no-store" });
  const body: unknown = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(errorText(body, "CSRF unavailable."));
  return body && typeof body === "object" && typeof (body as JsonObject).token === "string" ? String((body as JsonObject).token) : "";
}

function CategoryImage({ category, refresh }: { category: Category; refresh: number }) {
  const [extensionIndex, setExtensionIndex] = useState(0);
  useEffect(() => setExtensionIndex(0), [category.id, refresh]);
  const extension = IMAGE_EXTENSIONS[extensionIndex];
  const customUrl = `${PUBLIC_ORIGIN}/uploads/categories/${category.id}.${extension}`;
  const fallback = "/category-images/general.svg";
  return (
    <img
      src={extensionIndex < IMAGE_EXTENSIONS.length ? `${customUrl}?v=${refresh}` : fallback}
      alt=""
      style={{ width: 76, height: 56, objectFit: "cover", borderRadius: 10, display: "block", background: "#f4f6ff" }}
      onError={() => setExtensionIndex((value) => Math.min(value + 1, IMAGE_EXTENSIONS.length))}
    />
  );
}

export default function CategoriesPage() {
  const [rows, setRows] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [createFile, setCreateFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(Date.now());
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  async function load() {
    setLoading(true);
    try {
      const response = await fetch(`${API}/admin/categories`, { credentials: "include", cache: "no-store" });
      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }
      const body: unknown = await response.json().catch(() => []);
      if (!response.ok) throw new Error(errorText(body, "Unable to load categories."));
      setRows(Array.isArray(body) ? body as Category[] : []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load categories.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function uploadImage(categoryId: string, file: File): Promise<string> {
    if (!file.type.startsWith("image/")) throw new Error("Choose a PNG, JPEG, or WebP image.");
    if (file.size <= 0 || file.size > 3 * 1024 * 1024) throw new Error("Category images must be 3 MB or smaller.");
    const token = await csrf();
    const form = new FormData();
    form.set("file", file);
    const response = await fetch(`${window.location.origin}${API}/category-image?categoryId=${encodeURIComponent(categoryId)}`, {
      method: "POST",
      credentials: "include",
      headers: { "x-csrf-token": token },
      body: form,
    });
    const body: unknown = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(errorText(body, "Category image upload failed."));
    return body && typeof body === "object" && typeof (body as JsonObject).imageUrl === "string" ? String((body as JsonObject).imageUrl) : "";
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const token = await csrf();
      const response = await fetch(`${API}/admin/categories`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json", "x-csrf-token": token },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || undefined }),
      });
      const body: unknown = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(errorText(body, "Category creation failed."));
      const category = body as Category;
      let imageWarning = "";
      if (createFile && category.id) {
        try {
          await uploadImage(category.id, createFile);
        } catch (cause) {
          imageWarning = ` Category created, but image upload failed: ${cause instanceof Error ? cause.message : "upload failed"}`;
        }
      }
      setName("");
      setDescription("");
      setCreateFile(null);
      setRefresh(Date.now());
      setSuccess(imageWarning ? imageWarning.trim() : "Category created.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Category creation failed.");
    } finally {
      setSaving(false);
    }
  }

  async function handleImageChange(category: Category, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploadingId(category.id);
    setError("");
    setSuccess("");
    try {
      await uploadImage(category.id, file);
      setRefresh(Date.now());
      setSuccess(`Image updated for ${category.name}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Category image upload failed.");
    } finally {
      setUploadingId(null);
    }
  }

  async function deleteCategory(category: Category) {
    if (!window.confirm(`Delete category “${category.name}”? Products will become uncategorized.`)) return;
    setDeletingId(category.id);
    setError("");
    setSuccess("");
    try {
      const token = await csrf();
      const response = await fetch(`${API}/admin/categories/${encodeURIComponent(category.id)}`, {
        method: "DELETE",
        credentials: "include",
        headers: { "content-type": "application/json", "x-csrf-token": token },
        body: "{}",
      });
      const body: unknown = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(errorText(body, "Category deletion failed."));
      setSuccess("Category deleted.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Category deletion failed.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="admin-page">
      <div className="admin-toolbar">
        <div>
          <p className="admin-muted" style={{ margin: 0 }}>Lingo Store / Admin</p>
          <h1 style={{ margin: "6px 0" }}>Categories</h1>
        </div>
      </div>

      {error && <p className="admin-error" role="alert">{error}</p>}
      {success && <p className="admin-success">{success}</p>}

      <form className="admin-card admin-form" onSubmit={create} style={{ marginBottom: 18 }}>
        <label>
          Name
          <input value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <label>
          Description
          <input value={description} onChange={(event) => setDescription(event.target.value)} />
        </label>
        <label>
          Category image
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setCreateFile(event.target.files?.[0] || null)} />
          <small className="admin-muted">PNG, JPEG or WebP · max 3 MB</small>
        </label>
        <div style={{ alignSelf: "end" }}>
          <button className="admin-button" disabled={saving}>{saving ? "Saving…" : "Add"}</button>
        </div>
      </form>

      {loading ? (
        <div className="admin-card"><p>Loading…</p></div>
      ) : rows.length === 0 ? (
        <div className="admin-card"><h2>No categories</h2><p className="admin-muted">There are no categories yet.</p></div>
      ) : (
        <div className="admin-card admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Image</th>
                <th>Name</th>
                <th>Description</th>
                <th>Created at</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((category) => (
                <tr key={category.id}>
                  <td>
                    <button
                      type="button"
                      onClick={() => inputRefs.current[category.id]?.click()}
                      title="Change category image"
                      style={{ padding: 0, border: 0, background: "transparent", cursor: "pointer" }}
                    >
                      <CategoryImage category={category} refresh={refresh} />
                    </button>
                    <input
                      ref={(element) => { inputRefs.current[category.id] = element; }}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      hidden
                      onChange={(event) => void handleImageChange(category, event)}
                    />
                  </td>
                  <td><strong>{category.name}</strong></td>
                  <td>{category.description || "—"}</td>
                  <td>{category.createdAt ? new Date(category.createdAt).toLocaleString() : "—"}</td>
                  <td className="admin-actions">
                    <button
                      type="button"
                      className="admin-button secondary"
                      disabled={uploadingId === category.id}
                      onClick={() => inputRefs.current[category.id]?.click()}
                    >
                      {uploadingId === category.id ? "Uploading…" : "Change image"}
                    </button>
                    <button
                      type="button"
                      className="admin-button danger"
                      disabled={deletingId === category.id}
                      onClick={() => void deleteCategory(category)}
                    >
                      {deletingId === category.id ? "Deleting…" : "Delete"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
