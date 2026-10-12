"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import CleanProductImage from "../CleanProductImage";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";
const CART_KEY = "lingo-cart-v1";

type CartLine = { productId: string; quantity: number };
type Product = {
  id: string;
  sku: string;
  name: string;
  priceMinor: string | number;
  description: string | null;
  imageUrl: string | null;
  brand: string | null;
  stock: number | null;
};
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
    (typeof value.priceMinor === "string" || typeof value.priceMinor === "number") &&
    "description" in value &&
    (value.description === null || typeof value.description === "string") &&
    "imageUrl" in value &&
    (value.imageUrl === null || typeof value.imageUrl === "string") &&
    "brand" in value &&
    (value.brand === null || typeof value.brand === "string") &&
    "stock" in value &&
    (value.stock === null || typeof value.stock === "number")
  );
}

function formatMinor(value: string | number): string {
  const amount = BigInt(value);
  return `${new Intl.NumberFormat("en").format(amount / 100n)}.${(amount % 100n).toString().padStart(2, "0")} EGP`;
}

function Icon({ name }: { name: "home" | "search" | "cart" | "user" | "pin" | "phone" | "trash" | "plus" | "minus" | "bag" | "truck" | "shield" | "headset" | "cash" | "lock" | "info" | "arrow" }) {
  const paths: Record<string, React.ReactNode> = {
    home: <><path d="m3 10 9-7 9 7"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-6h6v6"/></>,
    search: <><circle cx="11" cy="11" r="6.5"/><path d="m16 16 5 5"/></>,
    cart: <><path d="M3 4h2l2.2 11.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 1.9-1.4L21 8H7"/><circle cx="10" cy="20" r="1.2"/><circle cx="18" cy="20" r="1.2"/></>,
    user: <><circle cx="12" cy="8" r="3.2"/><path d="M5 21a7 7 0 0 1 14 0"/></>,
    pin: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
    phone: <path d="M6.5 3.5 9 6l-1.8 2.2a13 13 0 0 0 6.6 6.6L16 13l2.5 2.5-1.4 3a2 2 0 0 1-2.2 1.1A17 17 0 0 1 4.4 9.6 2 2 0 0 1 5.5 7.4Z"/>,
    trash: <><path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="m8 7 .7-3h6.6l.7 3M6 7l1 14h10l1-14"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    minus: <path d="M5 12h14"/>,
    bag: <><path d="M6 8h12l1 13H5L6 8Z"/><path d="M9 8a3 3 0 0 1 6 0"/></>,
    truck: <><path d="M3 6h11v11H3zM14 10h4l3 3v4h-7z"/><circle cx="7" cy="19" r="2"/><circle cx="18" cy="19" r="2"/></>,
    shield: <path d="M12 3 20 6v5c0 5-3.2 8.5-8 10-4.8-1.5-8-5-8-10V6l8-3Zm-3 9 2 2 4-4"/>,
    headset: <><path d="M4 13a8 8 0 0 1 16 0"/><path d="M4 13v4a2 2 0 0 0 2 2h2v-6H6a2 2 0 0 0-2 2ZM20 13v4a2 2 0 0 1-2 2h-2v-6h2a2 2 0 0 1 2 2Z"/><path d="M16 19c0 1.5-1.7 2-4 2"/></>,
    cash: <><rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 10h.01M18 14h.01"/></>,
    lock: <><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
    info: <><circle cx="12" cy="12" r="9"/><path d="M12 10v6M12 7h.01"/></>,
    arrow: <><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></>,
  };

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
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
        if (!Array.isArray(result) || !result.every(isProduct)) throw new Error("Catalog response is invalid.");
        setProducts(result);
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Unable to load catalog."))
      .finally(() => setLoading(false));
  }, []);

  const catalog = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const itemCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const total = cart.reduce((sum, line) => {
    const product = catalog.get(line.productId);
    if (!product) return sum;
    const raw = BigInt(product.priceMinor) * BigInt(Math.round(line.quantity * 1000));
    return sum + (raw + 500n) / 1000n;
  }, 0n);

  function updateCart(next: CartLine[]) {
    setCart(next);
    sessionStorage.setItem(CART_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("lingo-cart-updated"));
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
      if (!csrfData || typeof csrfData !== "object" || !("token" in csrfData)) throw new Error("Checkout security token is invalid.");
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
        const message = data && typeof data === "object" && "error" in data ? String(data.error) : "Order could not be placed.";
        throw new Error(message);
      }
      if (!data || typeof data !== "object" || !("id" in data) || !("invoiceNo" in data) || !("totalMinor" in data)) throw new Error("Order response was invalid.");
      setOrder({ id: String(data.id), invoiceNo: String(data.invoiceNo), status: "PENDING", totalMinor: String(data.totalMinor) });
      updateCart([]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Order could not be placed.");
    } finally {
      setSaving(false);
    }
  }

  if (order) {
    return (
      <main className="checkout-page">
        <header className="checkout-header">
          <div className="checkout-header-inner">
            <Link className="checkout-brand" href="/" aria-label="Lingo home"><img src="/lingo-logo.svg" alt="Lingo" /></Link>
            <Link className="checkout-header-search" href="/products"><Icon name="search" /><span>Search for products, brands and more...</span></Link>
            <div className="checkout-header-actions">
              <Link className="checkout-header-cart" href="/cart" aria-label="Cart"><Icon name="cart" /></Link>
              <Link href="/account" aria-label="Account"><Icon name="user" /></Link>
            </div>
          </div>
        </header>
        <section className="checkout-success container">
          <div className="checkout-success-mark" aria-hidden="true">✓</div>
          <p className="checkout-kicker">ORDER RECEIVED</p>
          <h1>Thank you for your order.</h1>
          <p>Your order <strong>{order.invoiceNo}</strong> has been received and is awaiting store confirmation.</p>
          <p className="checkout-success-total">Total: {formatMinor(order.totalMinor)} · Cash on delivery</p>
          <div className="checkout-success-actions">
            <Link className="checkout-primary-button" href="/account/orders">View my orders</Link>
            <Link className="checkout-secondary-button" href="/products">Continue shopping</Link>
          </div>
        </section>
      </main>
    );
  }

  const empty = !loading && cart.length === 0;

  return (
    <main className="checkout-page">
      <header className="checkout-header">
        <div className="checkout-header-inner">
          <Link className="checkout-brand" href="/" aria-label="Lingo home"><img src="/lingo-logo.svg" alt="Lingo" /></Link>
          <Link className="checkout-header-search" href="/products"><Icon name="search" /><span>Search for products, brands and more...</span></Link>
          <div className="checkout-header-actions">
            <Link className="checkout-header-cart" href="/cart" aria-label={`Cart, ${itemCount} items`}>
              <Icon name="cart" />
              {itemCount > 0 && <span className="checkout-cart-badge">{itemCount > 99 ? "99+" : itemCount}</span>}
            </Link>
            <Link href="/account" aria-label="Account"><Icon name="user" /></Link>
          </div>
        </div>
      </header>

      <section className="checkout-container container">
        <div className="checkout-breadcrumbs">
          <Link href="/"><Icon name="home" /></Link>
          <span aria-hidden="true">/</span>
          <span>Checkout</span>
        </div>

        <div className="checkout-heading">
          <h1>Checkout</h1>
          <p>Pay cash when your order is delivered.</p>
        </div>

        {loading && (
          <div className="checkout-loading" role="status">Loading your cart…</div>
        )}

        {empty ? (
          <section className="checkout-empty" role="status">
            <div className="checkout-empty-icon"><Icon name="bag" /></div>
            <h2>Your cart is empty</h2>
            <p>Add products from the catalog and they will appear here.</p>
            <Link className="checkout-primary-button" href="/products">Browse products</Link>
          </section>
        ) : (
          <div className="checkout-grid">
            <div className="checkout-main-column">
              <section className="checkout-card checkout-items-card" aria-labelledby="checkout-items-heading">
                <div className="checkout-card-header">
                  <div className="checkout-card-title">
                    <span className="checkout-section-icon"><Icon name="pin" /></span>
                    <h2 id="checkout-items-heading">Your items ({cart.length})</h2>
                  </div>
                  <button className="checkout-clear-button" type="button" onClick={() => updateCart([])} disabled={saving}>
                    <Icon name="trash" />
                    <span>Clear cart</span>
                  </button>
                </div>
                <div className="checkout-card-body checkout-item-list">
                  {cart.map((line) => {
                    const product = catalog.get(line.productId);
                    const inStock = product?.stock === null || (product?.stock ?? 0) > 0;
                    return (
                      <article className="checkout-item" key={line.productId}>
                        <Link className="checkout-item-image" href={product ? `/products/${encodeURIComponent(product.sku)}` : "/products"} aria-label={product ? `View ${product.name}` : "View products"}>
                          {product?.imageUrl ? <CleanProductImage src={product.imageUrl} alt="" /> : <span>{product?.name?.slice(0, 1).toUpperCase() || "L"}</span>}
                        </Link>
                        <div className="checkout-item-info">
                          <Link className="checkout-item-name" href={product ? `/products/${encodeURIComponent(product.sku)}` : "/products"}>{product?.name || "Unavailable product"}</Link>
                          <p>{product?.description || product?.brand || "Product from Lingo Store"}</p>
                          <span className={inStock ? "checkout-stock in" : "checkout-stock out"}>{inStock ? "In Stock" : "Out of Stock"}</span>
                        </div>
                        <div className="checkout-item-price">
                          <strong>{product ? formatMinor(product.priceMinor) : "Unavailable"}</strong>
                          {product && <span>{formatMinor(product.priceMinor)} each</span>}
                        </div>
                        <div className="checkout-quantity" aria-label={`Quantity for ${product?.name || "product"}`}>
                          <button type="button" aria-label="Decrease quantity" onClick={() => updateCart(cart.map((item) => item.productId === line.productId ? { ...item, quantity: item.quantity - 1 } : item).filter((item) => item.quantity > 0))} disabled={line.quantity <= 1 || saving}><Icon name="minus" /></button>
                          <span>{line.quantity}</span>
                          <button type="button" aria-label="Increase quantity" onClick={() => updateCart(cart.map((item) => item.productId === line.productId ? { ...item, quantity: Math.min(999, item.quantity + 1) } : item))} disabled={line.quantity >= 999 || saving}><Icon name="plus" /></button>
                        </div>
                        <button className="checkout-remove-button" type="button" onClick={() => updateCart(cart.filter((item) => item.productId !== line.productId))} disabled={saving} aria-label={`Remove ${product?.name || "product"}`}>
                          <Icon name="trash" />
                        </button>
                      </article>
                    );
                  })}
                </div>
              </section>

              <form className="checkout-card checkout-form-card" onSubmit={submit}>
                <div className="checkout-card-header checkout-form-heading">
                  <div className="checkout-card-title">
                    <span className="checkout-section-icon"><Icon name="pin" /></span>
                    <div><h2>Delivery details</h2><p>Enter your information for delivery</p></div>
                  </div>
                </div>
                <div className="checkout-form-body">
                  <div className="checkout-form-row">
                    <label><span>Recipient name <b>*</b></span><div className="checkout-input-wrap"><Icon name="user" /><input autoComplete="name" placeholder="Full name" value={name} onChange={(event) => setName(event.target.value)} required maxLength={120} /></div></label>
                    <label><span>Phone number <b>*</b></span><div className="checkout-input-wrap"><Icon name="phone" /><input autoComplete="tel" inputMode="tel" placeholder="01XXXXXXXXX" value={phone} onChange={(event) => setPhone(event.target.value)} required maxLength={32} /></div></label>
                  </div>
                  <label><span>Delivery address <b>*</b></span><div className="checkout-textarea-wrap"><Icon name="pin" /><textarea autoComplete="street-address" placeholder="Street, building, area, city..." value={address} onChange={(event) => setAddress(event.target.value)} required maxLength={500} /></div><small>Please provide a clear and complete address to ensure smooth delivery.</small></label>
                </div>
              </form>

              <section className="checkout-card checkout-payment-card" aria-labelledby="payment-heading">
                <div className="checkout-card-header">
                  <div className="checkout-card-title">
                    <span className="checkout-section-icon"><Icon name="cash" /></span>
                    <div><h2 id="payment-heading">Payment method</h2><p>Pay when your order is delivered</p></div>
                  </div>
                </div>
                <div className="checkout-payment-option">
                  <span className="checkout-radio" aria-hidden="true"><span /></span>
                  <span className="checkout-payment-icon"><Icon name="cash" /></span>
                  <div><strong>Cash on delivery</strong><span>Pay with cash when you receive your order</span></div>
                </div>
              </section>
            </div>

            <aside className="checkout-side-column">
              <section className="checkout-card checkout-summary-card" aria-labelledby="summary-heading">
                <div className="checkout-card-header">
                  <div className="checkout-card-title"><span className="checkout-section-icon"><Icon name="bag" /></span><h2 id="summary-heading">Order summary</h2></div>
                </div>
                <div className="checkout-summary-body">
                  <div className="checkout-summary-line"><span>Items total</span><strong>{formatMinor(total.toString())}</strong></div>
                  <div className="checkout-summary-line"><span>Delivery fee <Icon name="info" /></span><strong>0.00 EGP</strong></div>
                  <div className="checkout-summary-divider" />
                  <div className="checkout-total"><span>Total</span><strong>{formatMinor(total.toString())}</strong></div>
                  <button className="checkout-primary-button checkout-place-button" type="submit" form="checkout-form" disabled={saving || loading || cart.length === 0} onClick={(event) => {
                    const form = (event.currentTarget as HTMLButtonElement).form;
                    if (form && !form.id) form.id = "checkout-form";
                  }}>
                    <Icon name="truck" />
                    <span>{saving ? "Placing order…" : "Place order · Cash on delivery"}</span>
                  </button>
                  {loginRequired && <p className="checkout-login-hint"><Link href="/login?next=%2Fcheckout">Sign in and return to checkout</Link></p>}
                  {error && <p className="checkout-error" role="alert">{error}</p>}
                  <p className="checkout-secure-note"><Icon name="lock" />Your information is secure and will only be used for this order.</p>
                </div>
              </section>

              <section className="checkout-card checkout-help-card" aria-label="Checkout help">
                <div className="checkout-help-row"><span className="checkout-help-icon delivery"><Icon name="truck" /></span><div><strong>Fast delivery</strong><p>Get your order as soon as possible</p></div></div>
                <div className="checkout-help-row"><span className="checkout-help-icon safety"><Icon name="shield" /></span><div><strong>Cash on delivery</strong><p>Pay safely when you receive your order</p></div></div>
                <div className="checkout-help-row"><span className="checkout-help-icon support"><Icon name="headset" /></span><div><strong>Need help?</strong><p>Contact us if you have any questions</p></div></div>
                <Link className="checkout-continue-button" href="/products"><Icon name="arrow" /><span>Continue shopping</span></Link>
              </section>
            </aside>
          </div>
        )}
      </section>
    </main>
  );
}
