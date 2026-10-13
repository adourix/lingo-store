import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

const DEFAULT_ROOT = "/home/abdulrahman/projects/lingo-store/.data/product-images";
const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

function safeFilename(value: string): string | null {
  let filename = value.trim();
  try {
    // Catalog API supplies an absolute public URL. Accept the constrained path too.
    const parsed = new URL(filename, "https://lingostore.store");
    if (parsed.hostname !== "lingostore.store" && parsed.hostname !== "www.lingostore.store") return null;
    filename = parsed.pathname;
  } catch {
    return null;
  }

  const match = filename.match(/^\/uploads\/products\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:jpe?g|png|webp))$/i);
  return match?.[1] ?? null;
}

function imageRoots(): string[] {
  const configured = process.env.PRODUCT_IMAGE_DIR?.trim();
  const roots = configured
    ? [path.resolve(configured)]
    : [
        DEFAULT_ROOT,
        path.resolve(process.cwd(), ".data/product-images"),
        path.resolve(process.cwd(), "../../.data/product-images"),
        path.resolve(process.cwd(), "apps/admin/.data/product-images"),
      ];
  return [...new Set(roots)];
}

export async function GET(request: Request) {
  const value = new URL(request.url).searchParams.get("url") || "";
  const filename = safeFilename(value);
  if (!filename) return new NextResponse("Not found", { status: 404 });

  const extension = path.extname(filename).slice(1).toLowerCase();
  const contentType = CONTENT_TYPES[extension];
  if (!contentType) return new NextResponse("Not found", { status: 404 });

  for (const root of imageRoots()) {
    try {
      const bytes = await readFile(path.join(root, filename));
      const body = new Uint8Array(bytes.byteLength);
      body.set(bytes);
      return new NextResponse(body, {
        headers: {
          "content-type": contentType,
          "cache-control": "public, max-age=31536000, immutable",
          "x-content-type-options": "nosniff",
        },
      });
    } catch {
      // Try the configured/default persistent storage roots.
    }
  }

  return new NextResponse("Not found", { status: 404 });
}
