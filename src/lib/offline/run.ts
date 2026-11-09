'use client';

import { enqueue, isOffline } from './outbox';

export interface QueuedResult {
  ok: true;
  queued: true;
  error?: string;
}

export interface RunOutcome<T> {
  queued: boolean;
  result: T;
}

/**
 * Runs an action now, or queues it for later when the device is offline (or the
 * call fails because the connection dropped). Keeps the same server action as
 * the single source of truth in both paths.
 */
export async function runOrQueue<T extends { ok: boolean; error?: string }>(
  options: {
    kind: string;
    label: string;
    payload: unknown;
    run: () => Promise<T>;
  },
): Promise<RunOutcome<T | QueuedResult>> {
  if (isOffline()) {
    const stored = await enqueue(options.kind, options.label, options.payload);
    return stored
      ? { queued: true, result: { ok: true, queued: true } }
      : {
          queued: false,
          result: { ok: false, error: 'This change could not be stored on this device. Check browser storage and try again.' } as T,
        };
  }

  try {
    const result = await options.run();
    return { queued: false, result };
  } catch {
    // Do not persist a payload for an application/server error while online.
    if (!isOffline()) {
      return {
        queued: false,
        result: { ok: false, error: 'The save failed. Check your connection and try again.' } as T,
      };
    }
    const stored = await enqueue(options.kind, options.label, options.payload);
    return stored
      ? { queued: true, result: { ok: true, queued: true } }
      : {
          queued: false,
          result: { ok: false, error: 'The connection dropped and this change could not be stored on this device.' } as T,
        };
  }
}
