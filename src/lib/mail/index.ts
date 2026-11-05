import 'server-only';
import { Resend } from 'resend';
import { serverEnv } from '@/lib/env.server';
import { log } from '@/lib/log';

/**
 * Provider-agnostic owner alerting. With RESEND_API_KEY set the message is sent
 * via Resend; otherwise it is written to the server log only (dev fallback).
 * Failures never block the calling request.
 */
async function deliver(subject: string, text: string): Promise<void> {
  const env = serverEnv();
  if (!env.RESEND_API_KEY || !env.ALERT_FROM_EMAIL || !env.ALERT_TO_EMAIL) {
    log.warn('alert (no email provider configured)', { subject });
    return;
  }
  try {
    const resend = new Resend(env.RESEND_API_KEY);
    await resend.emails.send({
      from: env.ALERT_FROM_EMAIL,
      to: env.ALERT_TO_EMAIL,
      subject,
      text,
    });
  } catch {
    log.warn('alert send failed', { subject });
  }
}

const footer = '\n\n— Private Identity Vault security alert. If this was not you, sign out of all devices and change your password immediately.';

export async function alertOwnerLockout(context: { attempts: number; windowMinutes: number }): Promise<void> {
  await deliver(
    'Security alert: sign-in locked',
    `${context.attempts} failed sign-in attempts within ${context.windowMinutes} minutes triggered a lockout on your account.${footer}`,
  );
}

export async function alertAccessGateLockout(context: { slugSuffix: string; attempts: number }): Promise<void> {
  await deliver(
    'Security alert: access gate locked',
    `${context.attempts} wrong access codes on profile ...${context.slugSuffix} triggered a lockout. All outstanding codes were revoked.${footer}`,
  );
}

export async function alertNewDeviceLogin(context: { userAgent: string }): Promise<void> {
  await deliver(
    'Security alert: new device signed in',
    `A successful sign-in from a new device or browser was detected.\n\nDevice: ${context.userAgent}${footer}`,
  );
}

export async function alertPasswordChanged(): Promise<void> {
  await deliver('Security alert: password changed', `Your password was changed and all other sessions were signed out.${footer}`);
}

export async function alertRecoveryCodesRegenerated(): Promise<void> {
  await deliver(
    'Security alert: two-factor recovery codes regenerated',
    `Your two-factor recovery codes were regenerated. The previous codes no longer work.${footer}`,
  );
}

export async function alertSensitiveReveal(context: { field: string }): Promise<void> {
  await deliver('Security alert: sensitive value revealed', `A sensitive value (${context.field}) was revealed in your dashboard.${footer}`);
}

export async function alertBackupExported(): Promise<void> {
  await deliver('Security alert: backup exported', `An encrypted backup bundle was created and downloaded.${footer}`);
}
