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

function readMetadata(raw: string): { meta: ProductMeta; description: string } | null {
  if (!raw.startsWith(META_PREFIX)) return null;

  const jsonStart = raw.indexOf("{", META_PREFIX.length);
  if (jsonStart < 0) return null;

  // Older products were saved without the newline that the current encoder adds.
  // Parse the first complete JSON object instead of depending on that formatting detail.
  for (let end = jsonStart + 1; end <= raw.length; end += 1) {
    if (raw[end - 1] !== "}") continue;
    try {
      const meta = JSON.parse(raw.slice(jsonStart, end)) as ProductMeta;
      const description = raw.slice(end).replace(/^\r?\n/, "").trim();
      return { meta, description };
    } catch {
      // Keep scanning until the complete JSON object is reached.
    }
  }

  return null;
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
  const parsed = readMetadata(raw);

  if (!parsed) {
    return { description: raw || null, imageUrl: null, brand: null, unit: null };
  }

  const { meta, description } = parsed;
  return {
    description: description || null,
    imageUrl: safeImageUrl(meta.imageUrl),
    brand: typeof meta.brand === "string" && meta.brand.trim() ? meta.brand.trim() : null,
    unit: typeof meta.unit === "string" && meta.unit.trim() ? meta.unit.trim() : null,
  };
}
