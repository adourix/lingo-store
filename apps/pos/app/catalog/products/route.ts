import { NextResponse } from "next/server";

const API_INTERNAL_URL = process.env.API_INTERNAL_URL || "http://127.0.0.1:4000";
const PUBLIC_ORIGIN = process.env.PUBLIC_ORIGIN || "https://lingostore.store";
const META_PREFIX = "[[LINGO_PRODUCT_META]]";

function extractImageUrl(description: unknown): string | null {
  if (typeof description !== "string" || !description.startsWith(META_PREFIX)) return null;
  const end = description.indexOf("}\n");
  if (end < META_PREFIX.length) return null;
  try {
    const meta = JSON.parse(description.slice(META_PREFIX.length, end + 1)) as Record<string, unknown>;
    const value = meta.imageUrl;
    return typeof value === "string" && value.trim() ? value.trim() : null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const origin = new URL(PUBLIC_ORIGIN).origin;
  const response = await fetch(`${API_INTERNAL_URL}/api/public/products`, {
    headers: {
      accept: "application/json",
      origin,
      "x-forwarded-host": new URL(PUBLIC_ORIGIN).hostname,
      "x-forwarded-proto": new URL(PUBLIC_ORIGIN).protocol.replace(":", ""),
      cookie: request.headers.get("cookie") || "",
    },
    cache: "no-store",
  });

  const body: unknown = await response.json().catch(() => ({ error: "PRODUCT_CATALOG_FAILED" }));
  if (!response.ok) return NextResponse.json(body, { status: response.status });

  if (!Array.isArray(body)) return NextResponse.json({ error: "PRODUCT_CATALOG_FAILED" }, { status: 502 });

  const products = body.map((product) => {
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
      imageUrl: extractImageUrl(row.description),
      category: row.category ?? null,
    };
  });

  return NextResponse.json(products, {
    headers: { "cache-control": "no-store" },
  });
}
