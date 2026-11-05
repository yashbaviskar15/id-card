import 'server-only';
import { createServiceClient } from '@/lib/db/service';
import { log } from '@/lib/log';

/**
 * Windowed rate limiting backed by Postgres tables (no mutable in-memory
 * counters to race on, and it survives a cold start).
 */

export type LockScope = 'slug' | 'email' | 'ip' | 'share';

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
} as const;
