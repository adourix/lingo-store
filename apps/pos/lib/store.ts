export type DeviceState = {
  deviceCredential?: string;
  accessToken?: string;
  refreshToken?: string;
  user?: { id: string; name: string; role: string };
  terminal?: { id: string; name: string };
};

const DB_NAME = "lingo-pos";
const STORE_NAME = "state";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB unavailable"));
  });
}

export async function readState(): Promise<DeviceState> {
  if (typeof indexedDB === "undefined") return {};
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get("device");
    request.onsuccess = () => resolve((request.result as DeviceState | undefined) ?? {});
    request.onerror = () => reject(request.error ?? new Error("Unable to read POS state"));
  });
}

export async function writeState(state: DeviceState): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put(state, "device");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("Unable to save POS state"));
  });
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
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get("queue");
    request.onsuccess = () => resolve((request.result as PendingSale[] | undefined) ?? []);
    request.onerror = () => reject(request.error ?? new Error("Unable to read offline queue"));
  });
}

export async function writeQueue(queue: PendingSale[]): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put(queue, "queue");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("Unable to save offline queue"));
  });
}
