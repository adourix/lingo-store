"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";
const CART_KEY = "lingo-cart-v1";
type CartLine = { productId: string; quantity: number };
type Product = { id: string; sku: string; name: string; priceMinor: string | number };
type CreatedOrder = { id: string; invoiceNo: string; status: string; totalMinor: string };

function isCart(value: unknown): value is CartLine[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        Boolean(item) &&
        typeof item === "object" &&
        "productId" in item &&
        typeof item.productId === "string" &&
        "quantity" in item &&
        typeof item.quantity === "number" &&
        Number.isFinite(item.quantity) &&
        item.quantity > 0 &&
        item.quantity <= 999,
    )
  );
}

function isProduct(value: unknown): value is Product {
  return (
    value !== null &&
    typeof value === "object" &&
    "id" in value &&
    typeof value.id === "string" &&
    "sku" in value &&
    typeof value.sku === "string" &&
    "name" in value &&
    typeof value.name === "string" &&
    "priceMinor" in value &&
    (typeof value.priceMinor === "string" || typeof value.priceMinor === "number")
  );
}

function formatMinor(value: string | number): string {
  const amount = BigInt(value);
  return `${new Intl.NumberFormat("en").format(amount / 100n)}.${(amount % 100n)
    .toString()
    .padStart(2, "0")} EGP`;
}

export default function CheckoutPage() {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loginRequired, setLoginRequired] = useState(false);
  const [order, setOrder] = useState<CreatedOrder | null>(null);

  useEffect(() => {
    try {
      const parsed: unknown = JSON.parse(sessionStorage.getItem(CART_KEY) || "[]");
      if (isCart(parsed)) setCart(parsed);
    } catch {
      setCart([]);
    }
    void fetch(API + "/public/products", { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Catalog is unavailable.");
        const result: unknown = await response.json();
        if (!Array.isArray(result) || !result.every(isProduct))
          throw new Error("Catalog response is invalid.");
        setProducts(result);
      })
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : "Unable to load catalog."),
      )
      .finally(() => setLoading(false));
  }, []);

  const catalog = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );
  const total = cart.reduce((sum, line) => {
    const product = catalog.get(line.productId);
    if (!product) return sum;
    const raw = BigInt(product.priceMinor) * BigInt(Math.round(line.quantity * 1000));
    return sum + (raw + 500n) / 1000n;
  }, 0n);

  function updateCart(next: CartLine[]) {
    setCart(next);
    sessionStorage.setItem(CART_KEY, JSON.stringify(next));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoginRequired(false);
    if (cart.length === 0) {
      setError("Your cart is empty.");
      return;
    }
    const unavailable = cart.find((line) => !catalog.has(line.productId));
    if (unavailable) {
      setError("A cart item is no longer available. Remove it and try again.");
      return;
    }
    setSaving(true);
    try {
      const csrfResponse = await fetch(API + "/auth/csrf", { credentials: "include" });
      if (!csrfResponse.ok) throw new Error("Checkout security token is unavailable.");
      const csrfData: unknown = await csrfResponse.json();
      if (!csrfData || typeof csrfData !== "object" || !("token" in csrfData))
        throw new Error("Checkout security token is invalid.");
      const idempotencyKey = crypto.randomUUID();
      const response = await fetch(API + "/account/orders", {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": String(csrfData.token),
          "idempotency-key": idempotencyKey,
        },
        body: JSON.stringify({
          idempotencyKey,
          items: cart.map(({ productId, quantity }) => ({ productId, quantity })),
          recipientName: name,
          recipientPhone: phone,
          shippingAddress: address,
          paymentMethod: "CASH",
        }),
      });
      const data: unknown = await response.json().catch(() => ({}));
      if (response.status === 401) {
        setLoginRequired(true);
        throw new Error("Sign in to place your order.");
      }
      if (!response.ok) {
        const message =
          data && typeof data === "object" && "error" in data
            ? String(data.error)
            : "Order could not be placed.";
        throw new Error(message);
      }
      if (
        !data ||
        typeof data !== "object" ||
        !("id" in data) ||
        !("invoiceNo" in data) ||
        !("totalMinor" in data)
      )
        throw new Error("Order response was invalid.");
      setOrder({
        id: String(data.id),
        invoiceNo: String(data.invoiceNo),
        status: "PENDING",
        totalMinor: String(data.totalMinor),
      });
      updateCart([]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Order could not be placed.");
    } finally {
      setSaving(false);
    }
  }

  if (order)
    return (
      <main className="container section">
        <section className="card" role="status">
          <h1>Order received</h1>
          <p>Order {order.invoiceNo} is awaiting store confirmation.</p>
          <p>Total: {formatMinor(order.totalMinor)}. Payment is cash on delivery.</p>
          <Link className="button primary" href="/account/orders">
            View my orders
          </Link>
        </section>
      </main>
    );

  return (
    <main className="site-shell">
      <header className="site-header">
        <div className="site-header-inner">
          <Link className="brand" href="/">
            Lingo Store
          </Link>
          <Link href="/products">Continue shopping</Link>
        </div>
      </header>
      <section className="container section">
        <h1>Checkout</h1>
        <p className="muted">Pay cash when your order is delivered.</p>
        {loading ? <p role="status">Loading your cart…</p> : null}
        {cart.length === 0 && !loading ? (
          <section className="card">
            <h2>Your cart is empty</h2>
            <Link href="/products">Browse products</Link>
          </section>
        ) : (
          <div className="checkout-layout">
            <section className="card" aria-labelledby="checkout-items-heading">
              <h2 id="checkout-items-heading">Your items</h2>
              <ul className="checkout-items">
                {cart.map((line) => {
                  const product = catalog.get(line.productId);
                  return (
                    <li key={line.productId}>
                      <div>
                        <strong>{product?.name || "Unavailable product"}</strong>
                        <p>{product ? formatMinor(product.priceMinor) : "Unavailable"}</p>
                      </div>
                      <label>
                        Quantity
                        <input
                          type="number"
                          min="1"
                          max="999"
                          step="0.001"
                          value={line.quantity}
                          onChange={(event) => {
                            const quantity = Number(event.target.value);
                            if (quantity <= 0)
                              updateCart(cart.filter((item) => item.productId !== line.productId));
                            else if (quantity <= 999 && Number.isFinite(quantity))
                              updateCart(
                                cart.map((item) =>
                                  item.productId === line.productId ? { ...item, quantity } : item,
                                ),
                              );
                          }}
                        />
                      </label>
                      <button
                        className="button secondary"
                        onClick={() =>
                          updateCart(cart.filter((item) => item.productId !== line.productId))
                        }
                        type="button"
                      >
                        Remove
                      </button>
                    </li>
                  );
                })}
              </ul>
              <p className="price">Estimated total: {formatMinor(total.toString())}</p>
              <p className="muted">The final total is recalculated from current server prices.</p>
            </section>
            <form className="card form-stack" onSubmit={submit}>
              <h2>Delivery details</h2>
              <label>
                Recipient name
                <input
                  autoComplete="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                  maxLength={120}
                />
              </label>
              <label>
                Phone
                <input
                  autoComplete="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  required
                  maxLength={32}
                />
              </label>
              <label>
                Delivery address
                <textarea
                  autoComplete="street-address"
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  required
                  maxLength={500}
                />
              </label>
              <button className="button primary" disabled={saving || loading}>
                {saving ? "Placing order…" : "Place order · Cash on delivery"}
              </button>
              {loginRequired && (
                <p>
                  <Link href="/login?next=%2Fcheckout">Sign in and return to checkout</Link>
                </p>
              )}
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
            </form>
          </div>
        )}
      </section>
    </main>
  );
}
