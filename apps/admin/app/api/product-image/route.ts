import { cookies } from "next/headers";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

const MAX_BYTES = 5 * 1024 * 1024;
const DEFAULT_ROOT = "/home/abdulrahman/projects/lingo-store/.data/product-images";
function uploadRoot(): string { return process.env.PRODUCT_IMAGE_DIR || (process.env.NODE_ENV === "production" ? DEFAULT_ROOT : path.resolve(process.cwd(), "../../.data/product-images")); }
function publicOrigin(): string { return (process.env.PUBLIC_ORIGIN || "https://lingostore.store").replace(/\/$/, ""); }
function requestOrigin(request: Request): string {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host")?.split(":")[0]?.trim();
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const proto = forwardedProto || new URL(request.url).protocol.replace(":", "");
  if (!host) throw new Error("ADMIN_ORIGIN_REQUIRED");
  return `${proto}://${host}`;
}
async function assertAdmin(request: Request): Promise<void> {
  const cookieStore = await cookies();
  const cookieHeader = request.headers.get("cookie") || cookieStore.toString();
  const csrfCookie = cookieStore.get("__Host-lingo_admin_csrf")?.value || "";
  const csrfHeader = request.headers.get("x-csrf-token") || "";
  if (!csrfCookie || csrfCookie !== csrfHeader) throw new Error("CSRF_REQUIRED");
  const api = process.env.API_INTERNAL_URL || "http://127.0.0.1:4000";
  const adminOrigin = requestOrigin(request);
  const response = await fetch(`${api}/api/admin/auth/me`, { headers: { cookie: cookieHeader, origin: adminOrigin, referer: `${adminOrigin}/`, "x-forwarded-host": new URL(adminOrigin).hostname, "x-forwarded-proto": new URL(adminOrigin).protocol.replace(":", "") }, cache: "no-store" });
  if (!response.ok) throw new Error("UNAUTHENTICATED");
}
type Extension = "png" | "jpg" | "webp";
function detectExtension(file: File, bytes: Buffer): Extension | null {
  if (file.type === "image/png" && bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "png";
  if (file.type === "image/jpeg" && bytes.length >= 3 && bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]))) return "jpg";
  if (file.type === "image/webp" && bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return "webp";
  return null;
}
export async function POST(request: Request) {
  try {
    await assertAdmin(request);
    const form = await request.formData();
    const value = form.get("file");
    if (!(value instanceof File)) return NextResponse.json({ error: "IMAGE_REQUIRED" }, { status: 400 });
    if (value.size <= 0 || value.size > MAX_BYTES) return NextResponse.json({ error: "IMAGE_TOO_LARGE" }, { status: 400 });
    const bytes = Buffer.from(await value.arrayBuffer());
    const extension = detectExtension(value, bytes);
    if (!extension) return NextResponse.json({ error: "UNSUPPORTED_IMAGE" }, { status: 400 });
    const filename = `${randomUUID()}.${extension}`;
    const root = uploadRoot();
    await mkdir(root, { recursive: true });
    await writeFile(path.join(root, filename), bytes, { flag: "wx" });
    return NextResponse.json({ imageUrl: `${publicOrigin()}/uploads/products/${filename}` });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UPLOAD_FAILED";
    if (message === "CSRF_REQUIRED") return NextResponse.json({ error: message }, { status: 403 });
    if (message === "UNAUTHENTICATED") return NextResponse.json({ error: message }, { status: 401 });
    return NextResponse.json({ error: "UPLOAD_FAILED" }, { status: 500 });
  }
}
export async function DELETE(request: Request) {
  try {
    await assertAdmin(request);
    const imageUrl = new URL(request.url).searchParams.get("imageUrl") || "";
    const publicPrefix = `${publicOrigin()}/uploads/products/`;
    const localPrefix = "/uploads/products/";
    if ((!imageUrl.startsWith(publicPrefix) && !imageUrl.startsWith(localPrefix)) || imageUrl.includes("..")) return NextResponse.json({ error: "INVALID_IMAGE" }, { status: 400 });
    await unlink(path.join(uploadRoot(), path.basename(imageUrl))).catch(() => undefined);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "DELETE_FAILED";
    if (message === "CSRF_REQUIRED") return NextResponse.json({ error: message }, { status: 403 });
    if (message === "UNAUTHENTICATED") return NextResponse.json({ error: message }, { status: 401 });
    return NextResponse.json({ error: "DELETE_FAILED" }, { status: 500 });
  }
}
