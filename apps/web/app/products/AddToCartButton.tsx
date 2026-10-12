"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const CART_KEY = "lingo-cart-v1";
type CartLine = { productId: string; quantity: number };
type PublicProduct = { id: string; stock?: number | string | null };

function readCart(): CartLine[] {
  try {
    const current: unknown = JSON.parse(sessionStorage.getItem(CART_KEY) || "[]");
    if (!Array.isArray(current)) return [];
    return current.filter(
      (entry): entry is CartLine =>
        Boolean(entry) &&
        typeof entry === "object" &&
        "productId" in entry &&
        typeof entry.productId === "string" &&
        "quantity" in entry &&
        typeof entry.quantity === "number" &&
        Number.isFinite(entry.quantity) &&
        entry.quantity > 0 &&
        entry.quantity <= 999,
    );
  } catch {
    return [];
  }
}

function addProduct(productId: string): void {
  const items = readCart();
  const existing = items.find((item) => item.productId === productId);
  if (existing) existing.quantity = Math.min(999, existing.quantity + 1);
  else items.push({ productId, quantity: 1 });
  sessionStorage.setItem(CART_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event("lingo-cart-updated"));
}

export default function AddToCartButton({ productId, compact = false }: { productId: string; compact?: boolean }) {
  const router = useRouter();
  const [added, setAdded] = useState(false);
  const [outOfStock, setOutOfStock] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/public/products", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const body: unknown = await response.json();
        if (!active || !Array.isArray(body)) return;
        const product = (body as PublicProduct[]).find((item) => item.id === productId);
        if (product && product.stock !== null && product.stock !== undefined && Number(product.stock) <= 0) setOutOfStock(true);
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [productId]);

  function addToCart() {
    if (outOfStock) return;
    addProduct(productId);
    setAdded(true);
  }

  function checkoutNow() {
    if (outOfStock) return;
    addProduct(productId);
    router.push("/checkout");
  }

  if (compact) {
    return (
      <button className="button primary" onClick={addToCart} type="button" disabled={outOfStock} aria-disabled={outOfStock}>
        <span aria-hidden="true">🛒</span> {outOfStock ? "Out of stock" : added ? "Added" : "Add to cart"}
      </button>
    );
  }

  return (
    <>
      <div className="actions">
        <button className="button primary" onClick={addToCart} type="button" disabled={outOfStock} aria-disabled={outOfStock}>
          {outOfStock ? "Out of stock" : added ? "Added to cart" : "Add to cart"}
        </button>
        <a className="button secondary" href="/cart">
          View cart
        </a>
        <button className="button secondary" onClick={checkoutNow} type="button" disabled={outOfStock} aria-disabled={outOfStock}>
          Checkout now
        </button>
      </div>
      {added && !outOfStock && (
        <p role="status" aria-live="polite">
          Product added to your cart.
        </p>
      )}
    </>
  );
}
