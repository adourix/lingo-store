import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const DEFAULT_ROOT = "/home/abdulrahman/projects/lingo-store/.data/product-images";
const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

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

function validFilename(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:jpe?g|png|webp)$/i.test(value);
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ filename: string }> },
) {
  const { filename } = await context.params;
  if (!validFilename(filename)) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const extension = path.extname(filename).slice(1).toLowerCase();
  const contentType = CONTENT_TYPES[extension];
  if (!contentType) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

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

  return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
}
