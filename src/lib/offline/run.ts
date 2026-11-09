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
    await enqueue(options.kind, options.label, options.payload);
    return { queued: true, result: { ok: true, queued: true } };
  }

  try {
    const result = await options.run();
    return { queued: false, result };
  } catch {
    // The request threw instead of returning a verdict: almost always a dropped
    // connection. Queue it rather than losing the user's edit.
    await enqueue(options.kind, options.label, options.payload);
    return { queued: true, result: { ok: true, queued: true } };
  }
}
