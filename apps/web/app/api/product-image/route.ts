import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const ALLOWED_HOSTS = new Set(["lingostore.store", "www.lingostore.store"]);

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("url");
  if (!raw) return new Response("Missing image URL", { status: 400 });

  let target: URL;
  try {
    target = new URL(raw, "https://lingostore.store");
  } catch {
    return new Response("Invalid image URL", { status: 400 });
  }

  if (!ALLOWED_HOSTS.has(target.hostname.toLowerCase()) || !/^\\/uploads\\/products\\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(?:jpe?g|png|webp)$/i.test(target.pathname)) {
    return new Response("Image URL is not allowed", { status: 403 });
  }

  try {
    const upstream = await fetch(target, { cache: "no-store" });
    if (!upstream.ok || !upstream.body) return new Response("Product image unavailable", { status: upstream.status || 502 });

    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": upstream.headers.get("content-type") || "image/jpeg",
        "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Product image unavailable", { status: 502 });
  }
}
