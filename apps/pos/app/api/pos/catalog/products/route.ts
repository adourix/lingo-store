import { NextResponse } from "next/server";

const API = process.env.API_INTERNAL_URL || "http://127.0.0.1:4000";
const META_PREFIX = "[[LINGO_PRODUCT_META]]";

type PublicProduct = {
  id?: unknown;
  description?: unknown;
  category?: { id?: unknown; name?: unknown } | null;
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

function extractImageUrl(description: unknown): string | null {
  if (typeof description !== "string" || !description.startsWith(META_PREFIX)) return null;
  const end = description.indexOf("}\n");
  if (end < META_PREFIX.length) return null;
  try {
    const meta = JSON.parse(description.slice(META_PREFIX.length, end + 1)) as { imageUrl?: unknown };
    if (typeof meta.imageUrl !== "string" || !meta.imageUrl.trim()) return null;
    const url = new URL(meta.imageUrl.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.pathname.startsWith("/uploads/products/") && !url.pathname.includes("..")) return url.toString();
    return null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const cookie = request.headers.get("cookie") || "";
  const posOrigin = process.env.POS_ORIGIN || request.url;
  const publicOrigin = process.env.PUBLIC_ORIGIN || request.url;

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
      "x-forwarded-host": originHost(publicOrigin, new URL(request.url).hostname),
      "x-forwarded-proto": originProto(publicOrigin),
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
        category && typeof category.id === "string" && typeof category.name === "string"
          ? { id: category.id, name: category.name }
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
