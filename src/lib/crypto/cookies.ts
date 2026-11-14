import 'server-only';
import { serverEnv } from '@/lib/env.server';
import { hmacHex, timingSafeEqualString } from '@/lib/crypto/random';

/**
 * Signed cookie payloads.
 *
 * Format: base64url(json) + "." + base64url(HMAC-SHA256(payload)).
 * Every cookie we issue is verified server-side on every request: signature
 * first (constant time), then expiry. Nothing in a cookie is trusted on its own.
 */

export interface CookiePayload {
  iat: number;
  exp: number;
  [key: string]: unknown;
}

function b64url(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64url');
}

export function signCookie(payload: Record<string, unknown>, ttlMs: number, secret: string): string {
  const now = Date.now();
  const full: CookiePayload = { ...payload, iat: now, exp: now + ttlMs };
  const body = b64url(JSON.stringify(full));
  return `${body}.${hmacHex(secret, body)}`;
}

export interface VerifyResult<T extends CookiePayload> {
  ok: boolean;
  payload?: T;
  reason?: 'malformed' | 'bad-signature' | 'expired';
}

export function verifyCookie<T extends CookiePayload>(
  token: string | undefined,
  secret: string,
): VerifyResult<T> {
  if (!token) return { ok: false, reason: 'malformed' };
  const separator = token.lastIndexOf('.');
  if (separator <= 0) return { ok: false, reason: 'malformed' };
  const body = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  if (!timingSafeEqualString(hmacHex(secret, body), signature)) {
    return { ok: false, reason: 'bad-signature' };
  }
  let payload: T;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as T;
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  if (typeof payload.exp !== 'number' || payload.exp <= Date.now()) {
    return { ok: false, reason: 'expired' };
  }
  return { ok: true, payload };
}

/* ------------------------------------------------------------------ */
/* Cookie names and options                                            */
/* ------------------------------------------------------------------ */

export const OWNER_REAUTH_COOKIE = 'piv_reauth';
export const OWNER_SESSION_START_COOKIE = 'piv_session_start';
export const OWNER_ACTIVITY_COOKIE = 'piv_activity';

/** Visitor session cookie is scoped to the slug path so it cannot leak across profiles. */
export function visitorCookieName(slug: string): string {
  return `piv_v_${slug.slice(0, 8)}`;
}

/**
 * Private-album cookie. Separate from the visitor session on purpose: it is
 * minted only after the owner's album password has been verified, so holding a
 * valid access code alone is never enough to reach the photos.
 */
export function albumCookieName(slug: string): string {
  return `piv_a_${slug.slice(0, 8)}`;
}

/**
 * How long a successful password re-check stays valid. 30 minutes keeps the
 * card-and-code workflow (hand out a code, share a link) free of repeated
 * password prompts without weakening the sign-in session itself.
 */
export const OWNER_REAUTH_TTL_MS = 30 * 60 * 1000;

export interface CookieOptions {
  httpOnly: true;
  secure: true;
  sameSite: 'lax';
  path: string;
  maxAge: number;
}

/**
 * All cookies are httpOnly, Secure and SameSite=Lax. Path is narrowed to the
 * slug for visitor sessions so the cookie is only ever sent to that profile.
 */
export function cookieOptions(maxAgeSeconds: number, path = '/'): CookieOptions {
  return { httpOnly: true, secure: true, sameSite: 'lax', path, maxAge: Math.max(0, Math.floor(maxAgeSeconds)) };
}

export function ownerCookieSecret(): string {
  return serverEnv().SESSION_COOKIE_SECRET;
}
