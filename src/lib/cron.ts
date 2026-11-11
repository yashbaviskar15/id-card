import 'server-only';
import { timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { serverEnv } from '@/lib/env.server';

/**
 * Guard for the scheduled (Vercel Cron) endpoints.
 *
 * Vercel sends the configured CRON_SECRET as `Authorization: Bearer <secret>`.
 * A request without a matching token is refused, and when CRON_SECRET is not
 * configured the endpoints stay closed rather than open — an unconfigured
 * deployment therefore exposes nothing.
 */
export function isCronAuthorized(request: NextRequest): boolean {
  let secret: string | undefined;
  try {
    secret = serverEnv().CRON_SECRET;
  } catch {
    return false;
  }
  if (!secret) return false;

  const provided = Buffer.from(request.headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${secret}`);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}
