import { NextResponse } from "next/server";

const API = process.env.API_INTERNAL_URL || "http://127.0.0.1:4000";
const CATALOG_IMAGE_ORIGIN =
  process.env.CATALOG_IMAGE_ORIGIN || "https://lingostore.store";

function originHost(v: string | undefined, fallback: string) {
  try {
    return new URL(v || fallback).hostname;
  } catch {
    return fallback;
  }
}

function originProto(v: string | undefined) {
  try {
    return new URL(v || "http://127.0.0.1:4000").protocol.replace(":", "");
  } catch {
    return "http";
  }
}

function safeImageUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const origin = new URL(CATALOG_IMAGE_ORIGIN);
    const url = new URL(value.trim(), origin);
    if (
      url.hostname !== origin.hostname ||
      !/^\/uploads\/products\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:jpe?g|png|webp)$/i.test(
        url.pathname,
      )
    ) {
      return null;
    }
    return new URL(url.pathname, `${origin.protocol}//${origin.host}`).toString();
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const cookie = request.headers.get("cookie") || "";
  const posOrigin = process.env.POS_ORIGIN || request.url;
  const response = await fetch(`${API}/api/pos/catalog/products`, {
    headers: {
      cookie,
      "x-forwarded-host": originHost(posOrigin, new URL(request.url).hostname),
      "x-forwarded-proto": originProto(posOrigin),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return new NextResponse(await response.text(), {
      status: response.status,
      headers: { "content-type": "application/json" },
    });
  }

  const products = (await response.json()) as Array<Record<string, unknown>>;

  return NextResponse.json(
    products.map((product) => {
      const imageUrl = safeImageUrl(product.imageUrl);
      return {
        ...product,
        // Keep image delivery inside the POS /api/pos/* namespace. The production
        // reverse proxy intentionally exposes only /api/pos/* on the POS host.
        imageUrl: imageUrl
          ? `/api/pos/catalog/product-image?url=${encodeURIComponent(imageUrl)}`
          : null,
      };
    }),
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
