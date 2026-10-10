export type DeviceState = {
  deviceCredential?: string;
  accessToken?: string;
  refreshToken?: string;
  user?: { id: string; name: string; role: string };
  terminal?: { id: string; name: string };
};

const DB_NAME = "lingo-pos";
const STORE_NAME = "state";
const KEY_ID = "__device_storage_key";
const encoder = new TextEncoder();
const decoder = new TextDecoder();

type EncryptedValue = { version: 1; iv: ArrayBuffer; ciphertext: ArrayBuffer };

function isEncryptedValue(value: unknown): value is EncryptedValue {
  return (
    typeof value === "object" &&
    value !== null &&
    "version" in value &&
    value.version === 1 &&
    "iv" in value &&
    value.iv instanceof ArrayBuffer &&
    "ciphertext" in value &&
    value.ciphertext instanceof ArrayBuffer
  );
}

async function storageKey(db: IDBDatabase): Promise<CryptoKey> {
  const existing = await new Promise<unknown>((resolve, reject) => {
    const request = db
      .transaction(STORE_NAME, "readonly")
      .objectStore(STORE_NAME)
      .get(KEY_ID);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Unable to read POS storage key"));
  });
  if (
    existing instanceof CryptoKey &&
    existing.algorithm.name === "AES-GCM" &&
    !existing.extractable &&
    existing.usages.includes("encrypt") &&
    existing.usages.includes("decrypt")
  )
    return existing;
  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
  await new Promise<void>((resolve, reject) => {
    const request = db
      .transaction(STORE_NAME, "readwrite")
      .objectStore(STORE_NAME)
      .put(key, KEY_ID);
    request.onsuccess = () => resolve();
    request.onerror = () =>
      reject(
        request.error ??
          new Error("Unable to initialize encrypted POS storage"),
      );
  });
  return key;
}

async function encrypt<T>(db: IDBDatabase, value: T): Promise<EncryptedValue> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await storageKey(db),
    encoder.encode(JSON.stringify(value)),
  );
  return { version: 1, iv: iv.buffer, ciphertext };
}

async function decrypt<T>(
  db: IDBDatabase,
  value: unknown,
  key: IDBValidKey,
): Promise<T | undefined> {
  if (!isEncryptedValue(value)) {
    // Older versions stored tokens and offline sales in plaintext. Erase them on upgrade/use.
    await new Promise<void>((resolve, reject) => {
      const request = db
        .transaction(STORE_NAME, "readwrite")
        .objectStore(STORE_NAME)
        .delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () =>
        reject(
          request.error ?? new Error("Unable to remove unencrypted POS data"),
        );
    });
    return undefined;
  }
  try {
    if (value.iv.byteLength !== 12 || value.ciphertext.byteLength < 16)
      throw new Error("Invalid encrypted POS record");
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: value.iv },
      await storageKey(db),
      value.ciphertext,
    );
    return JSON.parse(decoder.decode(plaintext)) as T;
  } catch {
    // Authentication failure or an unavailable key must never leave stale credentials reusable.
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      store.delete("device");
      store.delete("queue");
      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(transaction.error ?? new Error("Unable to clear unreadable POS data"));
      transaction.onabort = () =>
        reject(transaction.error ?? new Error("Unable to clear unreadable POS data"));
    });
    throw new Error("POS_STORAGE_UNREADABLE");
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = (event) => {
      const store =
        request.transaction?.objectStore(STORE_NAME) ??
        request.result.createObjectStore(STORE_NAME);
      // The previous version kept bearer credentials and queued sales in plaintext.
      if (event.oldVersion < 2) {
        store.delete("device");
        store.delete("queue");
      }
    };
    request.onblocked = () =>
      reject(new Error("POS_STORAGE_MIGRATION_BLOCKED"));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB unavailable"));
  });
}

export async function readState(): Promise<DeviceState> {
  if (typeof indexedDB === "undefined") return {};
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db
      .transaction(STORE_NAME, "readonly")
      .objectStore(STORE_NAME)
      .get("device");
    request.onsuccess = () => {
      void decrypt<DeviceState>(db, request.result, "device").then(
        (state) => resolve(state ?? {}),
        reject,
      );
    };
    request.onerror = () =>
      reject(request.error ?? new Error("Unable to read POS state"));
  });
}

export async function writeState(state: DeviceState): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    void encrypt(db, state).then((encrypted) => {
      const request = db
        .transaction(STORE_NAME, "readwrite")
        .objectStore(STORE_NAME)
        .put(encrypted, "device");
      request.onsuccess = () => resolve();
      request.onerror = () =>
        reject(request.error ?? new Error("Unable to save POS state"));
    }, reject);
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
    const request = db
      .transaction(STORE_NAME, "readonly")
      .objectStore(STORE_NAME)
      .get("queue");
    request.onsuccess = () => {
      void decrypt<PendingSale[]>(db, request.result, "queue").then(
        (queue) => resolve(queue ?? []),
        reject,
      );
    };
    request.onerror = () =>
      reject(request.error ?? new Error("Unable to read offline queue"));
  });
}

export async function writeQueue(queue: PendingSale[]): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    void encrypt(db, queue).then((encrypted) => {
      const request = db
        .transaction(STORE_NAME, "readwrite")
        .objectStore(STORE_NAME)
        .put(encrypted, "queue");
      request.onsuccess = () => resolve();
      request.onerror = () =>
        reject(request.error ?? new Error("Unable to save offline queue"));
    }, reject);
  });
}

export async function clearRevokedPosData(): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    store.delete("device");
    store.delete("queue");
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Unable to clear revoked POS data"));
    transaction.onabort = () => reject(transaction.error ?? new Error("Unable to clear revoked POS data"));
  });
}
