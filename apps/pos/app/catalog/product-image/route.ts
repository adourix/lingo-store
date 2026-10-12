import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

const DEFAULT_ROOT = "/home/abdulrahman/projects/lingo-store/.data/product-images";
const ROOT = process.env.PRODUCT_IMAGE_DIR || (process.env.NODE_ENV === "production" ? DEFAULT_ROOT : path.resolve(process.cwd(), "../../.data/product-images"));
const LEGACY_ROOTS = [
  path.resolve(process.cwd(), "../../apps/admin/.data/product-images"),
  path.resolve(process.cwd(), "../../.data/product-images"),
];
const TYPES: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

export async function GET(request: Request) {
  const filename = new URL(request.url).searchParams.get("file") || "";
  if (!/^[a-f0-9-]+\.(?:jpg|jpeg|png|webp)$/i.test(filename)) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const ext = path.extname(filename).slice(1).toLowerCase();
  for (const root of [ROOT, ...LEGACY_ROOTS]) {
    try {
      const bytes = await readFile(path.join(root, filename));
      const body = new ArrayBuffer(bytes.byteLength);
      new Uint8Array(body).set(bytes);
      return new NextResponse(body, { headers: { "content-type": TYPES[ext] || "application/octet-stream", "cache-control": "public, max-age=31536000, immutable", "x-content-type-options": "nosniff" } });
    } catch {
      // Try the next known shared/legacy storage location.
    }
  }
  return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
}
