"use client";

import { useEffect } from "react";

const CART_KEY = "lingo-cart-v1";

type CartLine = { quantity?: unknown };

function readCount(): number {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(CART_KEY) || "[]");
    if (!Array.isArray(value)) return 0;
    return value.reduce((total, item: CartLine) => {
      const quantity = item?.quantity;
      return typeof quantity === "number" && Number.isFinite(quantity) && quantity > 0 ? total + quantity : total;
    }, 0);
  } catch {
    return 0;
  }
}

function sync() {
  const count = readCount();
  document.querySelectorAll<HTMLElement>(".header-cart").forEach((cart) => {
    let badge = cart.querySelector<HTMLElement>(".header-cart-count");
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "header-cart-count";
      cart.appendChild(badge);
    }
    badge.textContent = count > 99 ? "99+" : String(count);
    badge.setAttribute("aria-label", `${count} items in cart`);
    cart.setAttribute("aria-label", `Cart, ${count} items`);
  });
}

export default function CartBadgeSync() {
  useEffect(() => {
    const run = () => sync();
    run();
    window.addEventListener("lingo-cart-updated", run);
    window.addEventListener("storage", run);
    const observer = new MutationObserver(run);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      window.removeEventListener("lingo-cart-updated", run);
      window.removeEventListener("storage", run);
      observer.disconnect();
    };
  }, []);
  return null;
}
