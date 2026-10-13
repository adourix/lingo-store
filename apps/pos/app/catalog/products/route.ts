import { NextRequest, NextResponse } from "next/server";

const API_INTERNAL_URL = process.env.API_INTERNAL_URL || "http://127.0.0.1:4000";
const CATALOG_IMAGE_ORIGIN =
  process.env.CATALOG_IMAGE_ORIGIN ||
  process.env.PUBLIC_ORIGIN ||
  "https://lingostore.store";

function toImageProxyUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const publicOrigin = new URL(CATALOG_IMAGE_ORIGIN);
    const url = new URL(value.trim(), publicOrigin);
    if (url.hostname !== publicOrigin.hostname) return null;
    if (!/^\/uploads\/products\/[a-f0-9-]+\.(?:jpg|jpeg|png|webp)$/i.test(url.pathname)) return null;
    return `/api/pos/catalog/product-image?url=${encodeURIComponent(url.pathname)}`;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const origin = new URL(CATALOG_IMAGE_ORIGIN);
    const cookie = request.headers.get("cookie");
    const response = await fetch(`${API_INTERNAL_URL}/api/pos/catalog/products`, {
      headers: {
        accept: "application/json",
        origin: origin.origin,
        "x-forwarded-host": origin.hostname,
        "x-forwarded-proto": origin.protocol.replace(":", ""),
        ...(cookie ? { cookie } : {}),
      },
      cache: "no-store",
    });
    const body: unknown = await response.json().catch(() => ({ error: "PRODUCT_CATALOG_FAILED" }));
    if (!response.ok) return NextResponse.json(body, { status: response.status });
    if (!Array.isArray(body)) return NextResponse.json({ error: "PRODUCT_CATALOG_FAILED" }, { status: 502 });

    return NextResponse.json(
      body.map((product) => {
        if (!product || typeof product !== "object") return product;
        const row = product as Record<string, unknown>;
        return {
          id: String(row.id || ""),
          sku: String(row.sku || ""),
          barcode: row.barcode == null ? null : String(row.barcode),
          name: String(row.name || ""),
          priceMinor: row.priceMinor ?? 0,
          stock: row.stock ?? 0,
          version: Number(row.version || 0),
          imageUrl: toImageProxyUrl(row.imageUrl),
          category: row.category ?? null,
        };
      }),
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "PRODUCT_CATALOG_FAILED" }, { status: 502 });
  }
}
