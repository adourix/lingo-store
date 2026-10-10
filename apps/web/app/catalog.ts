import { headers } from "next/headers";

export type CatalogProduct = {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  priceMinor: string | number;
};

export type CatalogResult = { products: CatalogProduct[]; error: boolean };

function isCatalogProduct(value: unknown): value is CatalogProduct {
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
    (typeof value.priceMinor === "string" || typeof value.priceMinor === "number")
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

  // Direct local Next.js access has a loopback host. In that case keep the
  // configured public surface instead of sending 127.0.0.1 to the API.
  if (host === "127.0.0.1" || host === "localhost" || host === "::1" || !host)
    return configuredPublicHost();

  return host;
}

export async function getCatalog(): Promise<CatalogResult> {
  const base = process.env.API_INTERNAL_URL || "http://127.0.0.1:4000";
  try {
    const publicHost = await requestPublicHost();
    const response = await fetch(base + "/api/public/products", {
      headers: {
        // The API deliberately isolates public/admin/POS surfaces by host.
        // SSR talks to the private API listener, so forward the public host
        // represented by the incoming storefront request.
        "x-forwarded-host": publicHost,
      },
      next: { revalidate: 30 },
    });
    if (!response.ok) return { products: [], error: true };
    const body: unknown = await response.json();
    if (!Array.isArray(body) || !body.every(isCatalogProduct)) return { products: [], error: true };
    return { products: body, error: false };
  } catch {
    return { products: [], error: true };
  }
}
