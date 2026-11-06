'use server';

import { z } from 'zod';
import { requireOwner } from '@/lib/auth/session';
import { createUserClient } from '@/lib/db/user';
import { revalidatePath } from 'next/cache';

import { encryptField, maskValue, fieldAad } from '@/lib/crypto/fields';
import { randomUUID } from 'node:crypto';

const fieldSchema = z.object({
  kind: z.enum([
    'email',
    'phone',
    'address',
    'family_contact',
    'emergency_contact',
    'important_date',
    'note',
    'account_record',
    'custom',
  ]),
  label: z.string().min(1).max(50),
  value: z.string().min(1).max(2000),
  is_public: z.boolean().default(false),
  is_sensitive: z.boolean().default(false),
});

export async function addFieldAction(formData: FormData) {
  const owner = await requireOwner();
  const supabase = await createUserClient();

  const data = fieldSchema.parse({
    kind: formData.get('kind'),
    label: formData.get('label'),
    value: formData.get('value'),
    is_public: formData.get('is_public') === 'true',
    is_sensitive: formData.get('is_sensitive') === 'true',
  });

  const fieldId = randomUUID();
  let value = data.value;
  let value_encrypted = null;

  if (data.is_sensitive) {
    const aad = fieldAad(owner.id, fieldId, 'value_encrypted');
    value_encrypted = encryptField(data.value, aad);
    value = maskValue(data.value);
  }

  // Get max sort
  const { data: maxSort } = await supabase
    .from('fields')
    .select('sort')
    .eq('owner_id', owner.id)
    .order('sort', { ascending: false })
    .limit(1)
    .single();

  const sort = (maxSort?.sort ?? -1) + 1;

  const { error } = await supabase.from('fields').insert({
    id: fieldId,
    owner_id: owner.id,
    kind: data.kind,
    label: data.label,
    value,
    value_encrypted,
    is_public: data.is_public,
    is_sensitive: data.is_sensitive,
    sort,
  });

  if (error) throw error;
  revalidatePath('/dashboard/info');
  return { ok: true };
}

export async function updateFieldAction(id: string, formData: FormData) {
  const owner = await requireOwner();
  const supabase = await createUserClient();

  const updates: Partial<{
    label: string;
    value: string;
    value_encrypted: string | null;
    is_public: boolean;
    is_sensitive: boolean;
  }> = {};
  if (formData.has('label')) updates.label = formData.get('label') as string;
  
  if (formData.has('value')) {
    const newValue = formData.get('value') as string;
    const isSensitive = formData.get('is_sensitive') === 'true' || (await supabase.from('fields').select('is_sensitive').eq('id', id).single()).data?.is_sensitive;
    
    if (isSensitive) {
      const aad = fieldAad(owner.id, id, 'value_encrypted');
      updates.value_encrypted = encryptField(newValue, aad);
      updates.value = maskValue(newValue);
    } else {
      updates.value = newValue;
      updates.value_encrypted = null;
    }
  }

  if (formData.has('is_public')) updates.is_public = formData.get('is_public') === 'true';
  if (formData.has('is_sensitive')) updates.is_sensitive = formData.get('is_sensitive') === 'true';

  const { error } = await supabase
    .from('fields')
    .update(updates)
    .eq('id', id)
    .eq('owner_id', owner.id);

  if (error) throw error;
  revalidatePath('/dashboard/info');
  return { ok: true };
}

export async function deleteFieldAction(id: string) {
  const owner = await requireOwner();
  const supabase = await createUserClient();

  const { error } = await supabase
    .from('fields')
    .delete()
    .eq('id', id)
    .eq('owner_id', owner.id);

  if (error) throw error;
  revalidatePath('/dashboard/info');
  return { ok: true };
}

export async function reorderFieldsAction(ids: string[]) {
  const owner = await requireOwner();
  const supabase = await createUserClient();

  const updates = ids.map((id, index) => ({
    id,
    owner_id: owner.id,
    sort: index,
  }));

  const { error } = await supabase.from('fields').upsert(updates);

  if (error) throw error;
  revalidatePath('/dashboard/info');
  return { ok: true };
}
