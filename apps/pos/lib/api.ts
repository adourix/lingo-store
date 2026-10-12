const API = process.env.NEXT_PUBLIC_API_URL || "/api";

type CsrfResponse = { token: string };
let csrfToken: string | null = null;
let csrfPromise: Promise<string> | null = null;

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

type CatalogProduct = Product & {
  description?: string | null;
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
const META_PREFIX = "[[LINGO_PRODUCT_META]]";

function extractImageUrl(description: unknown): string | null {
  if (typeof description !== "string" || !description.startsWith(META_PREFIX)) return null;
  const jsonStart = description.indexOf("{", META_PREFIX.length);
  if (jsonStart < 0) return null;

  for (let end = jsonStart + 1; end <= description.length; end += 1) {
    if (description[end - 1] !== "}") continue;
    try {
      const meta = JSON.parse(description.slice(jsonStart, end)) as Record<string, unknown>;
      const value = meta.imageUrl;
      return typeof value === "string" && value.trim() ? value.trim() : null;
    } catch {
      // Continue until the complete JSON object is found.
    }
  }

  return null;
}

function toPosImageUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value, window.location.origin);
    if (!url.pathname.startsWith("/uploads/products/")) return null;
    const filename = url.pathname.split("/").pop() || "";
    if (!/^[a-f0-9-]+\.(?:jpg|jpeg|png|webp)$/i.test(filename)) return null;
    return `/catalog/product-image?file=${encodeURIComponent(filename)}`;
  } catch {
    return null;
  }
}

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
  const products = await posFetch<CatalogProduct[]>("/pos/catalog/products");

  // The authenticated API is the source of truth for POS product data.
  // The Next.js catalog route additionally exposes the image URL derived from
  // the product metadata. Keep this as a separate request so barcode/product
  // loading does not depend on the presentation route.
  let imageByProductId = new Map<string, string | null>();
  try {
    const response = await fetch("/api/catalog/products", {
      credentials: "include",
      cache: "no-store",
    });
    if (response.ok) {
      const catalog = (await response.json()) as Array<{
        id?: unknown;
        imageUrl?: unknown;
      }>;
      if (Array.isArray(catalog)) {
        imageByProductId = new Map(
          catalog
            .filter((item) => item && typeof item.id === "string")
            .map((item) => [item.id as string, typeof item.imageUrl === "string" ? item.imageUrl : null]),
        );
      }
    }
  } catch {
    // Images are optional; keep the authenticated product catalog usable.
  }

  return products.map((product) => ({
    ...product,
    barcode: product.barcode ? normalizeBarcode(product.barcode) : null,
    imageUrl:
      product.imageUrl ??
      imageByProductId.get(product.id) ??
      toPosImageUrl(extractImageUrl(product.description)),
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
export async function getSales(): Promise<Sale[]> {
  return posFetch<Sale[]>("/pos/sales");
}
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
export async function refundSale(id: string, amountMinor: number, reason: string, restoreStock: boolean, idempotencyKey: string): Promise<Sale> {
  return posFetch<Sale>(`/pos/sales/${encodeURIComponent(id)}/refund`, { method: "POST", headers: { "idempotency-key": idempotencyKey }, body: JSON.stringify({ amountMinor, reason, restoreStock }) });
}
