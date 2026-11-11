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
  try {
    const env = serverEnv();
    if (!env.RESEND_API_KEY || !env.ALERT_FROM_EMAIL || !env.ALERT_TO_EMAIL) {
      log.warn('alert (no email provider configured)', { subject });
      return;
    }
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

export async function alertGrantUsed(context: { slugSuffix: string; scope: 'contact' | 'full' }): Promise<void> {
  await deliver(
    'Access alert: your code was used',
    `Someone just entered an access code on profile ...${context.slugSuffix} (${context.scope} scope).\n\nIf you did not hand out a code, revoke outstanding codes from the Access dashboard.${footer}`,
  );
}

export async function alertScheduledBackup(context: {
  ok: boolean;
  documentCount: number;
  sizeBytes: number;
  storedPath?: string;
  error?: string;
}): Promise<void> {
  if (context.ok) {
    const megabytes = (context.sizeBytes / (1024 * 1024)).toFixed(2);
    await deliver(
      'Scheduled backup completed',
      `Your encrypted backup finished. ${context.documentCount} document${context.documentCount === 1 ? '' : 's'} · ${megabytes} MB.\n\nStored at: ${context.storedPath ?? 'n/a'}\n\nRestore needs the BACKUP_PASSPHRASE you configured.${footer}`,
    );
  } else {
    await deliver(
      'Scheduled backup failed',
      `Your scheduled backup did not complete: ${context.error ?? 'unknown error'}.\n\nCheck the deployment logs and the BACKUP_PASSPHRASE setting.${footer}`,
    );
  }
}

export interface AccessDigest {
  windowHours: number;
  total: number;
  granted: number;
  denied: number;
  used: number;
  uniqueVisitors: number;
  topOutcome?: { outcome: string; count: number };
}

export async function sendAccessDigest(context: AccessDigest): Promise<void> {
  const lines = [
    `Access summary for the last ${context.windowHours} hours.`,
    '',
    `Total checks: ${context.total}`,
    `Codes accepted: ${context.used}`,
    `Successful sessions: ${context.granted}`,
    `Refused attempts: ${context.denied}`,
    `Distinct visitors (by IP): ${context.uniqueVisitors}`,
  ];
  if (context.topOutcome) {
    lines.push(`Most common outcome: ${context.topOutcome.outcome} (${context.topOutcome.count})`);
  }
  lines.push('', 'Open the Access dashboard for the full history.', footer);
  await deliver(`Access digest: ${context.used} code${context.used === 1 ? '' : 's'} used in ${context.windowHours}h`, lines.join('\n'));
}

