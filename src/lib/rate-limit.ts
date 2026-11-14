import 'server-only';
import { createServiceClient } from '@/lib/db/service';
import { log } from '@/lib/log';

/**
 * Windowed rate limiting backed by Postgres tables (no mutable in-memory
 * counters to race on, and it survives a cold start).
 */

export type LockScope = 'slug' | 'email' | 'ip' | 'share' | 'action' | 'photo';

export async function isLocked(scope: LockScope, keyHash: string): Promise<boolean> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('lockouts')
    .select('locked_until')
    .eq('scope', scope)
    .eq('key_hash', keyHash)
    .gt('locked_until', new Date().toISOString())
    .maybeSingle();
  if (error) {
    log.warn('rate-limit.isLocked failed', { code: error.code });
    return false;
  }
  return Boolean(data);
}

export async function lockFor(scope: LockScope, keyHash: string, minutes: number): Promise<void> {
  const supabase = createServiceClient();
  const lockedUntil = new Date(Date.now() + minutes * 60_000).toISOString();
  const { error } = await supabase
    .from('lockouts')
    .upsert({ scope, key_hash: keyHash, locked_until: lockedUntil }, { onConflict: 'scope,key_hash' });
  if (error) log.warn('rate-limit.lockFor failed', { code: error.code });
}

export async function recordAuthAttempt(input: {
  emailHash: string;
  ipHash: string | null;
  success: boolean;
}): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase.from('auth_attempts').insert({
    email_hash: input.emailHash,
    ip_hash: input.ipHash,
    success: input.success,
  });
  if (error) log.warn('rate-limit.recordAuthAttempt failed', { code: error.code });
}

/**
 * Counts failed attempts in a window. When `ipHash` is provided the count is
 * scoped to that IP, otherwise it is scoped to the email only.
 */
export async function countAuthFailures(input: {
  emailHash?: string;
  ipHash?: string;
  windowMinutes: number;
}): Promise<number> {
  const supabase = createServiceClient();
  const since = new Date(Date.now() - input.windowMinutes * 60_000).toISOString();
  let query = supabase
    .from('auth_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('success', false)
    .gt('created_at', since);
  if (input.emailHash) query = query.eq('email_hash', input.emailHash);
  if (input.ipHash) query = query.eq('ip_hash', input.ipHash);
  const { count, error } = await query;
  if (error) {
    log.warn('rate-limit.countAuthFailures failed', { code: error.code });
    return 0;
  }
  return count ?? 0;
}

export const RATE_LIMITS = {
  passwordFailuresPerEmail: 5,
  passwordFailuresPerIp: 5,
  passwordWindowMinutes: 15,
  passwordLockoutMinutes: 15,
  captchaAfterFailures: 3,
  codeFailuresPerIp: 5,
  codeWindowMinutes: 10,
  codeSlugLockoutAfter: 10,
  codeSlugLockoutMinutes: 15,
  sharePasswordFailures: 5,
  shareWindowMinutes: 15,
  // Private-photo album unlock (owner password + access code). Tighter than the
  // profile gate because the password is the only thing standing between a
  // holder of a valid code and the album.
  photoFailuresPerIp: 5,
  photoWindowMinutes: 15,
  photoLockoutMinutes: 15,
  // Throttle for authenticated mutation actions (issue a code, create a share
  // link, upload, edit information). Generous enough for normal use, tight
  // enough that a scripted or runaway client cannot hammer the database.
  ownerActionPerWindow: 20,
  ownerActionWindowMinutes: 5,
  ownerActionLockoutMinutes: 5,
  // Step-up / secondary forms that are not the password sign-in: the
  // reset-email request, re-authentication before a sensitive action, and the
  // second factor. A caller that fails these is throttled per IP or per owner.
  passwordResetPerIp: 3,
  passwordResetWindowMinutes: 30,
  reauthFailuresPerOwner: 5,
  reauthWindowMinutes: 15,
  reauthLockoutMinutes: 15,
  mfaVerifyFailuresPerOwner: 5,
  mfaVerifyWindowMinutes: 15,
  mfaVerifyLockoutMinutes: 15,
} as const;

export type OwnerActionVerdict =
  | { allowed: true }
  | { allowed: false; retryAfterMinutes: number };

/**
 * Per-owner throttle for authenticated write actions. Counts recent events for
 * the same owner and action inside a sliding window; crossing the limit sets a
 * short lockout. Fails open: if the bookkeeping tables are unreachable (for
 * example a pending migration) the action is allowed rather than blocked, so
 * this can never take the dashboard down on its own.
 */
export async function guardOwnerAction(
  ownerId: string,
  action: string,
): Promise<OwnerActionVerdict> {
  const key = `owner-action:${ownerId}:${action}`;
  const { ownerActionPerWindow, ownerActionWindowMinutes, ownerActionLockoutMinutes } = RATE_LIMITS;
  try {
    if (await isLocked('action', key)) {
      return { allowed: false, retryAfterMinutes: ownerActionLockoutMinutes };
    }

    const supabase = createServiceClient();
    const since = new Date(Date.now() - ownerActionWindowMinutes * 60_000).toISOString();
    const { count, error: countError } = await supabase
      .from('owner_action_events')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', ownerId)
      .eq('action', action)
      .gt('created_at', since);
    if (countError) {
      log.warn('rate-limit.guardOwnerAction count failed', { code: countError.code });
      return { allowed: true };
    }
    if ((count ?? 0) >= ownerActionPerWindow) {
      await lockFor('action', key, ownerActionLockoutMinutes);
      return { allowed: false, retryAfterMinutes: ownerActionLockoutMinutes };
    }

    const { error: insertError } = await supabase
      .from('owner_action_events')
      .insert({ owner_id: ownerId, action });
    if (insertError) log.warn('rate-limit.guardOwnerAction insert failed', { code: insertError.code });
    return { allowed: true };
  } catch (cause) {
    log.warn('rate-limit.guardOwnerAction threw', {
      message: cause instanceof Error ? cause.message : 'unknown',
    });
    return { allowed: true };
  }
}

export interface AttemptLimits {
  maxAttempts: number;
  windowMinutes: number;
  lockoutMinutes: number;
}

/**
 * Sliding-window guard for the step-up forms that are not the password sign-in
 * (reset-email request, re-authentication, second-factor verify). Reuses the
 * same `auth_attempts` / `lockouts` bookkeeping as the login limiter, so there
 * is one mechanism and no schema change. Call `isAttemptLocked` before the
 * expensive work and `noteAttempt` after a request/failed check; crossing the
 * limit sets a lockout. The `key` is namespaced by the caller (e.g. `reauth:*`)
 * so these counters never mix with the real login failure counters.
 */
export async function isAttemptLocked(scope: LockScope, key: string): Promise<boolean> {
  return isLocked(scope, key);
}

export async function noteAttempt(
  scope: LockScope,
  key: string,
  limits: AttemptLimits,
): Promise<void> {
  await recordAuthAttempt({ emailHash: key, ipHash: null, success: false });
  const failures = await countAuthFailures({ emailHash: key, windowMinutes: limits.windowMinutes });
  if (failures >= limits.maxAttempts) {
    await lockFor(scope, key, limits.lockoutMinutes);
  }
}
