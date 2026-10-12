import { NextResponse } from "next/server";

const API_INTERNAL_URL = process.env.API_INTERNAL_URL || "http://127.0.0.1:4000";
const PUBLIC_ORIGIN = process.env.PUBLIC_ORIGIN || "https://lingostore.store";
const META_PREFIX = "[[LINGO_PRODUCT_META]]";

function extractImageUrl(description: unknown): string | null {
  if (typeof description !== "string" || !description.startsWith(META_PREFIX)) return null;
  const jsonStart = description.indexOf("{", META_PREFIX.length);
  if (jsonStart < 0) return null;
  for (let end = jsonStart + 1; end <= description.length; end += 1) {
    if (description[end - 1] !== "}") continue;
    try {
      const meta = JSON.parse(description.slice(jsonStart, end)) as Record<string, unknown>;
      const value = meta.imageUrl;
      return typeof value === "string" && value.trim() ? value.trim() : null;
    } catch {}
  }
  return null;
}

function toSameOriginImageUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value, PUBLIC_ORIGIN);
    const publicUrl = new URL(PUBLIC_ORIGIN);
    if (url.origin !== publicUrl.origin || !url.pathname.startsWith("/uploads/products/")) return null;
    const filename = url.pathname.split("/").pop() || "";
    if (!/^[a-f0-9-]+\.(?:jpg|jpeg|png|webp)$/i.test(filename)) return null;
    return `/catalog/product-image?file=${encodeURIComponent(filename)}`;
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const publicUrl = new URL(PUBLIC_ORIGIN);
    const response = await fetch(`${API_INTERNAL_URL}/api/public/products`, {
      headers: {
        accept: "application/json",
        origin: publicUrl.origin,
        "x-forwarded-host": publicUrl.hostname,
        "x-forwarded-proto": publicUrl.protocol.replace(":", ""),
      },
      cache: "no-store",
    });
    const body: unknown = await response.json().catch(() => ({ error: "PRODUCT_CATALOG_FAILED" }));
    if (!response.ok) return NextResponse.json(body, { status: response.status });
    if (!Array.isArray(body)) return NextResponse.json({ error: "PRODUCT_CATALOG_FAILED" }, { status: 502 });
    return NextResponse.json(body.map((product) => {
      if (!product || typeof product !== "object") return product;
      const row = product as Record<string, unknown>;
      return {
        id: String(row.id || ""), sku: String(row.sku || ""),
        barcode: row.barcode == null ? null : String(row.barcode),
        name: String(row.name || ""), priceMinor: row.priceMinor ?? 0,
        stock: row.stock ?? 0, version: Number(row.version || 0),
        imageUrl: toSameOriginImageUrl(extractImageUrl(row.description)),
        category: row.category ?? null,
      };
    }), { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "PRODUCT_CATALOG_FAILED" }, { status: 502 });
  }
}
