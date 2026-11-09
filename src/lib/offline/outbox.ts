'use client';

import {
  addOutboxRecord,
  allOutboxRecords,
  clearOutboxRecords,
  countOutboxRecords,
  deleteOutboxRecord,
} from './store';

/**
 * Offline write queue. Mutations made without a connection are stored here and
 * replayed, in order, once the device is back online. A handler must be
 * registered for each `kind` (see `handlers.ts`); the handler calls the same
 * server action the online path uses, so there is a single source of truth for
 * validation and side effects.
 */

export interface ActionOutcome {
  ok: boolean;
  error?: string;
}

export type OutboxHandler = (payload: never) => Promise<ActionOutcome>;

const handlers = new Map<string, OutboxHandler>();
const listeners = new Set<() => void>();
let flushing = false;

export function registerHandler(kind: string, handler: OutboxHandler): void {
  handlers.set(kind, handler);
}

export function subscribeToOutbox(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit(): void {
  for (const listener of listeners) listener();
}

export function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

export async function enqueue(kind: string, label: string, payload: unknown): Promise<boolean> {
  const id = await addOutboxRecord({ kind, label, payload, createdAt: Date.now() });
  if (id === null) return false;
  emit();
  if (!isOffline()) void flush();
  return true;
}

export async function pendingCount(): Promise<number> {
  return countOutboxRecords();
}

export async function clearQueue(): Promise<void> {
  await clearOutboxRecords();
  emit();
}

/**
 * Replays queued actions oldest-first. Stops at the first handler that throws
 * (still offline) or returns an error, keeping that item so nothing is lost.
 */
export async function flush(): Promise<void> {
  if (flushing) return;
  if (isOffline()) return;
  flushing = true;
  let changed = false;
  try {
    const items = await allOutboxRecords();
    for (const item of items) {
      if (typeof item.id !== 'number') continue;
      const handler = handlers.get(item.kind);
      if (!handler) {
        await deleteOutboxRecord(item.id);
        changed = true;
        continue;
      }
      let outcome: ActionOutcome;
      try {
        outcome = await handler(item.payload as never);
      } catch {
        break; // network failure: keep the item and retry later
      }
      if (outcome.ok) {
        await deleteOutboxRecord(item.id);
        changed = true;
        continue;
      }
      if (outcome.error) {
        // A validation/permission error will not resolve by retrying the same
        // payload: keep it visible for the user, but stop the run so newer
        // items behind it are not lost.
        break;
      }
      break;
    }
  } finally {
    flushing = false;
    if (changed) emit();
  }
}
