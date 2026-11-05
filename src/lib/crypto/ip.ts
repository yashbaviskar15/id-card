import 'server-only';
import { serverEnv } from '@/lib/env.server';
import { hmacHex } from '@/lib/crypto/random';

/**
 * Coarse client address handling. The raw IP is never stored and never logged —
 * it is immediately reduced to a keyed, truncated digest that is useless outside
 * this application and cannot be reversed to an address.
 */
export function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  const normalized = ip.trim().toLowerCase();
  if (!normalized) return null;
  const { IP_HASH_SECRET } = serverEnv();
  return hmacHex(IP_HASH_SECRET, `ip:${normalized}`).slice(0, 24);
}

/**
 * Extracts the caller's address from proxy headers. Vercel sets x-forwarded-for
 * (nearest hop first) and x-real-ip; we only ever keep the first entry.
 */
export function clientIpFromHeaders(headers: Headers): string | null {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return headers.get('x-real-ip')?.trim() || null;
}

export function truncateUserAgent(userAgent: string | null | undefined): string | null {
  if (!userAgent) return null;
  return userAgent.slice(0, 200);
}
