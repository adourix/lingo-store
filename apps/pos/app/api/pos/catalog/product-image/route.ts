import { NextResponse } from "next/server";

const CATALOG_IMAGE_ORIGIN =
  process.env.CATALOG_IMAGE_ORIGIN ||
  process.env.PUBLIC_ORIGIN ||
  "https://lingostore.store";

function allowedImageUrl(value: string): URL | null {
  try {
    const publicOrigin = new URL(CATALOG_IMAGE_ORIGIN);
    const url = new URL(value, publicOrigin);
    if (url.hostname !== publicOrigin.hostname) return null;
    if (!/^\/uploads\/products\/[a-f0-9-]+\.(?:png|jpe?g|webp)$/i.test(url.pathname)) return null;
    if (url.pathname.includes("..")) return null;
    return new URL(url.pathname, `${publicOrigin.protocol}//${publicOrigin.host}`);
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const value = new URL(request.url).searchParams.get("url") || "";
  const target = allowedImageUrl(value);
  if (!target) return new NextResponse("Not found", { status: 404 });

  try {
    const response = await fetch(target, {
      cache: "no-store",
      redirect: "error",
      headers: { accept: "image/png,image/jpeg,image/webp,image/*;q=0.8" },
    });
    if (!response.ok) return new NextResponse("Not found", { status: response.status });

    const contentType = (response.headers.get("content-type") || "")
      .split(";", 1)[0]
      .toLowerCase();
    if (!["image/png", "image/jpeg", "image/webp"].includes(contentType)) {
      return new NextResponse("Unsupported image", { status: 415 });
    }

    return new NextResponse(await response.arrayBuffer(), {
      status: 200,
      headers: {
        "content-type": contentType,
        "cache-control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return new NextResponse("Image unavailable", { status: 502 });
  }
}
