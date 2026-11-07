'use server';

import { revalidatePath } from 'next/cache';
import { requireOwner } from '@/lib/auth/session';
import { createUserClient } from '@/lib/db/user';
import { log } from '@/lib/log';

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

  const owner = await requireOwner('/dashboard/settings');
  const supabase = await createUserClient();

  const { error } = await supabase
    .from('owner_settings')
    .update(updates)
    .eq('owner_id', owner.id);

  if (error) {
    log.warn('settings.update failed', { code: error.code, message: error.message });
    return { ok: false, error: 'Could not save this setting. Try again.' };
  }

  revalidatePath('/dashboard/settings');
  return { ok: true };
}

export async function signOutOtherSessionsAction() {
  await requireOwner('/dashboard/settings');
  const supabase = await createUserClient();
  const { error } = await supabase.auth.signOut({ scope: 'others' });
  if (error) {
    log.warn('settings.sessions.signout failed', { message: error.message });
    return { ok: false, error: 'Could not sign out other devices. Try again.' };
  }
  return { ok: true };
}
