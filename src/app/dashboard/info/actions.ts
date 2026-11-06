'use server';

import { z } from 'zod';
import { requireOwner } from '@/lib/auth/session';
import { createUserClient } from '@/lib/db/user';
import { revalidatePath } from 'next/cache';
import {
  decryptField,
  encryptField,
  fieldAad,
  isEncryptedEnvelope,
  maskValue,
} from '@/lib/crypto/fields';
import { randomUUID } from 'node:crypto';
import type { FieldKind } from '@/lib/types';

const fieldSchema = z.object({
  kind: z.enum(['email', 'phone', 'address', 'family_contact', 'emergency_contact', 'important_date', 'note', 'account_record', 'custom']),
  label: z.string().min(1).max(80),
  value: z.string().min(1).max(2000),
  is_public: z.boolean().default(false),
  is_sensitive: z.boolean().default(false),
});

const fieldIdSchema = z.uuid();

export type InfoActionResult = { ok: boolean; error?: string };

function publicAllowed(kind: FieldKind): boolean {
  return kind === 'email' || kind === 'phone';
}

export async function addFieldAction(formData: FormData): Promise<InfoActionResult> {
  const parsed = fieldSchema.safeParse({
    kind: formData.get('kind'),
    label: formData.get('label'),
    value: formData.get('value'),
    is_public: formData.get('is_public') === 'true',
    is_sensitive: formData.get('is_sensitive') === 'true',
  });
  if (!parsed.success) return { ok: false, error: 'Enter a valid label and value.' };

  const owner = await requireOwner('/dashboard/info');
  const supabase = await createUserClient();
  const data = parsed.data;

  const fieldId = randomUUID();
  let value = data.value;
  let value_encrypted = null;

  if (data.is_sensitive) {
    const aad = fieldAad(owner.id, fieldId, 'value_encrypted');
    value_encrypted = encryptField(data.value, aad);
    value = maskValue(data.value);
  }

  const { data: maxSort, error: sortError } = await supabase
    .from('fields')
    .select('sort')
    .eq('owner_id', owner.id)
    .order('sort', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (sortError) return { ok: false, error: 'Could not load your information. Try again.' };

  const sort = (maxSort?.sort ?? -1) + 1;

  const { error } = await supabase.from('fields').insert({
    id: fieldId,
    owner_id: owner.id,
    kind: data.kind,
    label: data.label,
    value,
    value_encrypted,
    is_public: publicAllowed(data.kind) && data.is_public && !data.is_sensitive,
    is_sensitive: data.is_sensitive,
    sort,
  });

  if (error) return { ok: false, error: 'Could not save this information. Try again.' };
  revalidatePath('/dashboard/info');
  return { ok: true };
}

export async function updateFieldAction(id: string, formData: FormData): Promise<InfoActionResult> {
  const parsedId = fieldIdSchema.safeParse(id);
  if (!parsedId.success) return { ok: false, error: 'This information could not be found.' };

  const owner = await requireOwner('/dashboard/info');
  const supabase = await createUserClient();
  const { data: current, error: loadError } = await supabase
    .from('fields')
    .select('id, kind, label, value, value_encrypted, is_sensitive, is_public')
    .eq('id', parsedId.data)
    .eq('owner_id', owner.id)
    .maybeSingle();
  if (loadError || !current) return { ok: false, error: 'This information could not be found.' };

  const updates: Record<string, string | boolean | null> = {};
  const labelEntry = formData.get('label');
  if (labelEntry !== null) {
    const label = z.string().trim().min(1).max(80).safeParse(labelEntry);
    if (!label.success) return { ok: false, error: 'Labels must be between 1 and 80 characters.' };
    updates.label = label.data;
  }

  const valueEntry = formData.get('value');
  let plainValue: string | null = null;
  if (current.is_sensitive) {
    const encrypted = typeof current.value_encrypted === 'string' ? current.value_encrypted : null;
    plainValue = encrypted && isEncryptedEnvelope(encrypted)
      ? decryptField(encrypted, fieldAad(owner.id, current.id, 'value_encrypted'))
      : current.value;
  } else {
    plainValue = current.value;
  }
  if (valueEntry !== null) {
    const value = z.string().trim().min(1).max(2000).safeParse(valueEntry);
    if (!value.success) return { ok: false, error: 'Values must be between 1 and 2000 characters.' };
    plainValue = value.data;
  }

  const sensitiveEntry = formData.get('is_sensitive');
  const nextSensitive = sensitiveEntry === null ? current.is_sensitive : sensitiveEntry === 'true';
  if (sensitiveEntry !== null) updates.is_sensitive = nextSensitive;
  if (nextSensitive && current.is_public) updates.is_public = false;
  if (valueEntry !== null || sensitiveEntry !== null) {
    if (nextSensitive && plainValue !== null) {
      updates.value = maskValue(plainValue);
      updates.value_encrypted = encryptField(
        plainValue,
        fieldAad(owner.id, current.id, 'value_encrypted'),
      );
    } else {
      updates.value = plainValue;
      updates.value_encrypted = null;
    }
  }

  const publicEntry = formData.get('is_public');
  if (publicEntry !== null) {
    const nextPublic = publicEntry === 'true';
    updates.is_public = publicAllowed(current.kind as FieldKind) && nextPublic && !nextSensitive;
  }

  const { error } = await supabase
    .from('fields')
    .update(updates)
    .eq('id', parsedId.data)
    .eq('owner_id', owner.id);

  if (error) return { ok: false, error: 'Could not update this information. Try again.' };
  revalidatePath('/dashboard/info');
  return { ok: true };
}

export async function deleteFieldAction(id: string): Promise<InfoActionResult> {
  const parsedId = fieldIdSchema.safeParse(id);
  if (!parsedId.success) return { ok: false, error: 'This information could not be found.' };
  const owner = await requireOwner('/dashboard/info');
  const supabase = await createUserClient();

  const { error } = await supabase
    .from('fields')
    .delete()
    .eq('id', parsedId.data)
    .eq('owner_id', owner.id);

  if (error) return { ok: false, error: 'Could not delete this information. Try again.' };
  revalidatePath('/dashboard/info');
  return { ok: true };
}

export async function reorderFieldsAction(ids: string[]): Promise<InfoActionResult> {
  const parsedIds = z.array(z.uuid()).max(500).safeParse(ids);
  if (!parsedIds.success) return { ok: false, error: 'The information order is invalid.' };
  const owner = await requireOwner('/dashboard/info');
  const supabase = await createUserClient();

  for (const [sort, id] of parsedIds.data.entries()) {
    const { error } = await supabase
      .from('fields')
      .update({ sort })
      .eq('id', id)
      .eq('owner_id', owner.id);
    if (error) return { ok: false, error: 'Could not reorder your information. Try again.' };
  }
  revalidatePath('/dashboard/info');
  return { ok: true };
}
