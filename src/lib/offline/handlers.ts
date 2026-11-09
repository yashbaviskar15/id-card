'use client';

import { registerHandler } from './outbox';
import {
  addFieldAction,
  deleteFieldAction,
  reorderFieldsAction,
  updateFieldAction,
} from '@/app/dashboard/info/actions';
import { saveProfileAction } from '@/app/dashboard/card/actions';
import { initialFormState } from '@/app/(auth)/form-state';

/**
 * Binds each queued `kind` to the exact server action used online. Registered
 * once, lazily, from the offline provider so the client bundle only carries it
 * when the dashboard is actually used.
 */

function toFormData(payload: Record<string, unknown>): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined || value === null) continue;
    form.set(key, typeof value === 'boolean' ? String(value) : String(value));
  }
  return form;
}

let registered = false;

export function registerOfflineHandlers(): void {
  if (registered) return;
  registered = true;

  registerHandler('field.add', (payload) => addFieldAction(toFormData(payload as Record<string, unknown>)));
  registerHandler('field.update', (payload) => {
    const { id, ...rest } = payload as { id: string } & Record<string, unknown>;
    return updateFieldAction(id, toFormData(rest));
  });
  registerHandler('field.delete', (payload) => deleteFieldAction((payload as { id: string }).id));
  registerHandler('field.reorder', (payload) =>
    reorderFieldsAction((payload as { ids: string[] }).ids),
  );
  registerHandler('profile.save', (payload) =>
    saveProfileAction(initialFormState, toFormData(payload as Record<string, unknown>)),
  );
}
