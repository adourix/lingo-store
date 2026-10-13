import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

const PRODUCT_IMAGE_DIR =
  process.env.PRODUCT_IMAGE_DIR || path.resolve(process.cwd(), ".data/product-images");

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

export async function GET(request: Request) {
  const value = new URL(request.url).searchParams.get("url") || "";
  const filename = safeFilename(value);
  if (!filename) return new NextResponse("Not found", { status: 404 });

  const extension = filename.split(".").pop()?.toLowerCase() || "";
  const contentType = EXTENSION_CONTENT_TYPES[extension];
  if (!contentType) return new NextResponse("Unsupported image", { status: 415 });

  try {
    const root = path.resolve(PRODUCT_IMAGE_DIR);
    const filePath = path.resolve(root, filename);
    if (path.dirname(filePath) !== root) return new NextResponse("Not found", { status: 404 });

    const data = await fs.readFile(filePath);
    return new NextResponse(data, {
      status: 200,
      headers: {
        "content-type": contentType,
        "cache-control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
