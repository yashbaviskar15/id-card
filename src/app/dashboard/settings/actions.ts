'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { z } from 'zod';
import { requireOwner } from '@/lib/auth/session';
import { isReauthenticated } from '@/lib/auth/reauth';
import { createUserClient } from '@/lib/db/user';
import { clientIpFromHeaders, hashIp, truncateUserAgent } from '@/lib/crypto/ip';
import { writeAudit } from '@/lib/audit';
import {
  emailSchema,
  scopeSchema,
  validityMinutesSchema,
  visitorSessionMinutesSchema,
} from '@/lib/validation';
import { log } from '@/lib/log';
import type { FormState } from '@/app/(auth)/form-state';

const SETTINGS_PATH = '/dashboard/settings';

async function requestContext() {
  const h = await headers();
  return { ipHash: hashIp(clientIpFromHeaders(h)), userAgent: truncateUserAgent(h.get('user-agent')) };
}

export async function updateSettingsAction(updates: {
  alert_on_new_device?: boolean;
  alert_on_lockout?: boolean;
}) {
  const keys = Object.keys(updates);
  if (
    keys.length === 0
    || keys.some((key) => !['alert_on_new_device', 'alert_on_lockout'].includes(key))
    || Object.values(updates).some((value) => typeof value !== 'boolean')
  ) {
    return { ok: false, error: 'Choose a valid setting to update.' };
  }

  const owner = await requireOwner(SETTINGS_PATH);
  const supabase = await createUserClient();

  const { data, error } = await supabase
    .from('owner_settings')
    .update(updates)
    .eq('owner_id', owner.id)
    .select('owner_id')
    .maybeSingle();

  if (error) {
    log.warn('settings.update failed', { code: error.code, message: error.message });
    return { ok: false, error: 'Could not save this setting. Try again.' };
  }
  if (!data) return { ok: false, error: 'Your settings row is missing. Refresh and try again.' };

  revalidatePath(SETTINGS_PATH);
  return { ok: true };
}

const privacyDefaultsSchema = z.object({
  default_scope: scopeSchema,
  default_validity_minutes: validityMinutesSchema,
  visitor_session_minutes: visitorSessionMinutesSchema,
});

/** Owner-scoped update of the access defaults a new code starts from. */
export async function updatePrivacyDefaultsAction(input: {
  default_scope: string;
  default_validity_minutes: number;
  visitor_session_minutes: number;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = privacyDefaultsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Choose valid defaults.' };
  }

  const owner = await requireOwner(SETTINGS_PATH);
  const supabase = await createUserClient();

  const { data, error } = await supabase
    .from('owner_settings')
    .update(parsed.data)
    .eq('owner_id', owner.id)
    .select('owner_id')
    .maybeSingle();

  if (error) {
    log.warn('settings.privacy.update failed', { code: error.code, message: error.message });
    return { ok: false, error: 'Could not save your privacy defaults. Try again.' };
  }
  if (!data) return { ok: false, error: 'Your settings row is missing. Refresh and try again.' };

  revalidatePath(SETTINGS_PATH);
  return { ok: true };
}

/**
 * Starts an email change. Supabase sends a confirmation to the current address
 * and the new one; the address only changes after both are confirmed.
 */
export async function changeEmailAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const owner = await requireOwner(SETTINGS_PATH);
  if (!(await isReauthenticated(owner.id))) {
    return { ok: false, error: 'Confirm your password before changing your email address.' };
  }

  const parsed = emailSchema.safeParse(formData.get('email'));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Enter a valid email address.' };
  }
  if (owner.email && parsed.data === owner.email.toLowerCase()) {
    return { ok: false, error: 'That is already your email address.' };
  }

  const supabase = await createUserClient();
  const { error } = await supabase.auth.updateUser({ email: parsed.data });
  if (error) {
    log.warn('settings.email.change failed', { code: error.code, message: error.message });
    return { ok: false, error: 'Could not start the email change. Try again.' };
  }

  const { ipHash, userAgent } = await requestContext();
  await writeAudit({ ownerId: owner.id, actor: 'owner', action: 'auth.email_change_requested', ipHash, userAgent });
  return {
    ok: true,
    message: `Confirmation links were sent. Your address changes to ${parsed.data} after you confirm from both inboxes.`,
  };
}

export async function signOutOtherSessionsAction() {
  await requireOwner(SETTINGS_PATH);
  const supabase = await createUserClient();
  const { error } = await supabase.auth.signOut({ scope: 'others' });
  if (error) {
    log.warn('settings.sessions.signout failed', { message: error.message });
    return { ok: false, error: 'Could not sign out other devices. Try again.' };
  }
  return { ok: true };
}
