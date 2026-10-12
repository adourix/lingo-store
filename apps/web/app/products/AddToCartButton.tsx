"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./ProductDetail.module.css";

const CART_KEY = "lingo-cart-v1";
const WISHLIST_KEY = "lingo-wishlist-v1";
type CartLine = { productId: string; quantity: number };
type PublicProduct = { id: string; stock?: number | string | null };

function readCart(): CartLine[] {
  try {
    const current: unknown = JSON.parse(sessionStorage.getItem(CART_KEY) || "[]");
    if (!Array.isArray(current)) return [];
    return current.filter(
      (entry): entry is CartLine => Boolean(entry) && typeof entry === "object" && "productId" in entry && typeof entry.productId === "string" && "quantity" in entry && typeof entry.quantity === "number" && Number.isFinite(entry.quantity) && entry.quantity > 0 && entry.quantity <= 999,
    );
  } catch { return []; }
}

function addProduct(productId: string, quantity: number): void {
  const items = readCart();
  const existing = items.find((item) => item.productId === productId);
  if (existing) existing.quantity = Math.min(999, existing.quantity + quantity);
  else items.push({ productId, quantity });
  sessionStorage.setItem(CART_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event("lingo-cart-updated"));
}

function readWishlist(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(WISHLIST_KEY) || "[]");
    return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : [];
  } catch { return []; }
}

export default function AddToCartButton({ productId, compact = false }: { productId: string; compact?: boolean }) {
  const router = useRouter();
  const [added, setAdded] = useState(false);
  const [outOfStock, setOutOfStock] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [maxStock, setMaxStock] = useState<number | null>(null);
  const [wishlisted, setWishlisted] = useState(false);
  const [shareLabel, setShareLabel] = useState("Share product");

  useEffect(() => {
    let active = true;
    setWishlisted(readWishlist().includes(productId));
    fetch("/api/public/products", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const body: unknown = await response.json();
        if (!active || !Array.isArray(body)) return;
        const product = (body as PublicProduct[]).find((item) => item.id === productId);
        if (!product) return;
        if (product.stock !== null && product.stock !== undefined) {
          const stock = Number(product.stock);
          if (Number.isFinite(stock)) {
            setMaxStock(Math.max(0, stock));
            if (stock <= 0) setOutOfStock(true);
          }
        }
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [productId]);

  function changeQuantity(next: number) {
    const upper = maxStock === null ? 999 : Math.max(1, Math.min(999, maxStock));
    setQuantity(Math.max(1, Math.min(upper, next)));
  }

  function addToCart() {
    if (outOfStock) return;
    addProduct(productId, quantity);
    setAdded(true);
  }

  function checkoutNow() {
    if (outOfStock) return;
    addProduct(productId, quantity);
    router.push("/checkout");
  }

  function toggleWishlist() {
    const current = readWishlist();
    const next = current.includes(productId) ? current.filter((id) => id !== productId) : [...current, productId];
    localStorage.setItem(WISHLIST_KEY, JSON.stringify(next));
    setWishlisted(next.includes(productId));
  }

  async function shareProduct() {
    const shareData = { title: document.title, url: window.location.href };
    try {
      if (navigator.share) await navigator.share(shareData);
      else {
        await navigator.clipboard.writeText(window.location.href);
        setShareLabel("Link copied");
        window.setTimeout(() => setShareLabel("Share product"), 1800);
      }
    } catch { /* user cancelled native sharing */ }
  }

  if (compact) {
    return <button className="button primary" onClick={addToCart} type="button" disabled={outOfStock} aria-disabled={outOfStock}>{outOfStock ? "Out of stock" : added ? "Added" : "Add to cart"}</button>;
  }

  return (
    <div className={styles.purchaseArea}>
      <div className={styles.quantityBlock}>
        <div className={styles.quantityLabelRow}>
          <span>Quantity</span>
          {maxStock !== null && <small>{maxStock} available</small>}
        </div>
        <div className={styles.quantityAndAdd}>
          <div className={styles.quantityControl} aria-label="Product quantity">
            <button type="button" onClick={() => changeQuantity(quantity - 1)} disabled={outOfStock || quantity <= 1} aria-label="Decrease quantity">−</button>
            <strong aria-live="polite">{quantity}</strong>
            <button type="button" onClick={() => changeQuantity(quantity + 1)} disabled={outOfStock || (maxStock !== null && quantity >= maxStock)} aria-label="Increase quantity">+</button>
          </div>
          <button className={styles.addButton} onClick={addToCart} type="button" disabled={outOfStock} aria-disabled={outOfStock}>
            {outOfStock ? "Out of stock" : added ? "Added to cart" : "Add to cart"}
          </button>
        </div>
      </div>
      <div className={styles.secondaryActions}>
        <button className={styles.secondaryButton} type="button" onClick={toggleWishlist}>{wishlisted ? "♥  In wishlist" : "♡  Add to wishlist"}</button>
        <button className={styles.secondaryButton} type="button" onClick={shareProduct}>{shareLabel}</button>
      </div>
      {added && !outOfStock && <p className={styles.purchaseStatus} role="status" aria-live="polite">Product added to your cart.</p>}
      <button className={styles.checkoutButton} type="button" onClick={checkoutNow} disabled={outOfStock}>Checkout now</button>
    </div>
  );
}
