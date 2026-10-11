export type DeviceState = {
  user?: { id: string; name: string; role: string };
  terminal?: { id: string; name: string };
};

const DB_NAME = "lingo-pos";
const STORE_NAME = "offline";
const QUEUE_KEY = "queue";
const CATALOG_KEY = "catalog";
const DB_OPEN_TIMEOUT_MS = 2000;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const request = indexedDB.open(DB_NAME, 3);
    const timeout = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error("POS_STORAGE_TIMEOUT"));
    }, DB_OPEN_TIMEOUT_MS);

    request.onupgradeneeded = () => {
      const db = request.result;
      const store = db.objectStoreNames.contains(STORE_NAME)
        ? request.transaction?.objectStore(STORE_NAME)
        : db.createObjectStore(STORE_NAME);
      if (store) {
        store.delete("device");
        store.delete("state");
        store.delete("tokens");
      }
    };
    request.onblocked = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      reject(new Error("POS_STORAGE_MIGRATION_BLOCKED"));
    };
    request.onsuccess = () => {
      if (settled) {
        request.result.close();
        return;
      }
      settled = true;
      window.clearTimeout(timeout);
      resolve(request.result);
    };
    request.onerror = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      reject(request.error ?? new Error("IndexedDB unavailable"));
    };
  });
}

export async function readState(): Promise<DeviceState> {
  if (typeof window === "undefined") return {};
  try {
    const response = await fetch("/api/pos/auth/me", { credentials: "include", cache: "no-store" });
    if (!response.ok) return {};
    const result = (await response.json()) as {
      user: { id: string; name: string; role: string };
      terminal: { id: string; name: string };
    };
    return {
      user: result.user,
      terminal: result.terminal,
    };
  } catch {
    return {};
  }
}

export async function writeState(_state: DeviceState): Promise<void> {
  // Browser authentication is exclusively held by HttpOnly cookies.
}

export type PendingSale = {
  id: string;
  clientSaleId: string;
  cashierId: string;
  terminalId: string;
  occurredAtClient: string;
  totalMinor: number;
  items: Array<{ productId: string; quantity: number }>;
};

export async function readQueue(): Promise<PendingSale[]> {
  if (typeof indexedDB === "undefined") return [];
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(QUEUE_KEY);
      request.onsuccess = () => resolve(Array.isArray(request.result) ? request.result : []);
      request.onerror = () => reject(request.error ?? new Error("Unable to read offline queue"));
    });
  } catch {
    return [];
  }
}

export async function writeQueue(queue: PendingSale[]): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const request = db
      .transaction(STORE_NAME, "readwrite")
      .objectStore(STORE_NAME)
      .put(queue, QUEUE_KEY);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("Unable to save offline queue"));
  });
}

export type CachedCatalog = {
  version: number;
  products: Array<{
    id: string;
    sku: string;
    barcode: string | null;
    name: string;
    priceMinor: string | number;
    stock: string | number;
  }>;
};

export async function readCatalog(): Promise<CachedCatalog | null> {
  if (typeof indexedDB === "undefined") return null;
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(CATALOG_KEY);
      request.onsuccess = () => resolve((request.result as CachedCatalog | undefined) ?? null);
      request.onerror = () => reject(request.error ?? new Error("Unable to read catalog cache"));
    });
  } catch {
    return null;
  }
}

export async function writeCatalog(catalog: CachedCatalog): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const request = db
      .transaction(STORE_NAME, "readwrite")
      .objectStore(STORE_NAME)
      .put(catalog, CATALOG_KEY);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("Unable to save catalog cache"));
  });
}

export async function clearRevokedPosData(): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    store.delete(QUEUE_KEY);
    store.delete(CATALOG_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("Unable to clear POS offline data"));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("Unable to clear POS offline data"));
  });
}
