import { NextResponse } from "next/server";

function allowedImageUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    const publicOrigin = process.env.PUBLIC_ORIGIN || "https://lingostore.store";
    const allowedHost = new URL(publicOrigin).hostname;
    if (url.hostname !== allowedHost) return null;
    if (url.pathname.includes("..") || !/^\/uploads\/products\/[a-f0-9-]+\.png$/i.test(url.pathname)) return null;
    if (url.protocol !== "https:") return null;
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

  const contentType = response.headers.get("content-type") || "image/png";
  if (contentType !== "image/png") return new NextResponse("Unsupported image", { status: 415 });
  return new NextResponse(await response.arrayBuffer(), {
    status: 200,
    headers: {
      "content-type": "image/png",
      "cache-control": "public, max-age=86400, immutable",
      "x-content-type-options": "nosniff",
    },
  });
}
