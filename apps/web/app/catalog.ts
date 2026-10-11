import { headers } from "next/headers";
import { parseProductDescription } from "./product-meta";

export type CatalogProduct = {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  priceMinor: string | number;
  stock: number;
  category: { id: string; name: string; description: string | null } | null;
  imageUrl: string | null;
  brand: string | null;
  unit: string | null;
};

export type CatalogResult = { products: CatalogProduct[]; error: boolean };

function isCatalogProduct(value: unknown): value is {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  priceMinor: string | number;
  stock: number | string;
  category?: { id: string; name: string; description: string | null } | null;
} {
  return (
    value !== null &&
    typeof value === "object" &&
    "id" in value &&
    typeof value.id === "string" &&
    "sku" in value &&
    typeof value.sku === "string" &&
    "name" in value &&
    typeof value.name === "string" &&
    "description" in value &&
    (typeof value.description === "string" || value.description === null) &&
    "priceMinor" in value &&
    (typeof value.priceMinor === "string" || typeof value.priceMinor === "number") &&
    "stock" in value &&
    (typeof value.stock === "string" || typeof value.stock === "number")
  );
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
        return {
          id: product.id,
          sku: product.sku,
          name: product.name,
          description: meta.description,
          priceMinor: product.priceMinor,
          stock: Number(product.stock),
          category: product.category ?? null,
          imageUrl: meta.imageUrl,
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
