'use client';

/**
 * Minimal IndexedDB helper for the offline outbox. No dependency: the store is
 * one object store keyed by an auto-increment id. Everything degrades to a
 * no-op when IndexedDB is unavailable (e.g. private mode), so callers never
 * need to guard.
 */

export interface OutboxRecord {
  id?: number;
  kind: string;
  label: string;
  payload: unknown;
  createdAt: number;
}

const DB_NAME = 'private-identity-vault';
const DB_VERSION = 1;
const OUTBOX = 'outbox';

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(OUTBOX)) {
          db.createObjectStore(OUTBOX, { keyPath: 'id', autoIncrement: true });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    let result: T | null = null;
    const tx = db.transaction(OUTBOX, mode);
    const store = tx.objectStore(OUTBOX);
    const request = run(store);
    request.onsuccess = () => {
      result = request.result;
    };
    request.onerror = () => {
      result = null;
    };
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => resolve(null);
    tx.onabort = () => resolve(null);
  });
}

export async function addOutboxRecord(record: OutboxRecord): Promise<number | null> {
  return withStore<IDBValidKey>('readwrite', (store) => store.add(record)).then((key) =>
    typeof key === 'number' ? key : null,
  );
}

export async function allOutboxRecords(): Promise<OutboxRecord[]> {
  const rows = await withStore<OutboxRecord[]>('readonly', (store) => store.getAll());
  return Array.isArray(rows) ? rows : [];
}

export async function deleteOutboxRecord(id: number): Promise<void> {
  await withStore('readwrite', (store) => store.delete(id));
}

export async function countOutboxRecords(): Promise<number> {
  const count = await withStore<number>('readonly', (store) => store.count());
  return typeof count === 'number' ? count : 0;
}

export async function clearOutboxRecords(): Promise<void> {
  await withStore('readwrite', (store) => store.clear());
}
