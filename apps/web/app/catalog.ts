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

export async function getCatalog(): Promise<CatalogResult> {
  const base = process.env.API_INTERNAL_URL || "http://127.0.0.1:4000";
  try {
    const response = await fetch(base + "/api/public/products", {
      headers: { host: new URL(process.env.PUBLIC_ORIGIN || "https://lingostore.example").host },
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
