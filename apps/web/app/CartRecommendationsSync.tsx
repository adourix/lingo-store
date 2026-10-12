"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import RecommendedProducts from "./RecommendedProducts";
import { parseProductDescription } from "./product-meta";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";
const CART_KEY = "lingo-cart-v1";

type CartLine = { productId?: unknown };
type Product = {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  priceMinor: string | number;
  imageUrl?: string | null;
  brand?: string | null;
  stock?: number | string | null;
  category?: { id: string; name: string } | null;
};

function cartIds(): string[] {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(CART_KEY) || "[]");
    if (!Array.isArray(value)) return [];
    return value.map((line: CartLine) => typeof line?.productId === "string" ? line.productId : "").filter(Boolean);
  } catch {
    return [];
  }
}

export default function CartRecommendationsSync() {
  const [products, setProducts] = useState<Product[]>([]);
  const [mounted, setMounted] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (window.location.pathname !== "/cart") return;
    setMounted(true);
    const sync = () => {
      const section = document.querySelector<HTMLElement>(".cart-section");
      setShow(Boolean(section && !section.querySelector(".cart-related")));
    };
    sync();
    window.addEventListener("lingo-cart-updated", sync);
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    fetch(API + "/public/products", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const body: unknown = await response.json();
        if (Array.isArray(body)) {
          setProducts((body as Product[]).map((product) => ({ ...product, imageUrl: product.imageUrl || parseProductDescription(product.description).imageUrl })));
        }
      })
      .catch(() => undefined);
    return () => {
      window.removeEventListener("lingo-cart-updated", sync);
      observer.disconnect();
    };
  }, []);

  if (!mounted || !show || products.length === 0) return null;
  return createPortal(<RecommendedProducts products={products} excludeIds={cartIds()} title="You may also like" />, document.querySelector(".cart-section") as HTMLElement);
}
