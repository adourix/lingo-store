const API = process.env.NEXT_PUBLIC_API_URL || "/api";

export type DeviceState = {
  user?: { id: string; name: string; role: string };
  terminal?: { id: string; name: string };
};

export type Product = {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  priceMinor: string | number;
  stock: string | number;
  version: number;
  imageUrl?: string | null;
  category?: { id: string; name: string } | null;
};

export type Customer = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
};

export type CashSession = {
  id: string;
  openingMinor: string | number;
  closingMinor: string | number | null;
  status: "OPEN" | "CLOSED";
  openedAt: string;
  closedAt: string | null;
};

type CsrfResponse = { token: string };
let csrfToken: string | null = null;
let csrfPromise: Promise<string> | null = null;

async function parse<T>(response: Response): Promise<T> {
  const body: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      body && typeof body === "object" && "error" in body
        ? String(body.error)
        : `Request failed (${response.status})`;
    throw new Error(message);
  }
  return body as T;
}

async function getCsrf(): Promise<string> {
  if (csrfToken) return csrfToken;
  if (!csrfPromise) {
    csrfPromise = fetch(`${API}/pos/auth/csrf`, {
      credentials: "include",
      cache: "no-store",
    })
      .then((response) => parse<CsrfResponse>(response))
      .then((result) => {
        csrfToken = result.token;
        return result.token;
      })
      .finally(() => {
        csrfPromise = null;
      });
  }
  return csrfPromise;
}

export async function posFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json");
  const method = String(init.method || "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS")
    headers.set("x-csrf-token", await getCsrf());
  return parse<T>(
    await fetch(`${API}${path}`, {
      ...init,
      credentials: "include",
      headers,
    }),
  );
}

export async function enroll(code: string, name: string): Promise<{ terminal: { id: string; name: string } }> {
  return posFetch("/pos/auth/enroll", { method: "POST", body: JSON.stringify({ code, name }) });
}

export async function login(username: string, password: string): Promise<DeviceState> {
  csrfToken = null;
  const state = await posFetch<DeviceState>("/pos/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  csrfToken = null;
  return state;
}

export async function getMe(): Promise<DeviceState> {
  return posFetch<DeviceState>("/pos/auth/me");
}
export async function logout(): Promise<void> {
  try {
    await posFetch("/pos/auth/logout", { method: "POST", body: "{}" });
  } finally {
    csrfToken = null;
  }
}

const normalizeBarcode = (value: string) => value.trim().toLowerCase().replace(/[\s-]/g, "");
const isBarcodeLike = (value: string) => /^[0-9\s-]{8,32}$/.test(value.trim());

if (typeof window !== "undefined") {
  window.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || !target.matches("input.search")) return;
    if (!isBarcodeLike(target.value)) return;

    const normalized = normalizeBarcode(target.value);
    if (normalized === target.value) return;

    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(target, normalized);
    target.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

export async function getProducts(): Promise<Product[]> {
  // This same-origin POS route enriches the authenticated catalog with the
  // structured image metadata used by the web/admin product flow.
  const response = await fetch("/catalog/products", {
    credentials: "include",
    cache: "no-store",
  });
  const products = await parse<Product[]>(response);
  return products.map((product) => ({
    ...product,
    barcode: product.barcode ? normalizeBarcode(product.barcode) : null,
  }));
}
export async function getCustomers(query: string): Promise<Customer[]> {
  return posFetch<Customer[]>(`/pos/catalog/customers?q=${encodeURIComponent(query)}`);
}
export async function createCustomer(data: { name: string; phone?: string; email?: string }): Promise<Customer> {
  return posFetch<Customer>("/pos/catalog/customers", { method: "POST", body: JSON.stringify(data) });
}
export async function currentCashSession(): Promise<CashSession | null> {
  return posFetch<CashSession | null>("/pos/cash-sessions/current");
}
export async function openCashSession(openingMinor: number): Promise<CashSession> {
  return posFetch<CashSession>("/pos/cash-sessions/open", { method: "POST", body: JSON.stringify({ openingMinor }) });
}
export async function closeCashSession(id: string, closingMinor: number): Promise<CashSession> {
  return posFetch<CashSession>(`/pos/cash-sessions/${encodeURIComponent(id)}/close`, { method: "POST", body: JSON.stringify({ closingMinor }) });
}
export async function getSales(): Promise<Sale[]> {
  return posFetch<Sale[]>("/pos/sales");
}
export type Sale = {
  id: string;
  invoiceNo: string;
  status: string;
  subtotalMinor: string | number;
  discountMinor: string | number;
  totalMinor: string | number;
  paidMinor: string | number;
  createdAt: string;
  items?: Array<{ productId: string; quantity: string | number; unitPriceMinor: string | number; totalMinor: string | number; product?: { name: string } }>;
  payments?: Array<{ amountMinor: string | number; method: string }>;
};
export async function reprintSale(id: string): Promise<Sale> {
  return posFetch<Sale>(`/pos/sales/${encodeURIComponent(id)}/reprint`, { method: "POST", body: "{}" });
}
export async function createSale(items: Array<{ productId: string; quantity: number }>, discountMinor: number, paidMinor: number, approvalId?: string): Promise<Sale> {
  const idempotencyKey = crypto.randomUUID();
  return posFetch<Sale>("/pos/sales", { method: "POST", headers: { "idempotency-key": idempotencyKey }, body: JSON.stringify({ idempotencyKey, items, payments: [{ method: "CASH", amountMinor: paidMinor }], discountMinor, approvalId }) });
}
export async function syncOfflineSale(sale: { clientSaleId: string; cashierId: string; terminalId: string; occurredAtClient: string; totalMinor: number; items: Array<{ productId: string; quantity: number }> }): Promise<Sale> {
  return posFetch<Sale>("/pos/sync/sales", { method: "POST", body: JSON.stringify(sale) });
}
export async function refundSale(id: string, amountMinor: number, reason: string, restoreStock: boolean, idempotencyKey: string, approvalId?: string): Promise<unknown> {
  const password = window.prompt("Enter your cashier password to confirm this refund:");
  if (password === null) throw new Error("REFUND_CANCELLED");
  if (!password) throw new Error("INVALID_CREDENTIALS");
  await posFetch("/pos/auth/unlock", { method: "POST", body: JSON.stringify({ password }) });
  return posFetch(`/pos/sales/${encodeURIComponent(id)}/refund`, { method: "POST", headers: { "idempotency-key": idempotencyKey }, body: JSON.stringify({ amountMinor, reason, restoreStock, idempotencyKey, approvalId }) });
}
