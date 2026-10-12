import { cookies } from "next/headers";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

const MAX_BYTES = 3 * 1024 * 1024;
const EXTENSIONS = ["png", "jpg", "jpeg", "webp"] as const;
type Extension = (typeof EXTENSIONS)[number];

function uploadRoot(): string {
  return process.env.CATEGORY_IMAGE_DIR || path.resolve(process.cwd(), "../../.data/category-images");
}

function publicOrigin(): string {
  return (process.env.PUBLIC_ORIGIN || "https://lingostore.store").replace(/\/$/, "");
}

function requestOrigin(request: Request): string {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host")?.split(":")[0]?.trim();
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const proto = forwardedProto || new URL(request.url).protocol.replace(":", "");
  if (!host) throw new Error("ADMIN_ORIGIN_REQUIRED");
  return `${proto}://${host}`;
}

async function assertCategoryManager(request: Request, categoryId: string): Promise<void> {
  if (!/^[0-9a-f-]{36}$/i.test(categoryId)) throw new Error("INVALID_ID");
  const cookieStore = await cookies();
  const cookieHeader = request.headers.get("cookie") || cookieStore.toString();
  const csrfCookie = cookieStore.get("__Host-lingo_admin_csrf")?.value || "";
  const csrfHeader = request.headers.get("x-csrf-token") || "";
  if (!csrfCookie || csrfCookie !== csrfHeader) throw new Error("CSRF_REQUIRED");

  const api = process.env.API_INTERNAL_URL || "http://127.0.0.1:4000";
  const adminOrigin = requestOrigin(request);
  const response = await fetch(`${api}/api/admin/categories`, {
    headers: {
      cookie: cookieHeader,
      origin: adminOrigin,
      referer: `${adminOrigin}/categories`,
      "x-forwarded-host": new URL(adminOrigin).hostname,
      "x-forwarded-proto": new URL(adminOrigin).protocol.replace(":", ""),
    },
    cache: "no-store",
  });
  if (response.status === 401) throw new Error("UNAUTHENTICATED");
  if (response.status === 403) throw new Error("FORBIDDEN");
  if (!response.ok) throw new Error("CATEGORY_LOOKUP_FAILED");
  const rows: unknown = await response.json().catch(() => []);
  if (!Array.isArray(rows) || !rows.some((row) => row && typeof row === "object" && String((row as Record<string, unknown>).id) === categoryId))
    throw new Error("NOT_FOUND");
}

function detectExtension(file: File, bytes: Buffer): Extension | null {
  if (file.type === "image/png" && bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "png";
  if (file.type === "image/jpeg" && bytes.length >= 3 && bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]))) return "jpg";
  if (
    file.type === "image/webp" &&
    bytes.length >= 12 &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  ) return "webp";
  return null;
}

async function removeExisting(categoryId: string): Promise<void> {
  const root = uploadRoot();
  await Promise.all(EXTENSIONS.map((ext) => unlink(path.join(root, `${categoryId}.${ext}`)).catch(() => undefined)));
}

export async function POST(request: Request) {
  try {
    const categoryId = new URL(request.url).searchParams.get("categoryId") || "";
    await assertCategoryManager(request, categoryId);
    const form = await request.formData();
    const value = form.get("file");
    if (!(value instanceof File)) return NextResponse.json({ error: "IMAGE_REQUIRED" }, { status: 400 });
    if (value.size <= 0 || value.size > MAX_BYTES) return NextResponse.json({ error: "IMAGE_TOO_LARGE" }, { status: 400 });

    const bytes = Buffer.from(await value.arrayBuffer());
    const extension = detectExtension(value, bytes);
    if (!extension) return NextResponse.json({ error: "UNSUPPORTED_IMAGE" }, { status: 400 });

    const root = uploadRoot();
    await mkdir(root, { recursive: true });
    await removeExisting(categoryId);
    const filename = `${categoryId}.${extension}`;
    await writeFile(path.join(root, filename), bytes, { flag: "wx" });
    return NextResponse.json({ imageUrl: `${publicOrigin()}/uploads/categories/${filename}` });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UPLOAD_FAILED";
    if (message === "CSRF_REQUIRED" || message === "FORBIDDEN") return NextResponse.json({ error: message }, { status: 403 });
    if (message === "UNAUTHENTICATED") return NextResponse.json({ error: message }, { status: 401 });
    if (message === "INVALID_ID" || message === "NOT_FOUND") return NextResponse.json({ error: message }, { status: 404 });
    return NextResponse.json({ error: "UPLOAD_FAILED" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const categoryId = new URL(request.url).searchParams.get("categoryId") || "";
    await assertCategoryManager(request, categoryId);
    await removeExisting(categoryId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "DELETE_FAILED";
    if (message === "CSRF_REQUIRED" || message === "FORBIDDEN") return NextResponse.json({ error: message }, { status: 403 });
    if (message === "UNAUTHENTICATED") return NextResponse.json({ error: message }, { status: 401 });
    if (message === "INVALID_ID" || message === "NOT_FOUND") return NextResponse.json({ error: message }, { status: 404 });
    return NextResponse.json({ error: "DELETE_FAILED" }, { status: 500 });
  }
}
