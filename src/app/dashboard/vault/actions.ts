'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireOwner } from '@/lib/auth/session';
import { createUserClient } from '@/lib/db/user';
import {
  isBlockedExtension,
  maxUploadBytes,
  pendingStoragePath,
  storagePathFor,
  validateUpload,
  type UploadRejection,
} from '@/lib/files/validate';
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

async function resolveCategory(ownerId: string, value: string | null): Promise<string | null> {
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

/** Creates an owner-scoped pending path so large file bytes bypass the app server. */
export async function prepareDocumentUploadAction(input: {
  name: string;
  size: number;
}): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const owner = await requireOwner('/dashboard/vault');
  const maxBytes = maxUploadBytes();
  const parsed = z.object({
    name: z.string().trim().min(1).max(300),
    size: z.number().int().positive(),
  }).safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: 'Choose a non-empty file to upload.' };
  }
  if (parsed.data.size > maxBytes) {
    return {
      ok: false,
      error: `This file is ${Math.ceil(parsed.data.size / (1024 * 1024))} MB. The current upload limit is ${Math.floor(maxBytes / (1024 * 1024))} MB.`,
    };
  }
  if (isBlockedExtension(parsed.data.name)) {
    return { ok: false, error: 'That file type is not allowed.' };
  }

  return { ok: true, path: pendingStoragePath(owner.id, parsed.data.name) };
}

/**
 * Validates the owner-uploaded pending object before moving it into the vault.
 * Storage RLS restricts the direct browser upload to the owner's folder; no
 * document becomes visible to the app until its bytes pass server validation.
 */
export async function finalizeDocumentUploadAction(input: {
  path: string;
  name: string;
  mime: string;
  size: number;
  categoryId: string | null;
}): Promise<VaultState> {
  const owner = await requireOwner('/dashboard/vault');
  const parsed = z.object({
    path: z.string().max(500),
    name: z.string().min(1).max(300),
    mime: z.string().max(255),
    size: z.number().int().positive().max(maxUploadBytes()),
    categoryId: z.string().max(100).nullable(),
  }).safeParse(input);
  if (!parsed.success) return { ok: false, error: 'The upload details are invalid. Choose the file again.' };

  const segments = parsed.data.path.split('/');
  if (
    segments.length !== 3
    || segments[0] !== owner.id
    || segments[1] !== 'pending'
    || !/^[A-Za-z0-9._-]{1,200}$/.test(segments[2])
    || segments[2].includes('..')
  ) {
    return { ok: false, error: 'The upload could not be verified. Choose the file again.' };
  }

  const supabase = await createUserClient();
  const storage = supabase.storage.from(DOCUMENTS_BUCKET);
  const { data: object, error: downloadError } = await storage.download(parsed.data.path);
  if (downloadError || !object) {
    log.warn('vault.upload pending read failed', { code: downloadError?.name });
    return { ok: false, error: 'The uploaded file could not be checked. Check your connection and try again.' };
  }

  const buffer = Buffer.from(await object.arrayBuffer());
  if (buffer.byteLength !== parsed.data.size) {
    await storage.remove([parsed.data.path]);
    return { ok: false, error: 'The uploaded file was incomplete. Please upload it again.' };
  }

  const validation = await validateUpload({
    buffer,
    declaredName: parsed.data.name,
    declaredMime: parsed.data.mime,
  });
  if (!validation.ok) {
    await storage.remove([parsed.data.path]);
    return { ok: false, error: REJECTION_MESSAGE[validation.reason] };
  }

  const categoryId = await resolveCategory(owner.id, parsed.data.categoryId);
  const storagePath = storagePathFor(owner.id, validation.data);
  const { error: moveError } = await storage.move(parsed.data.path, storagePath);
  if (moveError) {
    await storage.remove([parsed.data.path]);
    log.warn('vault.upload finalize move failed', { code: moveError.name });
    return { ok: false, error: 'The uploaded file could not be finalized. Please upload it again.' };
  }

  const { error: dbError } = await supabase.from('documents').insert({
    owner_id: owner.id,
    category_id: categoryId,
    name: validation.data.safeName,
    storage_path: storagePath,
    mime: validation.data.mime,
    size: validation.data.size,
    is_shared: false,
  });

  if (dbError) {
    await storage.remove([storagePath]);
    log.warn('vault.record failed', { code: dbError.code });
    return { ok: false, error: 'The document could not be saved. Try again.' };
  }

  revalidatePath('/dashboard/vault');
  revalidatePath('/dashboard/share');
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
  revalidatePath('/dashboard/access');
  revalidatePath('/dashboard/customize');
  revalidatePath('/dashboard/security');
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
  revalidatePath('/dashboard/share');
  revalidatePath('/dashboard/access');
  revalidatePath('/dashboard/customize');
  revalidatePath('/dashboard/security');
  return { ok: true, message: 'Document deleted.' };
}
