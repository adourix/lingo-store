const META_PREFIX = "[[LINGO_PRODUCT_META]]";

type ProductMeta = {
  imageUrl?: string;
  brand?: string;
  unit?: string;
};

export type ParsedProductMeta = {
  description: string | null;
  imageUrl: string | null;
  brand: string | null;
  unit: string | null;
};

function safeImageUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function encodeProductDescription(description: string, meta: ProductMeta): string | null {
  const clean = description.trim();
  const payload: ProductMeta = {};
  const imageUrl = safeImageUrl(meta.imageUrl);
  if (imageUrl) payload.imageUrl = imageUrl;
  if (meta.brand?.trim()) payload.brand = meta.brand.trim().slice(0, 120);
  if (meta.unit?.trim()) payload.unit = meta.unit.trim().slice(0, 40);
  if (Object.keys(payload).length === 0) return clean || null;
  return `${META_PREFIX}${JSON.stringify(payload)}${clean ? `\n${clean}` : ""}`;
}

export function parseProductDescription(value: string | null | undefined): ParsedProductMeta {
  const raw = typeof value === "string" ? value : "";
  if (!raw.startsWith(META_PREFIX)) {
    return { description: raw || null, imageUrl: null, brand: null, unit: null };
  }
  const end = raw.indexOf("}\n");
  if (end < META_PREFIX.length) {
    return { description: raw || null, imageUrl: null, brand: null, unit: null };
  }
  try {
    const meta = JSON.parse(raw.slice(META_PREFIX.length, end + 1)) as ProductMeta;
    const description = raw.slice(end + 2).trim();
    return {
      description: description || null,
      imageUrl: safeImageUrl(meta.imageUrl),
      brand: typeof meta.brand === "string" && meta.brand.trim() ? meta.brand.trim() : null,
      unit: typeof meta.unit === "string" && meta.unit.trim() ? meta.unit.trim() : null,
    };
  } catch {
    return { description: raw || null, imageUrl: null, brand: null, unit: null };
  }
}
