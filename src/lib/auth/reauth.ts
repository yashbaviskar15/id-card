import 'server-only';
import { cookies } from 'next/headers';
import {
  OWNER_REAUTH_COOKIE,
  OWNER_REAUTH_TTL_MS,
  cookieOptions,
  ownerCookieSecret,
  signCookie,
  verifyCookie,
  type CookiePayload,
} from '@/lib/crypto/cookies';
import { getOwnerIdOrNull } from '@/lib/auth/session';

/**
 * Re-authentication gate. Sensitive actions require the owner to have entered
 * their password within the last 5 minutes.
 */
export class ReauthRequiredError extends Error {
  constructor() {
    super('REAUTH_REQUIRED');
    this.name = 'ReauthRequiredError';
  }
}

export async function markReauthenticated(ownerId: string): Promise<void> {
  const store = await cookies();
  const token = signCookie({ sub: ownerId }, OWNER_REAUTH_TTL_MS, ownerCookieSecret());
  store.set(OWNER_REAUTH_COOKIE, token, cookieOptions(OWNER_REAUTH_TTL_MS / 1000));
}

export async function clearReauthenticated(): Promise<void> {
  const store = await cookies();
  store.delete(OWNER_REAUTH_COOKIE);
}

export async function isReauthenticated(): Promise<boolean> {
  const store = await cookies();
  const token = store.get(OWNER_REAUTH_COOKIE)?.value;
  const result = verifyCookie<CookiePayload>(token, ownerCookieSecret());
  if (!result.ok || typeof result.payload?.sub !== 'string') return false;
  const ownerId = await getOwnerIdOrNull();
  return ownerId !== null && result.payload.sub === ownerId;
}

export async function requireReauth(): Promise<void> {
  if (!(await isReauthenticated())) throw new ReauthRequiredError();
}
