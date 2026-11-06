'use server';

import { requireOwner } from '@/lib/auth/session';
import { createUserClient } from '@/lib/db/user';
import { revalidatePath } from 'next/cache';
import { validateUpload, storagePathFor } from '@/lib/files/validate';
import { DOCUMENTS_BUCKET } from '@/lib/storage';
import { generateShareToken } from '@/lib/crypto/random';
import { hmacHex } from '@/lib/crypto/random';
import { serverEnv } from '@/lib/env.server';
import { clientEnv } from '@/lib/env';

export async function uploadDocumentAction(formData: FormData) {
  const owner = await requireOwner();
  const file = formData.get('file') as File;
  if (!file) throw new Error('No file provided');

  const buffer = Buffer.from(await file.arrayBuffer());
  const validation = await validateUpload({
    buffer,
    declaredName: file.name,
    declaredMime: file.type,
  });

  if (!validation.ok) {
    return { ok: false, error: `Upload failed: ${validation.reason}` };
  }

  const storagePath = storagePathFor(owner.id, validation.data);
  const supabase = await createUserClient();

  const { error: uploadError } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .upload(storagePath, buffer, {
      contentType: validation.data.mime,
      upsert: false,
    });

  if (uploadError) throw uploadError;

  const { error: dbError } = await supabase.from('documents').insert({
    owner_id: owner.id,
    category_id: formData.get('category_id') as string || null,
    name: validation.data.safeName,
    storage_path: storagePath,
    mime: validation.data.mime,
    size: validation.data.size,
  });

  if (dbError) {
    // Cleanup storage on DB failure
    await supabase.storage.from(DOCUMENTS_BUCKET).remove([storagePath]);
    throw dbError;
  }

  revalidatePath('/dashboard/vault');
  return { ok: true };
}

export async function deleteDocumentAction(id: string) {
  const owner = await requireOwner();
  const supabase = await createUserClient();

  const { data: doc, error: fetchError } = await supabase
    .from('documents')
    .select('storage_path')
    .eq('id', id)
    .eq('owner_id', owner.id)
    .single();

  if (fetchError || !doc) throw new Error('Document not found');

  const { error: storageError } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .remove([doc.storage_path]);

  if (storageError) throw storageError;

  const { error: dbError } = await supabase
    .from('documents')
    .delete()
    .eq('id', id)
    .eq('owner_id', owner.id);

  if (dbError) throw dbError;

  revalidatePath('/dashboard/vault');
  return { ok: true };
}

export async function createShareLinkAction(documentId: string, formData: FormData) {
  await requireOwner();
  const supabase = await createUserClient();

  const ttlMinutes = parseInt(formData.get('ttl') as string) || 60;
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();
  
  const token = generateShareToken();
  const tokenHash = hmacHex(serverEnv().ACCESS_CODE_SECRET, token);

  const { error } = await supabase.from('share_links').insert({
    document_id: documentId,
    token_hash: tokenHash,
    expires_at: expiresAt,
    max_downloads: parseInt(formData.get('max_downloads') as string) || null,
  });

  if (error) throw error;

  return { ok: true, token, url: `${clientEnv.NEXT_PUBLIC_SITE_URL}/s/${token}` };
}
