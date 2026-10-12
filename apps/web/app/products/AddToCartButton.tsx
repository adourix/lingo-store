"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const CART_KEY = "lingo-cart-v1";
type CartLine = { productId: string; quantity: number };

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

export default function AddToCartButton({ productId }: { productId: string }) {
  const router = useRouter();
  const [added, setAdded] = useState(false);

  function addToCart() {
    addProduct(productId);
    setAdded(true);
  }

  function checkoutNow() {
    addProduct(productId);
    router.push("/checkout");
  }

  return (
    <>
      <div className="actions">
        <button className="button primary" onClick={addToCart} type="button">
          {added ? "Added to cart" : "Add to cart"}
        </button>
        <a className="button secondary" href="/cart">
          View cart
        </a>
        <button className="button secondary" onClick={checkoutNow} type="button">
          Checkout now
        </button>
      </div>
      {added && (
        <p role="status" aria-live="polite">
          Product added to your cart.
        </p>
      )}
    </>
  );
}
