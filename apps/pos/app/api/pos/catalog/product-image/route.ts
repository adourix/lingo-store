import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

const PRODUCT_IMAGE_DIR = process.env.PRODUCT_IMAGE_DIR || "";

const EXTENSION_CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

function safeFilename(value: string): string | null {
  const filename = value.trim().split("/").pop() || "";
  if (!/^[a-f0-9-]+\.(?:png|jpe?g|webp)$/i.test(filename)) return null;
  return filename;
}

async function readProductImage(filename: string): Promise<Buffer | null> {
  const roots = PRODUCT_IMAGE_DIR
    ? [path.resolve(PRODUCT_IMAGE_DIR)]
    : [
        path.resolve(process.cwd(), ".data/product-images"),
        path.resolve(process.cwd(), "../../.data/product-images"),
      ];

  for (const root of roots) {
    const filePath = path.resolve(root, filename);
    if (path.dirname(filePath) !== root) continue;
    try {
      return await fs.readFile(filePath);
    } catch {
      // Try the next known project-root location.
    }
  }
  return null;
}

export async function GET(request: Request) {
  const value = new URL(request.url).searchParams.get("url") || "";
  const filename = safeFilename(value);
  if (!filename) return new NextResponse("Not found", { status: 404 });

  const extension = filename.split(".").pop()?.toLowerCase() || "";
  const contentType = EXTENSION_CONTENT_TYPES[extension];
  if (!contentType) return new NextResponse("Unsupported image", { status: 415 });

  const data = await readProductImage(filename);
  if (!data) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(data, {
    status: 200,
    headers: {
      "content-type": contentType,
      "cache-control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
      "x-content-type-options": "nosniff",
    },
  });
}
