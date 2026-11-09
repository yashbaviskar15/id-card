'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createUserClient } from '@/lib/db/user';
import { isOwnerEmail, serverEnv } from '@/lib/env.server';
import { clientIpFromHeaders, hashIp, truncateUserAgent } from '@/lib/crypto/ip';
import { hashEmail } from '@/lib/crypto/proofs';
import { hmacHex } from '@/lib/crypto/random';
import { emailSchema, passwordSchema, totpCodeSchema } from '@/lib/validation';
import {
  RATE_LIMITS,
  countAuthFailures,
  isLocked,
  lockFor,
  recordAuthAttempt,
} from '@/lib/rate-limit';
import { writeAudit } from '@/lib/audit';
import { log } from '@/lib/log';
import { alertNewDeviceLogin, alertOwnerLockout, alertPasswordChanged } from '@/lib/mail';
import { clearReauthenticated, markReauthenticated } from '@/lib/auth/reauth';
import { getOwnerIdOrNull } from '@/lib/auth/session';
import { createServiceClient } from '@/lib/db/service';
import type { User } from '@supabase/supabase-js';
import type { FormState } from './form-state';

const GENERIC_ERROR = 'Email or password is incorrect.';
const SAFE_NEXT = /^\/[A-Za-z0-9\-_/?=&%.]*$/;

function safeNext(value: FormDataEntryValue | null): string {
  const raw = typeof value === 'string' ? value : '';
  if (raw && SAFE_NEXT.test(raw) && !raw.startsWith('//')) return raw;
  return '/dashboard';
}

async function requestContext() {
  const h = await headers();
  const ipHash = hashIp(clientIpFromHeaders(h));
  const userAgent = truncateUserAgent(h.get('user-agent'));
  return { ipHash, userAgent };
}

async function verifyTurnstile(token: string | null): Promise<boolean> {
  const env = serverEnv();
  if (!env.TURNSTILE_SECRET_KEY) return true; // not configured: documented in SETUP.md
  if (!token) return false;
  try {
    const body = new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: token });
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body,
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}

/**
 * Shared post-authentication side effects. Runs once the owner is fully
 * authenticated (password-only, or password plus a verified second factor):
 * records the attempt, clears re-authentication, alerts on a first-seen device,
 * and writes the audit entry.
 */
async function finalizeLogin(
  user: User,
  context: { emailHash: string; ipHash: string | null; userAgent: string | null },
): Promise<void> {
  const { emailHash, ipHash, userAgent } = context;
  await recordAuthAttempt({ emailHash, ipHash, success: true });
  await clearReauthenticated();

  const deviceHash = hmacHex(emailHash, `device:${userAgent ?? 'unknown'}`);
  const service = createServiceClient();
  const [deviceResult, settingsResult] = await Promise.all([
    service
      .from('audit_log')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', user.id)
      .eq('action', 'auth.login')
      .filter('detail->>device_hash', 'eq', deviceHash),
    service
      .from('owner_settings')
      .select('alert_on_new_device')
      .eq('owner_id', user.id)
      .maybeSingle(),
  ]);
  if (!deviceResult.count && (settingsResult.data?.alert_on_new_device ?? true)) {
    await alertNewDeviceLogin({ userAgent: userAgent ?? 'unknown device' });
  }

  await writeAudit({
    ownerId: user.id,
    actor: 'owner',
    action: 'auth.login',
    detail: { device_hash: deviceHash },
    ipHash,
    userAgent,
  });
}

/* --------------------------------- sign in -------------------------------- */

export async function signInAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const emailParsed = emailSchema.safeParse(formData.get('email'));
  const password = String(formData.get('password') ?? '');
  // Always pay the same cost: unknown email and wrong password are indistinguishable.
  const email = emailParsed.success ? emailParsed.data : 'invalid@example.invalid';
  const { ipHash, userAgent } = await requestContext();
  const emailHash = hashEmail(email);

  const [emailLocked, ipLocked] = await Promise.all([
    isLocked('email', emailHash),
    ipHash ? isLocked('ip', ipHash) : Promise.resolve(false),
  ]);
  if (emailLocked || ipLocked) {
    return { ok: false, error: 'Too many attempts. Try again in 15 minutes.' };
  }

  const [emailFailures, ipFailures] = await Promise.all([
    countAuthFailures({ emailHash, windowMinutes: RATE_LIMITS.passwordWindowMinutes }),
    ipHash
      ? countAuthFailures({ ipHash, windowMinutes: RATE_LIMITS.passwordWindowMinutes })
      : Promise.resolve(0),
  ]);
  const failures = Math.max(emailFailures, ipFailures);

  if (failures >= RATE_LIMITS.captchaAfterFailures) {
    const token = formData.get('cf-turnstile-response');
    const captchaOk = await verifyTurnstile(typeof token === 'string' ? token : null);
    if (!captchaOk) {
      return { ok: false, error: 'Please complete the verification challenge.', captchaRequired: true };
    }
  }

  const supabase = await createUserClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    await recordAuthAttempt({ emailHash, ipHash, success: false });
    const nextFailures = failures + 1;
    if (
      emailFailures + 1 >= RATE_LIMITS.passwordFailuresPerEmail ||
      (ipHash && ipFailures + 1 >= RATE_LIMITS.passwordFailuresPerIp)
    ) {
      await Promise.all([
        lockFor('email', emailHash, RATE_LIMITS.passwordLockoutMinutes),
        ipHash ? lockFor('ip', ipHash, RATE_LIMITS.passwordLockoutMinutes) : Promise.resolve(),
      ]);
      if (isOwnerEmail(email)) {
        const service = createServiceClient();
        const { data: usersResult } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const ownerId = usersResult.users.find((user) => user.email?.toLowerCase() === email)?.id;
        const { data: settings } = ownerId
          ? await service.from('owner_settings').select('alert_on_lockout').eq('owner_id', ownerId).maybeSingle()
          : { data: null };
        if (settings?.alert_on_lockout ?? true) {
          await alertOwnerLockout({ attempts: nextFailures, windowMinutes: RATE_LIMITS.passwordWindowMinutes });
        }
      }
      // No owner id is known for a failed attempt (the email may not exist), and
      // audit_log.owner_id is a valid FK, so this is logged, not audited.
      log.warn('auth.lockout', { attempts: nextFailures });
    }
    return {
      ok: false,
      error: GENERIC_ERROR,
      captchaRequired: nextFailures >= RATE_LIMITS.captchaAfterFailures,
    };
  }

  // The owner allow-list is enforced server-side.
  if (!isOwnerEmail(data.user.email)) {
    await supabase.auth.signOut();
    await recordAuthAttempt({ emailHash, ipHash, success: false });
    return { ok: false, error: GENERIC_ERROR };
  }

  // If the account has a verified authenticator factor, the password alone is
  // only the first step: require the 6-digit code before finishing the sign-in.
  const { data: factors } = await supabase.auth.mfa.listFactors();
  if ((factors?.totp?.length ?? 0) > 0) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.currentLevel !== 'aal2') {
      await recordAuthAttempt({ emailHash, ipHash, success: true });
      return { ok: false, mfaRequired: true };
    }
  }

  await finalizeLogin(data.user, { emailHash, ipHash, userAgent });
  redirect(safeNext(formData.get('next')));
}

/* ----------------------------- two-factor step ---------------------------- */

/**
 * Completes a sign-in that required a second factor. The session is at aal1
 * after the password step; verifying the TOTP code raises it to aal2.
 */
export async function verifyMfaLoginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const next = safeNext(formData.get('next'));
  const parsed = totpCodeSchema.safeParse(formData.get('code'));
  if (!parsed.success) {
    return { ok: false, mfaRequired: true, error: 'Enter the 6-digit code from your authenticator app.' };
  }

  const supabase = await createUserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isOwnerEmail(user.email)) {
    return { ok: false, error: 'Your sign-in session has ended. Sign in again.' };
  }

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel === 'aal2') {
    redirect(next);
  }

  const { data: factors } = await supabase.auth.mfa.listFactors();
  const factor = factors?.totp?.[0];
  if (!factor) {
    return { ok: false, error: 'Two-factor is not set up for this account. Sign in again.' };
  }

  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
    factorId: factor.id,
  });
  if (challengeError || !challenge) {
    return { ok: false, mfaRequired: true, error: 'The two-factor check could not start. Try again.' };
  }

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId: factor.id,
    challengeId: challenge.id,
    code: parsed.data,
  });
  if (verifyError) {
    const { ipHash, userAgent } = await requestContext();
    await writeAudit({ ownerId: user.id, actor: 'owner', action: 'auth.mfa_verify_failed', ipHash, userAgent });
    return { ok: false, mfaRequired: true, error: 'That code is not valid. Check your authenticator app and try again.' };
  }

  const { ipHash, userAgent } = await requestContext();
  const emailHash = hashEmail(user.email ?? 'unknown@example.invalid');
  await finalizeLogin(user, { emailHash, ipHash, userAgent });
  redirect(next);
}

/* ------------------------------ sign out ---------------------------------- */

export async function signOutAction(): Promise<void> {
  const supabase = await createUserClient();
  await supabase.auth.signOut();
  redirect('/login');
}

/* --------------------------- forgot password ------------------------------ */

export async function requestPasswordResetAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = emailSchema.safeParse(formData.get('email'));
  // Same response whether or not the address is the owner's (no enumeration).
  const successMessage = 'If that address belongs to the account, a reset link is on its way.';
  if (!parsed.success) return { ok: true, message: successMessage };

  if (isOwnerEmail(parsed.data)) {
    const supabase = await createUserClient();
    const site = process.env.NEXT_PUBLIC_SITE_URL ?? '';
    await supabase.auth.resetPasswordForEmail(parsed.data, {
      redirectTo: `${site}/auth/callback?next=/reset`,
    });
  }
  return { ok: true, message: successMessage };
}

/* --------------------------- change password ------------------------------ */

export async function changePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const ownerId = await getOwnerIdOrNull();
  if (!ownerId) return { ok: false, error: 'Your session has ended. Sign in again.' };

  const current = String(formData.get('current_password') ?? '');
  const next = formData.get('new_password');
  const confirm = formData.get('confirm_password');
  if (next !== confirm) return { ok: false, error: 'The new passwords do not match.' };

  const parsed = passwordSchema.safeParse(next);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Password is too weak.' };
  }

  const supabase = await createUserClient();
  const email = (await supabase.auth.getUser()).data.user?.email;
  if (!email) return { ok: false, error: 'Your session has ended. Sign in again.' };

  // Confirm the current password before allowing the change.
  const check = await supabase.auth.signInWithPassword({ email, password: current });
  if (check.error) return { ok: false, error: 'Your current password is incorrect.' };

  const { error } = await supabase.auth.updateUser({ password: parsed.data });
  if (error) return { ok: false, error: 'Could not update the password. Try again.' };

  // Password change and session revocation are separate operations.
  let otherSessionsSignedOut = true;
  try {
    const { error: signOutError } = await supabase.auth.signOut({ scope: 'others' });
    otherSessionsSignedOut = !signOutError;
    if (signOutError) {
      log.warn('auth.password_changed session revocation failed', { message: signOutError.message });
    }
  } catch (cause) {
    otherSessionsSignedOut = false;
    log.warn('auth.password_changed session revocation failed', {
      message: cause instanceof Error ? cause.message : 'unknown error',
    });
  }
  await clearReauthenticated();

  const { ipHash, userAgent } = await requestContext();
  await writeAudit({ ownerId, actor: 'owner', action: 'auth.password_changed', ipHash, userAgent });
  await alertPasswordChanged();
  return {
    ok: true,
    message: otherSessionsSignedOut
      ? 'Password changed. Every other device has been signed out.'
      : 'Password changed, but other devices could not be signed out. Sign them out from session security.',
  };
}

/* ---------------------------- complete reset ------------------------------ */

export async function completeResetAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createUserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isOwnerEmail(user.email)) {
    return { ok: false, error: 'The reset link is invalid or has expired. Request a new one.' };
  }
  if (formData.get('new_password') !== formData.get('confirm_password')) {
    return { ok: false, error: 'The passwords do not match.' };
  }
  const parsed = passwordSchema.safeParse(formData.get('new_password'));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Password is too weak.' };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data });
  if (error) {
    return { ok: false, error: 'Could not set the new password. The link may have expired.' };
  }
  await supabase.auth.signOut({ scope: 'others' }).catch(() => {});
  await clearReauthenticated();

  const { ipHash, userAgent } = await requestContext();
  await writeAudit({ ownerId: user.id, actor: 'owner', action: 'auth.password_reset', ipHash, userAgent });
  await alertPasswordChanged();
  redirect('/login?reset=1');
}

/* ------------------------- re-authentication ------------------------------ */

export async function reauthAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const ownerId = await getOwnerIdOrNull();
  if (!ownerId) return { ok: false, error: 'Your session has ended. Sign in again.' };
  const password = String(formData.get('password') ?? '');
  if (!password) return { ok: false, error: 'Enter your password.' };

  const supabase = await createUserClient();
  const email = (await supabase.auth.getUser()).data.user?.email;
  if (!email) return { ok: false, error: 'Your session has ended. Sign in again.' };

  const check = await supabase.auth.signInWithPassword({ email, password });
  if (check.error) {
    const { ipHash, userAgent } = await requestContext();
    await writeAudit({ ownerId, actor: 'owner', action: 'auth.reauth_failed', ipHash, userAgent });
    return { ok: false, error: 'Incorrect password.' };
  }

  await markReauthenticated(ownerId);
  const { ipHash, userAgent } = await requestContext();
  await writeAudit({ ownerId, actor: 'owner', action: 'auth.reauth', ipHash, userAgent });
  return { ok: true, message: 'Verified. You can continue for the next 5 minutes.' };
}
