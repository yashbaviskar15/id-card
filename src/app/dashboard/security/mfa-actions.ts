'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { z } from 'zod';
import QRCode from 'qrcode';
import { requireOwner } from '@/lib/auth/session';
import { isReauthenticated } from '@/lib/auth/reauth';
import { createUserClient } from '@/lib/db/user';
import { clientIpFromHeaders, hashIp, truncateUserAgent } from '@/lib/crypto/ip';
import { generateRecoveryCode } from '@/lib/crypto/random';
import { hashPassword } from '@/lib/crypto/password';
import { writeAudit } from '@/lib/audit';
import { alertRecoveryCodesRegenerated } from '@/lib/mail';
import { totpCodeSchema } from '@/lib/validation';
import { log } from '@/lib/log';

/**
 * Two-factor authentication (Supabase Auth MFA, TOTP) and the owner's one-time
 * recovery codes. Recovery codes are stored only as argon2id hashes in
 * `backup_recovery_codes`; the plaintext is returned exactly once and never
 * logged. Every write is owner-scoped (RLS on the user client).
 */

const SECURITY_PATH = '/dashboard/security';
const RECOVERY_CODE_COUNT = 10;

async function requestContext() {
  const h = await headers();
  return { ipHash: hashIp(clientIpFromHeaders(h)), userAgent: truncateUserAgent(h.get('user-agent')) };
}

export type TotpEnrollmentResult =
  | {
      ok: true;
      factorId: string;
      uri: string;
      secret: string;
      /** QR module matrix, rendered as SVG on the client (no HTML injection). */
      qr: { size: number; data: number[] } | null;
    }
  | { ok: false; error: string };

function qrMatrix(value: string): { size: number; data: number[] } | null {
  try {
    const qr = QRCode.create(value, { errorCorrectionLevel: 'M' });
    return { size: qr.modules.size, data: Array.from(qr.modules.data) };
  } catch (cause) {
    log.warn('security.2fa.qr failed', { message: cause instanceof Error ? cause.message : 'unknown' });
    return null;
  }
}

/** Begins TOTP enrollment and returns the QR material (shown once). */
export async function startTotpEnrollmentAction(): Promise<TotpEnrollmentResult> {
  const owner = await requireOwner(SECURITY_PATH);
  const supabase = await createUserClient();

  // Clear any abandoned, unverified TOTP factor so a restart is always possible.
  const { data: factors } = await supabase.auth.mfa.listFactors();
  for (const factor of factors?.all ?? []) {
    if (factor.factor_type === 'totp' && factor.status !== 'verified') {
      await supabase.auth.mfa.unenroll({ factorId: factor.id });
    }
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: 'Authenticator app',
  });
  if (error || !data) {
    log.warn('security.2fa.enroll failed', { code: error?.code });
    return { ok: false, error: 'Could not start two-factor setup. Try again.' };
  }

  const { ipHash, userAgent } = await requestContext();
  await writeAudit({ ownerId: owner.id, actor: 'owner', action: 'auth.2fa_enroll_started', ipHash, userAgent });
  return { ok: true, factorId: data.id, uri: data.totp.uri, secret: data.totp.secret, qr: qrMatrix(data.totp.uri) };
}

/** Confirms the 6-digit code and turns two-factor on. */
export async function verifyTotpAction(
  factorId: string,
  code: string,
): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const owner = await requireOwner(SECURITY_PATH);
  const parsedFactor = z.uuid().safeParse(factorId);
  const parsedCode = totpCodeSchema.safeParse(code);
  if (!parsedFactor.success || !parsedCode.success) {
    return { ok: false, error: 'Enter the 6-digit code from your authenticator app.' };
  }

  const supabase = await createUserClient();
  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
    factorId: parsedFactor.data,
  });
  if (challengeError || !challenge) {
    log.warn('security.2fa.challenge failed', { code: challengeError?.code });
    return { ok: false, error: 'Two-factor setup could not continue. Start again.' };
  }

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId: parsedFactor.data,
    challengeId: challenge.id,
    code: parsedCode.data,
  });
  if (verifyError) {
    const { ipHash, userAgent } = await requestContext();
    await writeAudit({ ownerId: owner.id, actor: 'owner', action: 'auth.2fa_verify_failed', ipHash, userAgent });
    return { ok: false, error: 'That code is not valid. Check your authenticator app and try again.' };
  }

  const { error: settingsError } = await supabase
    .from('owner_settings')
    .update({ totp_enabled: true })
    .eq('owner_id', owner.id);
  if (settingsError) log.warn('security.2fa.settings failed', { code: settingsError.code });

  const { ipHash, userAgent } = await requestContext();
  await writeAudit({ ownerId: owner.id, actor: 'owner', action: 'auth.2fa_enabled', ipHash, userAgent });
  revalidatePath(SECURITY_PATH);
  return { ok: true, message: 'Two-factor authentication is on. Save your recovery codes next.' };
}

/** Turns two-factor off, removes the factors, and clears the recovery codes. */
export async function disableTotpAction(): Promise<{ ok: true } | { ok: false; error: string }> {
  const owner = await requireOwner(SECURITY_PATH);
  if (!(await isReauthenticated(owner.id))) {
    return { ok: false, error: 'Confirm your password before turning off two-factor authentication.' };
  }

  const supabase = await createUserClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  for (const factor of factors?.all ?? []) {
    if (factor.factor_type === 'totp') {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
      if (error) log.warn('security.2fa.unenroll failed', { code: error.code });
    }
  }

  const { error: deleteError } = await supabase
    .from('backup_recovery_codes')
    .delete()
    .eq('owner_id', owner.id);
  if (deleteError) log.warn('security.2fa.codes_clear failed', { code: deleteError.code });

  const { error: settingsError } = await supabase
    .from('owner_settings')
    .update({ totp_enabled: false })
    .eq('owner_id', owner.id);
  if (settingsError) log.warn('security.2fa.settings failed', { code: settingsError.code });

  const { ipHash, userAgent } = await requestContext();
  await writeAudit({ ownerId: owner.id, actor: 'owner', action: 'auth.2fa_disabled', ipHash, userAgent });
  revalidatePath(SECURITY_PATH);
  return { ok: true };
}

/** Replaces the owner's recovery codes and returns the new set (shown once). */
export async function generateRecoveryCodesAction(): Promise<
  { ok: true; codes: string[] } | { ok: false; error: string }
> {
  const owner = await requireOwner(SECURITY_PATH);
  if (!(await isReauthenticated(owner.id))) {
    return { ok: false, error: 'Confirm your password before regenerating recovery codes.' };
  }

  const supabase = await createUserClient();
  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, () => generateRecoveryCode());
  const rows = await Promise.all(
    codes.map(async (code) => ({ owner_id: owner.id, code_hash: await hashPassword(code) })),
  );

  const { error: deleteError } = await supabase
    .from('backup_recovery_codes')
    .delete()
    .eq('owner_id', owner.id);
  if (deleteError) {
    log.warn('security.recovery_codes.clear failed', { code: deleteError.code });
    return { ok: false, error: 'Could not replace your recovery codes. Try again.' };
  }

  const { error: insertError } = await supabase.from('backup_recovery_codes').insert(rows);
  if (insertError) {
    log.warn('security.recovery_codes.insert failed', { code: insertError.code });
    return { ok: false, error: 'Could not save your recovery codes. Try again.' };
  }

  const { ipHash, userAgent } = await requestContext();
  await writeAudit({
    ownerId: owner.id,
    actor: 'owner',
    action: 'security.recovery_codes_regenerated',
    detail: { count: codes.length },
    ipHash,
    userAgent,
  });
  await alertRecoveryCodesRegenerated();
  revalidatePath(SECURITY_PATH);
  return { ok: true, codes };
}
