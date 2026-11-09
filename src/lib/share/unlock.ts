import 'server-only';
import { cookies } from 'next/headers';
import {
  cookieOptions,
  ownerCookieSecret,
  signCookie,
  verifyCookie,
  type CookiePayload,
} from '@/lib/crypto/cookies';
import { hashToken } from '@/lib/crypto/proofs';

/**
 * Remembers that a visitor typed the correct password for one share link.
 *
 * The cookie is httpOnly and signed, and its path is narrowed to `/s/<token>`
 * so it is only ever sent to that single link (never to another link, the
 * dashboard, or any other route). It is a convenience only: every request still
 * re-validates the link (and its password_hash) against the database.
 */
export const SHARE_UNLOCK_TTL_SECONDS = 15 * 60;

/** Namespaced so it can never collide with an owner or visitor-session cookie. */
export function shareUnlockCookieName(token: string): string {
  return `piv_share_${hashToken(token).slice(0, 12)}`;
}

export function shareUnlockPath(token: string): string {
  return `/s/${token}`;
}

export async function setShareUnlock(token: string): Promise<void> {
  const store = await cookies();
  const signed = signCookie({ h: hashToken(token) }, SHARE_UNLOCK_TTL_SECONDS * 1000, ownerCookieSecret());
  store.set(shareUnlockCookieName(token), signed, cookieOptions(SHARE_UNLOCK_TTL_SECONDS, shareUnlockPath(token)));
}

export async function isShareUnlocked(token: string): Promise<boolean> {
  const store = await cookies();
  const value = store.get(shareUnlockCookieName(token))?.value;
  const result = verifyCookie<CookiePayload>(value, ownerCookieSecret());
  if (!result.ok || typeof result.payload?.h !== 'string') return false;
  return result.payload.h === hashToken(token);
}
