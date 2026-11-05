import 'server-only';
import { serverEnv } from '@/lib/env.server';
import { hmacHex, timingSafeEqualString } from '@/lib/crypto/random';

/**
 * The access code is only ever stored as a keyed hash, and the hash is bound to
 * the profile slug so a code cannot be replayed against another profile.
 */
export function buildAccessCodeProof(slug: string, code: string): string {
  const { ACCESS_CODE_SECRET } = serverEnv();
  return hmacHex(ACCESS_CODE_SECRET, `${slug}:${code}`);
}

export function accessCodeMatches(slug: string, code: string, storedCodeHash: string): boolean {
  return timingSafeEqualString(buildAccessCodeProof(slug, code), storedCodeHash);
}

/** Pseudonymised email used by the password rate limiter (never the raw address). */
export function hashEmail(email: string): string {
  const { IP_HASH_SECRET } = serverEnv();
  return hmacHex(IP_HASH_SECRET, `email:${email.trim().toLowerCase()}`).slice(0, 32);
}

/** SHA-256 style hash for share-link tokens (fast, high-entropy input). */
export function hashToken(token: string): string {
  const { SESSION_COOKIE_SECRET } = serverEnv();
  return hmacHex(SESSION_COOKIE_SECRET, `token:${token}`);
}
