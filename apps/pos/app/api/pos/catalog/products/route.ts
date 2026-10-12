import { NextResponse } from "next/server";
const API = process.env.API_INTERNAL_URL || "http://127.0.0.1:4000";
function originHost(v: string | undefined, f: string) {
  try {
    return new URL(v || f).hostname;
  } catch {
    return f;
  }
}
function originProto(v: string | undefined) {
  try {
    return new URL(v || "http://127.0.0.1:4000").protocol.replace(":", "");
  } catch {
    return "http";
  }
}
function safeImageUrl(v: unknown): string | null {
  if (typeof v !== "string" || !v.trim()) return null;
  try {
    const o = new URL(process.env.PUBLIC_ORIGIN || "https://lingostore.store"),
      u = new URL(v.trim(), o);
    if (
      u.hostname !== o.hostname ||
      !/^\/uploads\/products\/[a-f0-9-]+\.(?:jpg|jpeg|png|webp)$/i.test(u.pathname)
    )
      return null;
    return new URL(u.pathname, `${o.protocol}//${o.host}`).toString();
  } catch {
    return null;
  }
}
export async function GET(request: Request) {
  const cookie = request.headers.get("cookie") || "",
    posOrigin = process.env.POS_ORIGIN || request.url,
    response = await fetch(`${API}/api/pos/catalog/products`, {
      headers: {
        cookie,
        "x-forwarded-host": originHost(posOrigin, new URL(request.url).hostname),
        "x-forwarded-proto": originProto(posOrigin),
      },
      cache: "no-store",
    });
  if (!response.ok)
    return new NextResponse(await response.text(), {
      status: response.status,
      headers: { "content-type": "application/json" },
    });
  const products = (await response.json()) as Array<Record<string, unknown>>;
  return NextResponse.json(
    products.map((p) => {
      const imageUrl = safeImageUrl(p.imageUrl);
      return {
        ...p,
        imageUrl: imageUrl
          ? `/api/catalog/product-image?url=${encodeURIComponent(imageUrl)}`
          : null,
      };
    }),
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
