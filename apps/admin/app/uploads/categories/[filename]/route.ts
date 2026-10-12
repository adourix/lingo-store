import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

const DEFAULT_ROOT = "/home/abdulrahman/projects/lingo-store/.data/category-images";
const ROOT = process.env.CATEGORY_IMAGE_DIR || (process.env.NODE_ENV === "production" ? DEFAULT_ROOT : path.resolve(process.cwd(), "../../.data/category-images"));
const LEGACY_ROOTS = [path.resolve(process.cwd(), "../../apps/admin/.data/category-images"), path.resolve(process.cwd(), "../../.data/category-images")];
const TYPES: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

export async function GET(_request: Request, context: { params: Promise<{ filename: string }> }) {
  const { filename } = await context.params;
  if (!/^[0-9a-f-]{36}\.(?:jpg|jpeg|png|webp)$/i.test(filename)) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
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
