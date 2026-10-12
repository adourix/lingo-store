import { NextResponse } from "next/server";

const PUBLIC_ORIGIN = process.env.PUBLIC_ORIGIN || "https://lingostore.store";

function allowedImageUrl(value: string): URL | null {
  try {
    const url = new URL(value, PUBLIC_ORIGIN);
    const allowedHost = new URL(PUBLIC_ORIGIN).hostname;
    if (url.hostname !== allowedHost) return null;
    if (!/^\/uploads\/products\/[a-f0-9-]+\.(?:png|jpe?g|webp)$/i.test(url.pathname)) return null;
    if (url.pathname.includes("..") || url.protocol !== "https:") return null;
    return url;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const value = new URL(request.url).searchParams.get("url") || "";
  const target = allowedImageUrl(value);
  if (!target) return new NextResponse("Not found", { status: 404 });

  const response = await fetch(target, { cache: "no-store" });
  if (!response.ok) return new NextResponse("Not found", { status: response.status });

  const contentType = (response.headers.get("content-type") || "").split(";", 1)[0].toLowerCase();
  const allowedContentTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
  if (!allowedContentTypes.has(contentType)) return new NextResponse("Unsupported image", { status: 415 });

  return new NextResponse(await response.arrayBuffer(), {
    status: 200,
    headers: {
      "content-type": contentType,
      "cache-control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
      "x-content-type-options": "nosniff",
    },
  });
}
