import { clearRevokedPosData, readState, writeState, type DeviceState } from "./store";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

export type Product = {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  priceMinor: string | number;
  stock: string | number;
  version: number;
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
export type Sale = {
  id: string;
  invoiceNo: string;
  status: string;
  subtotalMinor: string | number;
  discountMinor: string | number;
  totalMinor: string | number;
  paidMinor: string | number;
  createdAt: string;
  items?: Array<{
    productId: string;
    quantity: string | number;
    unitPriceMinor: string | number;
    totalMinor: string | number;
    product?: { name: string };
  }>;
  payments?: Array<{ amountMinor: string | number; method: string }>;
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

async function refresh(state: DeviceState): Promise<DeviceState> {
  if (!state.refreshToken) throw new Error("POS_LOGIN_REQUIRED");
  const response = await fetch(`${API}/pos/auth/refresh`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ refreshToken: state.refreshToken }),
  });
  const tokens = await parse<{ accessToken: string; refreshToken: string }>(response);
  const next = { ...state, ...tokens };
  await writeState(next);
  return next;
}

export async function posFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  let state = await readState();
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json");
  if (state.accessToken) headers.set("authorization", `Bearer ${state.accessToken}`);
  let response = await fetch(`${API}${path}`, { ...init, headers });
  if (response.status === 401 && state.refreshToken && !path.includes("/auth/refresh")) {
    try {
      state = await refresh(state);
    } catch (error: unknown) {
      // Reuse, expiry, or revocation invalidates the local credential family.
      await clearRevokedPosData();
      throw error;
    }
    headers.set("authorization", `Bearer ${state.accessToken}`);
    response = await fetch(`${API}${path}`, { ...init, headers });
  }
  return parse<T>(response);
}

export async function enroll(
  code: string,
  name: string,
): Promise<{
  terminal: { id: string; name: string };
  deviceCredential: string;
}> {
  return parse(
    await fetch(`${API}/pos/auth/enroll`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code, name }),
    }),
  );
}

export async function login(
  username: string,
  password: string,
  deviceCredential: string,
): Promise<DeviceState> {
  const response = await fetch(`${API}/pos/auth/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-device-credential": deviceCredential,
    },
    body: JSON.stringify({ username, password }),
  });
  const result = await parse<{
    user: DeviceState["user"];
    terminal: DeviceState["terminal"];
    accessToken: string;
    refreshToken: string;
  }>(response);
  const state: DeviceState = { deviceCredential, ...result };
  await writeState(state);
  return state;
}

export async function logout(): Promise<void> {
  try {
    await posFetch("/pos/auth/logout", { method: "POST", body: "{}" });
  } finally {
    await writeState({});
  }
}

export async function getProducts(): Promise<Product[]> {
  return posFetch<Product[]>("/pos/catalog/products");
}
export async function getCustomers(query: string): Promise<Customer[]> {
  return posFetch<Customer[]>(`/pos/catalog/customers?q=${encodeURIComponent(query)}`);
}
export async function createCustomer(data: {
  name: string;
  phone?: string;
  email?: string;
}): Promise<Customer> {
  return posFetch<Customer>("/pos/catalog/customers", {
    method: "POST",
    body: JSON.stringify(data),
  });
}
export async function currentCashSession(): Promise<CashSession | null> {
  return posFetch<CashSession | null>("/pos/cash-sessions/current");
}
export async function openCashSession(openingMinor: number): Promise<CashSession> {
  return posFetch<CashSession>("/pos/cash-sessions/open", {
    method: "POST",
    body: JSON.stringify({ openingMinor }),
  });
}
export async function closeCashSession(id: string, closingMinor: number): Promise<CashSession> {
  return posFetch<CashSession>(`/pos/cash-sessions/${encodeURIComponent(id)}/close`, {
    method: "POST",
    body: JSON.stringify({ closingMinor }),
  });
}
export async function getSales(): Promise<Sale[]> {
  return posFetch<Sale[]>("/pos/sales");
}
export async function reprintSale(id: string): Promise<Sale> {
  return posFetch<Sale>(`/pos/sales/${encodeURIComponent(id)}/reprint`, {
    method: "POST",
    body: "{}",
  });
}

export async function createSale(
  items: Array<{ productId: string; quantity: number }>,
  discountMinor: number,
  paidMinor: number,
  approvalId?: string,
): Promise<Sale> {
  const idempotencyKey = crypto.randomUUID();
  return posFetch<Sale>("/pos/sales", {
    method: "POST",
    headers: { "idempotency-key": idempotencyKey },
    body: JSON.stringify({
      idempotencyKey,
      items,
      payments: [{ method: "CASH", amountMinor: paidMinor }],
      discountMinor,
      approvalId,
    }),
  });
}

export async function syncOfflineSale(sale: {
  clientSaleId: string;
  cashierId: string;
  terminalId: string;
  occurredAtClient: string;
  totalMinor: number;
  items: Array<{ productId: string; quantity: number }>;
}): Promise<Sale> {
  return posFetch<Sale>("/pos/sync/sales", {
    method: "POST",
    body: JSON.stringify(sale),
  });
}

export async function refundSale(
  id: string,
  amountMinor: number,
  reason: string,
  restoreStock: boolean,
  idempotencyKey: string,
  approvalId?: string,
): Promise<unknown> {
  return posFetch(`/pos/sales/${encodeURIComponent(id)}/refund`, {
    method: "POST",
    headers: { "idempotency-key": idempotencyKey },
    body: JSON.stringify({ amountMinor, reason, restoreStock, idempotencyKey, approvalId }),
  });
}
