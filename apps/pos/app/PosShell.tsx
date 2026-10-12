"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createCustomer,
  createSale,
  currentCashSession,
  enroll,
  getCustomers,
  getProducts,
  getSales,
  login,
  logout,
  openCashSession,
  closeCashSession,
  posFetch,
  refundSale,
  reprintSale,
  syncOfflineSale,
  type CashSession,
  type Customer,
  type Product,
  type Sale,
} from "../lib/api";
import {
  readQueue,
  readState,
  writeQueue,
  writeState,
  type DeviceState,
  type PendingSale,
} from "../lib/store";

const money = (minor: number | string) => `${(Number(minor) / 100).toFixed(2)} EGP`;
const numberMinor = (value: number | string) => Math.round(Number(value) * 100);
const minorValue = (value: number | string) => Math.round(Number(value));

type Mode = "login" | "enroll" | "pos" | "sales" | "shift" | "customers" | "terminal";
type CartLine = { product: Product; quantity: number };

type NavIconName = "sale" | "sales" | "shift" | "customers" | "terminal";

export default function PosShell({ mode }: { mode: Mode }) {
  const [device, setDevice] = useState<DeviceState>({});
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [online, setOnline] = useState(true);
  const [queueCount, setQueueCount] = useState(0);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void (async () => {
      setDevice(await readState());
      setQueueCount((await readQueue()).length);
      setLoading(false);
    })();
    const onlineHandler = () => setOnline(true);
    const offlineHandler = () => setOnline(false);
    window.addEventListener("online", onlineHandler);
    window.addEventListener("offline", offlineHandler);
    return () => {
      window.removeEventListener("online", onlineHandler);
      window.removeEventListener("offline", offlineHandler);
    };
  }, []);

  useEffect(() => {
    if (!device.user || mode === "login" || mode === "enroll") return;
    let timer: number | undefined;
    const arm = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => setLocked(true), 10 * 60 * 1000);
    };
    const events = ["pointerdown", "keydown", "touchstart"] as const;
    events.forEach((event) => window.addEventListener(event, arm));
    arm();
    return () => {
      if (timer) window.clearTimeout(timer);
      events.forEach((event) => window.removeEventListener(event, arm));
    };
  }, [device.user, mode]);

  const syncQueue = useCallback(async () => {
    if (!navigator.onLine || !device.user) return;
    const queue = await readQueue();
    const remaining: PendingSale[] = [];
    for (const sale of queue) {
      try {
        await syncOfflineSale(sale);
      } catch {
        remaining.push(sale);
      }
    }
    await writeQueue(remaining);
    setQueueCount(remaining.length);
  }, [device.user]);

  useEffect(() => {
    void syncQueue();
  }, [syncQueue, online]);

  if (loading)
    return (
      <main className="pos-center">
        <div className="pos-card">
          <p>Loading terminal…</p>
        </div>
      </main>
    );
  if (mode === "enroll")
    return (
      <Enrollment
        onComplete={async (terminal) => {
          const next = { ...device, terminal };
          await writeState(next);
          setDevice(next);
          window.location.href = "/login";
        }}
      />
    );
  if (!device.terminal && mode !== "login")
    return (
      <main className="pos-center">
        <div className="pos-card">
          <h1>Terminal not registered</h1>
          <p>Register this shop terminal with a one-time code.</p>
          <a className="pos-button primary" href="/enroll">
            Register terminal
          </a>
        </div>
      </main>
    );
  if (mode === "login" || !device.user) return <Login onComplete={(state) => setDevice(state)} />;
  if (locked)
    return (
      <LockScreen
        onUnlock={() => setLocked(false)}
        onLogout={async () => {
          await logout();
          setDevice({});
          setLocked(false);
        }}
      />
    );

  return (
    <PosFrame
      mode={mode}
      device={device}
      online={online}
      queueCount={queueCount}
      message={message}
      setMessage={setMessage}
      onLogout={async () => {
        await logout();
        setDevice({});
        window.location.href = "/login";
      }}
    >
      {mode === "pos" && (
        <SaleScreen
          device={device}
          online={online}
          onQueued={() => setQueueCount((value) => value + 1)}
        />
      )}
      {mode === "sales" && <SalesScreen />}
      {mode === "shift" && <ShiftScreen />}
      {mode === "customers" && <CustomersScreen />}
      {mode === "terminal" && <TerminalScreen device={device} />}
    </PosFrame>
  );
}

function Enrollment({
  onComplete,
}: {
  onComplete: (terminal: { id: string; name: string }) => Promise<void>;
}) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const result = await enroll(code.trim(), name.trim());
      await onComplete(result.terminal);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enrollment failed");
    } finally {
      setSaving(false);
    }
  }
  return (
    <main className="pos-center">
      <form className="pos-card pos-form" onSubmit={submit}>
        <div className="pos-brand">LINGO POS</div>
        <h1>Register terminal</h1>
        <p>Enter the one-time enrollment code generated by an administrator.</p>
        <label>
          Enrollment code
          <input value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" required />
        </label>
        <label>
          Terminal name
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Front counter" maxLength={80} required />
        </label>
        <button className="pos-button primary" disabled={saving}>{saving ? "Registering…" : "Register terminal"}</button>
        {error && <p className="pos-error">{error}</p>}
        <a href="/login">Already registered? Sign in</a>
      </form>
    </main>
  );
}

function Login({ onComplete }: { onComplete: (state: DeviceState) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    try { onComplete(await login(username.trim(), password)); }
    catch (e) { setError(e instanceof Error ? e.message : "Sign in failed"); }
    finally { setSaving(false); }
  }
  return (
    <main className="pos-center">
      <form className="pos-card pos-form" onSubmit={submit}>
        <div className="pos-brand">LINGO POS</div>
        <h1>Cashier sign in</h1>
        <p>Use a staff account with POS access on this registered terminal.</p>
        <label>Username<input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required /></label>
        <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required /></label>
        <button className="pos-button primary" disabled={saving}>{saving ? "Signing in…" : "Sign in"}</button>
        {error && <p className="pos-error">{error}</p>}
        <a href="/enroll">Register this terminal</a>
      </form>
    </main>
  );
}

function LockScreen({ onUnlock, onLogout }: { onUnlock: () => void; onLogout: () => Promise<void> }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    try { await posFetch("/pos/auth/unlock", { method: "POST", body: JSON.stringify({ password }) }); setPassword(""); onUnlock(); }
    catch (e) { setError(e instanceof Error ? e.message : "Unlock failed"); }
    finally { setSaving(false); }
  }
  return (
    <main className="pos-center">
      <form className="pos-card pos-form" onSubmit={submit}>
        <div className="pos-brand">LINGO POS</div><h1>Terminal locked</h1><p>Re-enter the cashier password to continue.</p>
        <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus required /></label>
        <button className="pos-button primary" disabled={saving}>{saving ? "Checking…" : "Unlock"}</button>
        <button type="button" className="pos-button ghost" onClick={() => void onLogout()}>Sign out</button>
        {error && <p className="pos-error">{error}</p>}
      </form>
    </main>
  );
}

function NavIcon({ name }: { name: NavIconName }) {
  if (name === "sale") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5h2l1.5 10.5h10.8l2-7.5H6"/><circle cx="9" cy="19" r="1.2"/><circle cx="17" cy="19" r="1.2"/><path d="M15 5v6m-3-3h6"/></svg>;
  if (name === "sales") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h10v18H7z"/><path d="M10 7h4M10 11h4M10 15h4"/><path d="M5 6h2"/></svg>;
  if (name === "shift") return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8v4l3 2"/><circle cx="12" cy="12" r="5"/></svg>;
  if (name === "customers") return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c.7-3.2 3-5 7-5s6.3 1.8 7 5"/></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="4" width="14" height="16" rx="2"/><path d="M8 8h8M8 12h5M8 16h3"/></svg>;
}

function PosFrame({ mode, device, online, queueCount, message, setMessage, onLogout, children }: { mode: Mode; device: DeviceState; online: boolean; queueCount: number; message: string; setMessage: (value: string) => void; onLogout: () => Promise<void>; children: React.ReactNode }) {
  const links: Array<[Mode, string, NavIconName]> = [
    ["pos", "New Sale", "sale"],
    ["sales", "Sales", "sales"],
    ["shift", "Shift", "shift"],
    ["customers", "Customers", "customers"],
    ["terminal", "Terminal", "terminal"],
  ];
  const now = new Date();
  const date = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(now);
  const time = new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit" }).format(now);
  const userName = device.user?.name || "Cashier";
  const initial = userName.trim().charAt(0).toUpperCase() || "C";

  return (
    <div className="pos-app">
      <header className="pos-header">
        <div className="pos-header-spacer" />
        <div className="pos-header-info">
          <div className="pos-header-clock" aria-label="Current date and time">
            <span className="pos-header-sun" aria-hidden="true">☼</span>
            <time>{date}</time>
            <time>{time}</time>
          </div>
          <div className="pos-status"><span className={online ? "dot online" : "dot"} />{online ? "Online" : "Offline"}{queueCount > 0 && <span className="queue-badge">{queueCount} queued</span>}</div>
          <div className="pos-header-user">
            <span className="pos-avatar" aria-hidden="true">{initial}</span>
            <span className="pos-user-copy"><strong>{userName}</strong><small>{device.user?.role || "Cashier"}</small></span>
            <span className="pos-user-chevron" aria-hidden="true">⌄</span>
          </div>
          <button className="pos-button ghost" onClick={() => void onLogout()}>Lock out</button>
        </div>
      </header>
      <nav className="pos-nav" aria-label="POS navigation">
        <div className="pos-nav-brand"><img src="/lingo-logo.svg" alt="Lingo" /></div>
        <div className="pos-nav-links">
          {links.map(([key, label, icon]) => (
            <a className={mode === key ? "active" : ""} href={`/${key === "pos" ? "pos" : key}`} key={key}>
              <span className="pos-nav-icon"><NavIcon name={icon} /></span>
              <span>{label}</span>
            </a>
          ))}
        </div>
        <div className="pos-nav-footer"><strong>Lingo</strong><span>v1.0.0</span></div>
      </nav>
      {message && <div className="pos-toast" role="status">{message}<button onClick={() => setMessage("")}>Dismiss</button></div>}
      <main className="pos-main">{children}</main>
    </div>
  );
}

function SaleScreen({ device, online, onQueued }: { device: DeviceState; online: boolean; onQueued: () => void }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [paid, setPaid] = useState("");
  const [discount, setDiscount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [lastSale, setLastSale] = useState<Sale | null>(null);
  useEffect(() => { getProducts().then(setProducts).catch((e) => setError(e instanceof Error ? e.message : "Unable to load products")); }, []);
  const filtered = useMemo(() => { const q = query.trim().toLowerCase(); return products.filter((p) => !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.barcode?.toLowerCase() === q); }, [products, query]);
  const subtotal = cart.reduce((sum, line) => sum + minorValue(line.product.priceMinor) * line.quantity, 0);
  const discountMinor = Math.min(numberMinor(discount || 0), subtotal);
  const total = subtotal - discountMinor;
  const paidMinor = numberMinor(paid || 0);
  const change = Math.max(0, paidMinor - total);
  function add(product: Product) {
    setCart((lines) => { const existing = lines.find((x) => x.product.id === product.id); if (existing) return lines.map((x) => x.product.id === product.id ? { ...x, quantity: Math.min(x.quantity + 1, Number(product.stock)) } : x); return [...lines, { product, quantity: 1 }]; });
  }
  function remove(id: string) { setCart((lines) => lines.filter((x) => x.product.id !== id)); }
  function changeQuantity(id: string, delta: number) {
    setCart((lines) => lines.flatMap((line) => {
      if (line.product.id !== id) return [line];
      const next = Math.min(Math.max(line.quantity + delta, 0), Number(line.product.stock));
      return next > 0 ? [{ ...line, quantity: next }] : [];
    }));
  }
  function clearCart() { setCart([]); setPaid(""); setDiscount(""); }
  async function submit() {
    if (!cart.length || paidMinor < total) return;
    setSaving(true); setError("");
    const items = cart.map((x) => ({ productId: x.product.id, quantity: x.quantity }));
    try {
      const sale = await createSale(items, discountMinor, paidMinor);
      setLastSale(sale); clearCart(); setProducts(await getProducts());
    } catch (e) {
      if (!online && device.user && device.terminal) {
        const queued: PendingSale = { id: crypto.randomUUID(), clientSaleId: crypto.randomUUID(), cashierId: device.user.id, terminalId: device.terminal.id, occurredAtClient: new Date().toISOString(), totalMinor: total, items };
        const queue = await readQueue(); queue.push(queued); await writeQueue(queue); onQueued(); clearCart(); setLastSale(null);
        setError("Sale queued for offline sync. The server will revalidate it when the terminal reconnects.");
      } else setError(e instanceof Error ? e.message : "Sale failed");
    } finally { setSaving(false); }
  }
  return (
    <div className="sale-layout">
      <section className="catalog-panel">
        <div className="section-head">
          <div>
            <h1>New Sale</h1>
          </div>
          <input className="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, SKU or scan barcode..." aria-label="Search products" autoFocus />
        </div>
        <div className="pos-category-strip" aria-label="Product categories">
          {['All', 'Phones', 'Accessories', 'Chargers', 'Cases', 'Audio', 'Cables', 'Other'].map((category, index) => <span className={index === 0 ? "active" : ""} key={category}>{category}</span>)}
        </div>
        <div className="product-grid">
          {filtered.map((product) => (
            <button className="product-tile" key={product.id} onClick={() => add(product)} disabled={Number(product.stock) <= 0}>
              <span className="product-name">{product.name}</span>
              <span>{product.sku}</span>
              <strong>{money(product.priceMinor)}</strong>
              <small>{Number(product.stock) > 0 ? `In stock: ${product.stock}` : "Out of stock"}</small>
            </button>
          ))}
        </div>
        {filtered.length === 0 && <div className="pos-empty">No matching products.</div>}
      </section>
      <aside className="cart-panel">
        <div className="cart-head"><h2>Cart ({cart.length})</h2><button className="cart-clear" type="button" onClick={clearCart} disabled={!cart.length}>Clear</button></div>
        <div className="cart-lines">
          {cart.map((line) => (
            <div className="cart-line" key={line.product.id}>
              <div><strong>{line.product.name}</strong><span>{money(line.product.priceMinor)} each</span></div>
              <div className="cart-line-actions">
                <div className="qty-control"><button type="button" onClick={() => changeQuantity(line.product.id, -1)} aria-label="Decrease quantity">−</button><b>{line.quantity}</b><button type="button" onClick={() => changeQuantity(line.product.id, 1)} aria-label="Increase quantity">+</button></div>
                <b>{money(minorValue(line.product.priceMinor) * line.quantity)}</b>
                <button className="cart-remove" type="button" onClick={() => remove(line.product.id)} aria-label={`Remove ${line.product.name}`}>×</button>
              </div>
            </div>
          ))}
          {!cart.length && <div className="pos-empty">Add products to begin.</div>}
        </div>
        <div className="totals">
          <div><span>Subtotal</span><b>{money(subtotal)}</b></div>
          <label><span>Discount</span><input type="number" min="0" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0.00" /></label>
          <div className="grand"><span>Total</span><strong>{money(total)}</strong></div>
          <label><span>Cash received</span><input type="number" min="0" step="0.01" value={paid} onChange={(e) => setPaid(e.target.value)} placeholder="0.00" /></label>
          <div><span>Change</span><b>{money(change)}</b></div>
        </div>
        <button className="pos-button primary checkout" disabled={!cart.length || paidMinor < total || saving} onClick={() => void submit()}>{saving ? "Processing…" : `Complete Sale →`}</button>
        {lastSale && <div className="sale-success"><strong>Sale completed</strong><span>{lastSale.invoiceNo}</span><b>{money(lastSale.totalMinor)}</b><button className="pos-button primary" onClick={() => window.print()}>Print receipt</button></div>}
        {error && <p className="pos-error">{error}</p>}
        {lastSale && <Receipt sale={lastSale} onClose={() => setLastSale(null)} />}
      </aside>
    </div>
  );
}

function SalesScreen() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [selected, setSelected] = useState<Sale | null>(null);
  const [error, setError] = useState("");
  const pendingRefundKeys = useRef(new Map<string, string>());
  useEffect(() => { getSales().then(setSales).catch((e) => setError(e instanceof Error ? e.message : "Unable to load sales")); }, []);
  async function reprint(id: string) { try { setSelected(await reprintSale(id)); } catch (e) { setError(e instanceof Error ? e.message : "Unable to load receipt"); } }
  async function refund(id: string, total: number) {
    const reason = window.prompt("Refund reason:"); if (!reason) return;
    const amount = window.prompt("Refund amount (EGP):", (total / 100).toFixed(2)); if (!amount) return;
    try {
      const amountMinor = numberMinor(amount); const keyId = `${id}:${amountMinor}`; const idempotencyKey = pendingRefundKeys.current.get(keyId) ?? crypto.randomUUID(); pendingRefundKeys.current.set(keyId, idempotencyKey);
      await refundSale(id, amountMinor, reason, amountMinor === total, idempotencyKey); pendingRefundKeys.current.delete(keyId); setSales(await getSales());
    } catch (e) { setError(e instanceof Error ? e.message : "Refund failed"); }
  }
  return (
    <section>
      <div className="section-head"><div><span className="eyebrow">HISTORY</span><h1>Recent sales</h1></div></div>
      {error && <p className="pos-error">{error}</p>}
      <div className="sales-list">
        {sales.map((sale) => <article className="sale-row" key={sale.id}><div><strong>{sale.invoiceNo}</strong><span>{new Date(sale.createdAt).toLocaleString()}</span></div><div><span className={`status ${sale.status.toLowerCase()}`}>{sale.status}</span><b>{money(sale.totalMinor)}</b></div><div className="row-actions"><button className="pos-button ghost" onClick={() => void reprint(sale.id)}>Receipt</button><button className="pos-button danger" onClick={() => void refund(sale.id, minorValue(sale.totalMinor))}>Refund</button></div></article>)}
      </div>
      {selected && <Receipt sale={selected} onClose={() => setSelected(null)} />}
    </section>
  );
}

function Receipt({ sale, onClose }: { sale: Sale; onClose: () => void }) {
  const subtotal = minorValue(sale.subtotalMinor);
  const discount = minorValue(sale.discountMinor);
  const total = minorValue(sale.totalMinor);
  const paid = minorValue(sale.paidMinor);
  const change = Math.max(0, paid - total);
  const createdAt = new Date(sale.createdAt);
  return (
    <div className="receipt-overlay">
      <article className="receipt">
        <div className="receipt-brand">LINGO STORE</div>
        <p className="receipt-title">SALES RECEIPT</p>
        <hr />
        <div className="receipt-meta"><span>Invoice</span><b>{sale.invoiceNo}</b></div>
        <div className="receipt-meta"><span>Date</span><b>{createdAt.toLocaleString()}</b></div>
        <hr />
        <div className="receipt-columns"><span>ITEM</span><b>AMOUNT</b></div>
        <div className="receipt-items">
          {sale.items?.map((item, index) => (
            <div className="receipt-item" key={index}>
              <span>{item.product?.name ?? item.productId}<small>{item.quantity} × {money(item.unitPriceMinor)}</small></span>
              <b>{money(item.totalMinor)}</b>
            </div>
          ))}
        </div>
        <hr />
        <div className="receipt-summary"><span>Subtotal</span><b>{money(subtotal)}</b></div>
        {discount > 0 && <div className="receipt-summary"><span>Discount</span><b>-{money(discount)}</b></div>}
        <div className="receipt-total"><strong>TOTAL</strong><strong>{money(total)}</strong></div>
        <div className="receipt-summary"><span>Cash received</span><b>{money(paid)}</b></div>
        <div className="receipt-summary"><span>Change</span><b>{money(change)}</b></div>
        <hr />
        <p className="receipt-footer">Thank you for shopping with us</p>
        <p className="receipt-footer">Please keep this receipt</p>
        <div className="receipt-actions">
          <button className="pos-button primary" onClick={() => window.print()}>Print receipt</button>
          <button className="pos-button ghost" onClick={onClose}>Close</button>
        </div>
      </article>
    </div>
  );
}

function ShiftScreen() {
  const [session, setSession] = useState<CashSession | null>(null); const [amount, setAmount] = useState(""); const [error, setError] = useState("");
  useEffect(() => { currentCashSession().then(setSession).catch((e) => setError(e instanceof Error ? e.message : "Unable to load shift")); }, []);
  async function open() { try { setSession(await openCashSession(numberMinor(amount || 0))); setAmount(""); } catch (e) { setError(e instanceof Error ? e.message : "Unable to open shift"); } }
  async function close() { if (!session) return; try { setSession(await closeCashSession(session.id, numberMinor(amount || 0))); setAmount(""); } catch (e) { setError(e instanceof Error ? e.message : "Unable to close shift"); } }
  return (
    <section className="narrow"><span className="eyebrow">CASH CONTROL</span><h1>Shift</h1><div className="pos-card"><div className="shift-status"><span className={`status ${session?.status.toLowerCase() ?? "closed"}`}>{session?.status ?? "CLOSED"}</span>{session && <strong>Opened {new Date(session.openedAt).toLocaleString()}</strong>}</div><label>{session?.status === "OPEN" ? "Counted cash at close" : "Opening cash"}<input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" /></label>{session?.status === "OPEN" ? <button className="pos-button primary" onClick={() => void close()}>Close shift</button> : <button className="pos-button primary" onClick={() => void open()}>Open shift</button>}{error && <p className="pos-error">{error}</p>}</div></section>
  );
}

function CustomersScreen() {
  const [query, setQuery] = useState(""); const [customers, setCustomers] = useState<Customer[]>([]); const [name, setName] = useState(""); const [phone, setPhone] = useState(""); const [error, setError] = useState("");
  async function search() { try { setCustomers(await getCustomers(query)); } catch (e) { setError(e instanceof Error ? e.message : "Unable to search customers"); } }
  async function create() { try { await createCustomer({ name, phone: phone || undefined }); setName(""); setPhone(""); await search(); } catch (e) { setError(e instanceof Error ? e.message : "Unable to create customer"); } }
  return (
    <section className="narrow"><span className="eyebrow">CUSTOMERS</span><h1>Customer lookup</h1><div className="pos-card"><div className="inline"><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name or phone" /><button className="pos-button primary" onClick={() => void search()}>Search</button></div><div className="customer-list">{customers.map((c) => <div key={c.id}><strong>{c.name}</strong><span>{c.phone || c.email || "No contact"}</span></div>)}</div></div><div className="pos-card"><h2>Quick customer</h2><label>Name<input value={name} onChange={(e) => setName(e.target.value)} required /></label><label>Phone<input value={phone} onChange={(e) => setPhone(e.target.value)} /></label><button className="pos-button primary" disabled={!name.trim()} onClick={() => void create()}>Create customer</button></div>{error && <p className="pos-error">{error}</p>}</section>
  );
}

function TerminalScreen({ device }: { device: DeviceState }) {
  return (
    <section className="narrow"><span className="eyebrow">DEVICE</span><h1>Terminal</h1><div className="pos-card terminal-details"><div><span>Terminal</span><strong>{device.terminal?.name}</strong></div><div><span>Terminal ID</span><code>{device.terminal?.id}</code></div><div><span>Cashier</span><strong>{device.user?.name}</strong></div><div><span>Role</span><strong>{device.user?.role}</strong></div><p>Authentication credentials are kept in HttpOnly cookies and are never placed in localStorage, sessionStorage, or IndexedDB.</p></div></section>
  );
}
