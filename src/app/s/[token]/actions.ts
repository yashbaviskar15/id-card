'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServiceClient } from '@/lib/db/service';
import { hashToken } from '@/lib/crypto/proofs';
import { verifyPassword } from '@/lib/crypto/password';
import { clientIpFromHeaders, hashIp } from '@/lib/crypto/ip';
import { RATE_LIMITS, countAuthFailures, isLocked, lockFor, recordAuthAttempt } from '@/lib/rate-limit';
import { shareTokenSchema } from '@/lib/share/load';
import { setShareUnlock } from '@/lib/share/unlock';
import type { FormState } from '@/app/(auth)/form-state';

/** One identical message for a wrong password, an unknown link and a dead link. */
const INCORRECT = 'That password is not correct.';
const LOCKED = 'Too many attempts. Try again in a few minutes.';

/**
 * Verifies the password of a protected share link. The attempt is rate-limited
 * by token + IP; on success a short-lived, path-scoped signed cookie remembers
 * the unlock so the visitor can download without re-typing it.
 *
 * The password and the token are never logged.
 */
export async function unlockShareAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const tokenParsed = shareTokenSchema.safeParse(formData.get('token'));
  const password = String(formData.get('password') ?? '');
  if (!tokenParsed.success || password.length === 0) {
    return { ok: false, error: 'Enter the password to continue.' };
  }
  const token = tokenParsed.data;

  const headerList = await headers();
  const ipHash = hashIp(clientIpFromHeaders(headerList));
  const tokenHash = hashToken(token);
  const lockKey = `share:${tokenHash}:${ipHash ?? 'no-ip'}`;

  if (await isLocked('share', lockKey)) {
    return { ok: false, error: LOCKED };
  }

  const supabase = createServiceClient();
  const { data } = await supabase
    .from('share_links')
    .select('password_hash, expires_at, revoked_at')
    .eq('token_hash', tokenHash)
    .maybeSingle<{ password_hash: string | null; expires_at: string; revoked_at: string | null }>();

  if (!data || data.revoked_at || Date.parse(data.expires_at) <= Date.now()) {
    return { ok: false, error: INCORRECT };
  }

  // A link with no password needs no unlock; just remember it and continue.
  if (!data.password_hash) {
    await setShareUnlock(token);
    redirect(`/s/${token}`);
  }

  const ok = await verifyPassword(data.password_hash, password);
  if (!ok) {
    await recordAuthAttempt({ emailHash: lockKey, ipHash, success: false });
    const failures = await countAuthFailures({ emailHash: lockKey, windowMinutes: RATE_LIMITS.shareWindowMinutes });
    if (failures >= RATE_LIMITS.sharePasswordFailures) {
      await lockFor('share', lockKey, RATE_LIMITS.shareWindowMinutes);
    }
    return { ok: false, error: INCORRECT };
  }

  await recordAuthAttempt({ emailHash: lockKey, ipHash, success: true });
  await setShareUnlock(token);
  redirect(`/s/${token}`);
}
