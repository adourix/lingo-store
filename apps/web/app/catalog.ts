import { headers } from "next/headers";
import { parseProductDescription } from "./product-meta";

export type CatalogProduct = {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  priceMinor: string | number;
  stock: number | null;
  category: { id: string; name: string; description: string | null } | null;
  imageUrl: string | null;
  brand: string | null;
  unit: string | null;
};

export type CatalogResult = { products: CatalogProduct[]; error: boolean };

type RawCatalogProduct = {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  priceMinor: string | number;
  stock?: number | string;
  category?: { id: string; name: string; description: string | null } | null;
};

function isCatalogProduct(value: unknown): value is RawCatalogProduct {
  if (value === null || typeof value !== "object") return false;
  if (!("id" in value) || typeof value.id !== "string") return false;
  if (!("sku" in value) || typeof value.sku !== "string") return false;
  if (!("name" in value) || typeof value.name !== "string") return false;
  if (!("description" in value) || (typeof value.description !== "string" && value.description !== null)) return false;
  if (!("priceMinor" in value) || (typeof value.priceMinor !== "string" && typeof value.priceMinor !== "number")) return false;
  if ("stock" in value && typeof value.stock !== "string" && typeof value.stock !== "number") return false;
  return true;
}

function normalizeImageUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const trimmed = value.trim();
  if (/^\/uploads\/products\/[a-f0-9-]+\.(?:jpg|jpeg|png|webp)$/i.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function storedImageUrl(description: string | null): string | null {
  if (typeof description !== "string" || !description.startsWith("[[LINGO_PRODUCT_META]]")) return null;
  const end = description.indexOf("}\n");
  if (end < 0) return null;
  try {
    const meta = JSON.parse(description.slice("[[LINGO_PRODUCT_META]]".length, end + 1)) as { imageUrl?: unknown };
    return normalizeImageUrl(meta.imageUrl);
  } catch {
    return null;
  }
}

function configuredPublicHost(): string {
  const publicOrigin = process.env.PUBLIC_ORIGIN;
  if (!publicOrigin) return "lingostore.example";
  try {
    return new URL(publicOrigin).hostname;
  } catch {
    return "lingostore.example";
  }
}

async function requestPublicHost(): Promise<string> {
  const requestHeaders = await headers();
  const forwardedHost = requestHeaders.get("x-forwarded-host")?.split(",", 1)[0]?.trim();
  const host = (forwardedHost || requestHeaders.get("host") || "").split(":", 1)[0].trim();
  if (host === "127.0.0.1" || host === "localhost" || host === "::1" || !host)
    return configuredPublicHost();
  return host;
}

export async function getCatalog(): Promise<CatalogResult> {
  const base = process.env.API_INTERNAL_URL || "http://127.0.0.1:4000";
  try {
    const publicHost = await requestPublicHost();
    const response = await fetch(base + "/api/public/products", {
      headers: { "x-forwarded-host": publicHost },
      next: { revalidate: 30 },
    });
    if (!response.ok) return { products: [], error: true };
    const body: unknown = await response.json();
    if (!Array.isArray(body) || !body.every(isCatalogProduct)) return { products: [], error: true };
    return {
      products: body.map((product) => {
        const meta = parseProductDescription(product.description);
        const stock = product.stock === undefined ? null : Number(product.stock);
        return {
          id: product.id,
          sku: product.sku,
          name: product.name,
          description: meta.description,
          priceMinor: product.priceMinor,
          stock: Number.isFinite(stock) ? stock : null,
          category: product.category ?? null,
          imageUrl: meta.imageUrl ?? storedImageUrl(product.description),
          brand: meta.brand,
          unit: meta.unit,
        };
      }),
      error: false,
    };
  } catch {
    return { products: [], error: true };
  }
}
