"use client";

import { useState } from "react";

const CART_KEY = "lingo-cart-v1";

export default function AddToCartButton({ productId }: { productId: string }) {
  const [added, setAdded] = useState(false);
  function addToCart() {
    try {
      const current: unknown = JSON.parse(sessionStorage.getItem(CART_KEY) || "[]");
      const items = Array.isArray(current)
        ? current.filter(
            (entry): entry is { productId: string; quantity: number } =>
              Boolean(entry) &&
              typeof entry === "object" &&
              "productId" in entry &&
              typeof entry.productId === "string" &&
              "quantity" in entry &&
              typeof entry.quantity === "number" &&
              Number.isFinite(entry.quantity),
          )
        : [];
      const existing = items.find((item) => item.productId === productId);
      if (existing) existing.quantity = Math.min(999, existing.quantity + 1);
      else items.push({ productId, quantity: 1 });
      sessionStorage.setItem(CART_KEY, JSON.stringify(items));
      window.dispatchEvent(new Event("lingo-cart-updated"));
      setAdded(true);
    } catch {
      sessionStorage.setItem(CART_KEY, JSON.stringify([{ productId, quantity: 1 }]));
      window.dispatchEvent(new Event("lingo-cart-updated"));
      setAdded(true);
    }
  }

  return (
    <>
      <div className="actions">
        <button className="button primary" onClick={addToCart} type="button">
          {added ? "Added to cart" : "Add to cart"}
        </button>
        <a className="button secondary" href="/checkout">
          Checkout
        </a>
      </div>
      {added && (
        <p role="status" aria-live="polite">
          Product added to your cart.
        </p>
      )}
    </>
  );
}
