'use server';

import { revalidatePath } from 'next/cache';
import { requireOwner } from '@/lib/auth/session';
import { createUserClient } from '@/lib/db/user';
import { log } from '@/lib/log';

export async function updateSettingsAction(updates: {
  alert_on_new_device?: boolean;
  alert_on_lockout?: boolean;
}) {
  const owner = await requireOwner('/dashboard/settings');
  const supabase = await createUserClient();

  const { error } = await supabase
    .from('owner_settings')
    .update(updates)
    .eq('owner_id', owner.id);

  if (error) {
    log.warn('settings.update failed', { code: error.code, message: error.message });
    return { ok: false };
  }

  revalidatePath('/dashboard/settings');
  return { ok: true };
}
