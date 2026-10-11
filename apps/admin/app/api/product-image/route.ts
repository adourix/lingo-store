import { cookies, headers } from "next/headers";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

function uploadRoot(): string {
  return process.env.PRODUCT_IMAGE_DIR || path.resolve(process.cwd(), "../web/public/uploads/products");
}

async function assertAdmin(): Promise<void> {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const cookieHeader = cookieStore.toString();
  const csrfCookie = cookieStore.get("__Host-lingo_admin_csrf")?.value || "";
  const csrfHeader = headerStore.get("x-csrf-token") || "";
  if (!csrfCookie || csrfCookie !== csrfHeader) throw new Error("CSRF_REQUIRED");
  const api = process.env.API_INTERNAL_URL || "http://127.0.0.1:4000";
  const adminOrigin = process.env.ADMIN_ORIGIN || "https://admin.localhost";
  const response = await fetch(`${api}/api/admin/auth/me`, {
    headers: {
      cookie: cookieHeader,
      "x-forwarded-host": new URL(adminOrigin).hostname,
    },
    cache: "no-store",
  });
  if (!response.ok) throw new Error("UNAUTHENTICATED");
}

export async function POST(request: Request) {
  try {
    await assertAdmin();
    const form = await request.formData();
    const value = form.get("file");
    if (!(value instanceof File)) return NextResponse.json({ error: "IMAGE_REQUIRED" }, { status: 400 });
    const extension = ALLOWED.get(value.type);
    if (!extension) return NextResponse.json({ error: "UNSUPPORTED_IMAGE_TYPE" }, { status: 400 });
    if (value.size <= 0 || value.size > MAX_BYTES)
      return NextResponse.json({ error: "IMAGE_TOO_LARGE" }, { status: 400 });

    const bytes = Buffer.from(await value.arrayBuffer());
    if (bytes.length > MAX_BYTES) return NextResponse.json({ error: "IMAGE_TOO_LARGE" }, { status: 400 });
    const filename = `${randomUUID()}.${extension}`;
    const root = uploadRoot();
    await mkdir(root, { recursive: true });
    await writeFile(path.join(root, filename), bytes, { flag: "wx" });
    return NextResponse.json({ imageUrl: `/uploads/products/${filename}` });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UPLOAD_FAILED";
    if (message === "CSRF_REQUIRED") return NextResponse.json({ error: message }, { status: 403 });
    if (message === "UNAUTHENTICATED") return NextResponse.json({ error: message }, { status: 401 });
    return NextResponse.json({ error: "UPLOAD_FAILED" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await assertAdmin();
    const imageUrl = new URL(request.url).searchParams.get("imageUrl") || "";
    if (!imageUrl.startsWith("/uploads/products/") || imageUrl.includes(".."))
      return NextResponse.json({ error: "INVALID_IMAGE" }, { status: 400 });
    await unlink(path.join(uploadRoot(), path.basename(imageUrl))).catch(() => undefined);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "DELETE_FAILED";
    if (message === "CSRF_REQUIRED") return NextResponse.json({ error: message }, { status: 403 });
    if (message === "UNAUTHENTICATED") return NextResponse.json({ error: message }, { status: 401 });
    return NextResponse.json({ error: "DELETE_FAILED" }, { status: 500 });
  }
}
