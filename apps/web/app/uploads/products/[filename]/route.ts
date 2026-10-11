import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

const ROOT = process.env.PRODUCT_IMAGE_DIR || path.resolve(process.cwd(), "../../.data/product-images");
const LEGACY_ROOT = path.resolve(process.cwd(), "../../apps/admin/.data/product-images");
const TYPES: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

export async function GET(_request: Request, context: { params: Promise<{ filename: string }> }) {
  const { filename } = await context.params;
  if (!/^[a-f0-9-]+\.(?:jpg|jpeg|png|webp)$/i.test(filename))
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const ext = path.extname(filename).slice(1).toLowerCase();
  for (const root of [ROOT, LEGACY_ROOT]) {
    try {
      const bytes = await readFile(path.join(root, filename));
      return new NextResponse(bytes, {
        headers: {
          "content-type": TYPES[ext] || "application/octet-stream",
          "cache-control": "public, max-age=31536000, immutable",
          "x-content-type-options": "nosniff",
        },
      });
    } catch {
      // Try the legacy admin storage path before returning 404.
    }
  }
  return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
}
