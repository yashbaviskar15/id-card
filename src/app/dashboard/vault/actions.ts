'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireOwner } from '@/lib/auth/session';
import { createUserClient } from '@/lib/db/user';
import { validateUpload, storagePathFor, type UploadRejection } from '@/lib/files/validate';
import { DOCUMENTS_BUCKET } from '@/lib/storage';
import { log } from '@/lib/log';
import type { VaultState } from './form-state';

const REJECTION_MESSAGE: Record<UploadRejection, string> = {
  too_large: 'That file is larger than the upload limit.',
  empty: 'The file is empty.',
  blocked_extension: 'That file type is not allowed.',
  type_not_allowed: 'That file type is not allowed.',
  type_mismatch: 'The file does not match its name or type.',
  content_mismatch: 'The file content does not match its extension.',
};

async function resolveCategory(ownerId: string, value: FormDataEntryValue | null): Promise<string | null> {
  const parsed = z.uuid().safeParse(value);
  if (!parsed.success) return null;
  const supabase = await createUserClient();
  const { data } = await supabase
    .from('categories')
    .select('id')
    .eq('id', parsed.data)
    .eq('owner_id', ownerId)
    .maybeSingle<{ id: string }>();
  return data?.id ?? null;
}

/**
 * Uploads one file into the private bucket and records it in the vault.
 *
 * The browser's declared name and type are treated as hostile: the real type is
 * sniffed from the bytes server side, anything that is not on the allow-list is
 * refused, and the object is removed again if the metadata row cannot be
 * written.
 */
export async function uploadDocumentAction(_prev: VaultState, formData: FormData): Promise<VaultState> {
  const owner = await requireOwner('/dashboard/vault');

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'Choose a file to upload.' };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const validation = await validateUpload({
    buffer,
    declaredName: file.name,
    declaredMime: file.type,
  });

  if (!validation.ok) {
    return { ok: false, error: REJECTION_MESSAGE[validation.reason] };
  }

  const categoryId = await resolveCategory(owner.id, formData.get('category_id'));
  const storagePath = storagePathFor(owner.id, validation.data);
  const supabase = await createUserClient();

  const { error: uploadError } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .upload(storagePath, buffer, { contentType: validation.data.mime, upsert: false });

  if (uploadError) {
    log.warn('vault.upload failed', { code: uploadError.name });
    return { ok: false, error: 'The upload did not complete. Try again.' };
  }

  const { error: dbError } = await supabase.from('documents').insert({
    owner_id: owner.id,
    category_id: categoryId,
    name: validation.data.safeName,
    storage_path: storagePath,
    mime: validation.data.mime,
    size: validation.data.size,
    is_shared: true, // Default to shared so they are visible to visitors by default
  });

  if (dbError) {
    // Never leave an orphan object behind when the metadata row is refused.
    await supabase.storage.from(DOCUMENTS_BUCKET).remove([storagePath]);
    log.warn('vault.record failed', { code: dbError.code });
    return { ok: false, error: 'The document could not be saved. Try again.' };
  }

  revalidatePath('/dashboard/vault');
  return { ok: true, message: `${validation.data.safeName} uploaded.` };
}

/**
 * Marks one document as shareable (or not). Only documents the owner opts in
 * here can ever appear on a visitor's screen.
 */
export async function setDocumentSharedAction(documentId: string, shared: boolean): Promise<VaultState> {
  const owner = await requireOwner('/dashboard/vault');
  const parsed = z.uuid().safeParse(documentId);
  if (!parsed.success) return { ok: false, error: 'That document no longer exists.' };

  const supabase = await createUserClient();
  const { error } = await supabase
    .from('documents')
    .update({ is_shared: shared })
    .eq('id', parsed.data)
    .eq('owner_id', owner.id);

  if (error) {
    log.warn('vault.share failed', { code: error.code });
    return { ok: false, error: 'Could not change sharing for that document.' };
  }

  revalidatePath('/dashboard/vault');
  return { ok: true };
}

/** Deletes a document: the stored object first, then its metadata row. */
export async function deleteDocumentAction(documentId: string): Promise<VaultState> {
  const owner = await requireOwner('/dashboard/vault');
  const parsed = z.uuid().safeParse(documentId);
  if (!parsed.success) return { ok: false, error: 'That document no longer exists.' };

  const supabase = await createUserClient();
  const { data: doc } = await supabase
    .from('documents')
    .select('storage_path')
    .eq('id', parsed.data)
    .eq('owner_id', owner.id)
    .maybeSingle<{ storage_path: string }>();

  if (!doc) return { ok: false, error: 'That document no longer exists.' };

  const { error: storageError } = await supabase.storage.from(DOCUMENTS_BUCKET).remove([doc.storage_path]);
  if (storageError) {
    log.warn('vault.delete storage failed', { code: storageError.name });
    return { ok: false, error: 'The stored file could not be removed. Try again.' };
  }

  const { error: dbError } = await supabase
    .from('documents')
    .delete()
    .eq('id', parsed.data)
    .eq('owner_id', owner.id);

  if (dbError) {
    log.warn('vault.delete failed', { code: dbError.code });
    return { ok: false, error: 'The document could not be deleted. Try again.' };
  }

  revalidatePath('/dashboard/vault');
  return { ok: true, message: 'Document deleted.' };
}
