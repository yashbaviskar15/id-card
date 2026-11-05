/**
 * Result type used by every server action and route handler so the UI can render
 * a real error state instead of throwing. Errors are codes, never raw upstream
 * messages (those could leak internals).
 */

export interface Ok<T> {
  ok: true;
  data: T;
}

export interface Err<E extends string = string> {
  ok: false;
  error: E;
  /** Field-level messages for form rendering. */
  fieldErrors?: Record<string, string[]>;
  /** Correlation id for server logs; safe to show to the owner. */
  ref?: string;
}

export type Result<T, E extends string = string> = Ok<T> | Err<E>;

export function ok<T>(data: T): Ok<T> {
  return { ok: true, data };
}

export function err<E extends string = string>(
  error: E,
  extra?: { fieldErrors?: Record<string, string[]>; ref?: string },
): Err<E> {
  return { ok: false, error, ...extra };
}

export function isOk<T, E extends string>(r: Result<T, E>): r is Ok<T> {
  return r.ok;
}

/** Maps a zod flattened fieldErrors object into our fieldErrors shape. */
export function zodFieldErrors(flat: Record<string, string[] | undefined>): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(flat)) {
    if (value?.length) out[key] = value;
  }
  return out;
}
