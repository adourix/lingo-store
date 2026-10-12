import { NextResponse } from "next/server";

const API = process.env.API_INTERNAL_URL || "http://127.0.0.1:4000";
const META_PREFIX = "[[LINGO_PRODUCT_META]]";
const PUBLIC_ORIGIN = process.env.PUBLIC_ORIGIN || "https://lingostore.store";

type PublicProduct = {
  id?: unknown;
  description?: unknown;
  category?: { id?: unknown; name?: unknown; description?: unknown } | null;
};

function originHost(value: string | undefined, fallback: string): string {
  try {
    return new URL(value || fallback).hostname;
  } catch {
    return fallback;
  }
}

function originProto(value: string | undefined): string {
  try {
    return new URL(value || "http://127.0.0.1:4000").protocol.replace(":", "");
  } catch {
    return "http";
  }
}

function safeImageUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const raw = value.trim();
  try {
    const url = new URL(raw, PUBLIC_ORIGIN);
    if (url.hostname !== new URL(PUBLIC_ORIGIN).hostname) return null;
    if (!/^\/uploads\/products\/[a-f0-9-]+\.(?:jpg|jpeg|png|webp)$/i.test(url.pathname)) return null;
    if (url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function extractImageUrl(description: unknown): string | null {
  if (typeof description !== "string" || !description.startsWith(META_PREFIX)) return null;
  const jsonStart = description.indexOf("{", META_PREFIX.length);
  if (jsonStart < 0) return null;

  // The storefront accepts both relative upload paths and absolute public URLs.
  for (let end = jsonStart + 1; end <= description.length; end += 1) {
    if (description[end - 1] !== "}") continue;
    try {
      const meta = JSON.parse(description.slice(jsonStart, end)) as { imageUrl?: unknown };
      return safeImageUrl(meta.imageUrl);
    } catch {
      // Continue until the complete metadata object is found.
    }
  }
  return null;
}

export async function GET(request: Request) {
  const cookie = request.headers.get("cookie") || "";
  const posOrigin = process.env.POS_ORIGIN || request.url;

  const posResponse = await fetch(`${API}/api/pos/catalog/products`, {
    headers: {
      cookie,
      "x-forwarded-host": originHost(posOrigin, new URL(request.url).hostname),
      "x-forwarded-proto": originProto(posOrigin),
    },
    cache: "no-store",
  });
  if (!posResponse.ok) {
    return new NextResponse(await posResponse.text(), {
      status: posResponse.status,
      headers: { "content-type": "application/json" },
    });
  }

  const products = (await posResponse.json()) as Array<Record<string, unknown>>;
  const publicResponse = await fetch(`${API}/api/public/products`, {
    headers: {
      "x-forwarded-host": new URL(PUBLIC_ORIGIN).hostname,
      "x-forwarded-proto": new URL(PUBLIC_ORIGIN).protocol.replace(":", ""),
    },
    cache: "no-store",
  });
  const publicProducts: PublicProduct[] = publicResponse.ok ? ((await publicResponse.json()) as PublicProduct[]) : [];

  const publicById = new Map<string, PublicProduct>();
  for (const product of publicProducts) {
    if (typeof product.id === "string" && product.id) publicById.set(product.id, product);
  }

  return NextResponse.json(
    products.map((product) => {
      const id = typeof product.id === "string" ? product.id : "";
      const publicProduct = publicById.get(id);
      const category = publicProduct?.category;
      const categoryValue =
        category && typeof category.id === "string" && typeof category.name === "string" && category.name.trim()
          ? {
              id: category.id,
              name: category.name.trim(),
              description: typeof category.description === "string" ? category.description : null,
            }
          : null;
      const imageUrl = extractImageUrl(publicProduct?.description);

      return {
        ...product,
        category: categoryValue,
        imageUrl: imageUrl ? `/api/catalog/product-image?url=${encodeURIComponent(imageUrl)}` : null,
      };
    }),
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
