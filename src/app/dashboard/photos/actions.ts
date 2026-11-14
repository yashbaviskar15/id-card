'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireOwner } from '@/lib/auth/session';
import { guardOwnerAction } from '@/lib/rate-limit';
import { createUserClient } from '@/lib/db/user';
import { createServiceClient } from '@/lib/db/service';
import type { SupabaseClient } from '@supabase/supabase-js';
import { hashPassword } from '@/lib/crypto/password';
import { encryptPhotoBytes, photoAad } from '@/lib/crypto/photos';
import { generateStorageId } from '@/lib/crypto/random';
import {
  isBlockedExtension,
  maxUploadBytes,
  pendingStoragePath,
  validateUpload,
  type UploadRejection,
} from '@/lib/files/validate';
import { passwordSchema } from '@/lib/validation';
import { DOCUMENTS_BUCKET } from '@/lib/storage';
import { log } from '@/lib/log';
import type { PhotosState } from './form-state';

const REJECTION_MESSAGE: Record<UploadRejection, string> = {
  too_large: 'That photo is larger than the upload limit.',
  empty: 'The photo is empty.',
  blocked_extension: 'That file type is not allowed.',
  type_not_allowed: 'Only image files can be added to the album.',
  type_mismatch: 'The file does not match its name or type.',
  content_mismatch: 'The file content does not match its extension.',
};

const PENDING_SEGMENT = /^[A-Za-z0-9._-]{1,200}$/;

/** The owner-encrypted object path; never derived from the visitor-facing name. */
function photoStoragePath(ownerId: string): string {
  return `${ownerId}/private/${generateStorageId()}.enc`;
}

/**
 * Creates an owner-scoped pending path so the (potentially large) original
 * photo bypasses the app server body limit. Nothing is encrypted or recorded
 * until `finalizePrivatePhotoUploadAction` has pulled the object back, sniffed
 * it and agreed it is a genuine image.
 */
export async function preparePrivatePhotoUploadAction(input: {
  name: string;
  size: number;
}): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const owner = await requireOwner('/dashboard/photos');
  const maxBytes = maxUploadBytes();
  const parsed = z
    .object({ name: z.string().trim().min(1).max(300), size: z.number().int().positive() })
    .safeParse(input);

  if (!parsed.success) return { ok: false, error: 'Choose a non-empty photo to upload.' };
  if (parsed.data.size > maxBytes) {
    return {
      ok: false,
      error: `This photo is ${Math.ceil(parsed.data.size / (1024 * 1024))} MB. The current upload limit is ${Math.floor(maxBytes / (1024 * 1024))} MB.`,
    };
  }
  if (isBlockedExtension(parsed.data.name)) return { ok: false, error: 'That file type is not allowed.' };

  return { ok: true, path: pendingStoragePath(owner.id, parsed.data.name) };
}

/**
 * Validates the pending upload, then encrypts the bytes (AES-256-GCM) before
 * they are moved into the album and their metadata is recorded. The plaintext
 * pending object is removed in every branch, so only ciphertext ever persists.
 */
export async function finalizePrivatePhotoUploadAction(input: {
  path: string;
  name: string;
  mime: string;
  size: number;
}): Promise<PhotosState> {
  const owner = await requireOwner('/dashboard/photos');

  const throttle = await guardOwnerAction(owner.id, 'photos.upload');
  if (!throttle.allowed) {
    return {
      ok: false,
      error: `You have uploaded many photos just now. Try again in ${throttle.retryAfterMinutes} minutes.`,
    };
  }

  const parsed = z
    .object({
      path: z.string().max(500),
      name: z.string().min(1).max(300),
      mime: z.string().max(255),
      size: z.number().int().positive().max(maxUploadBytes()),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: 'The upload details are invalid. Choose the photo again.' };

  const segments = parsed.data.path.split('/');
  if (
    segments.length !== 3 ||
    segments[0] !== owner.id ||
    segments[1] !== 'pending' ||
    !PENDING_SEGMENT.test(segments[2]) ||
    segments[2].includes('..')
  ) {
    return { ok: false, error: 'The upload could not be verified. Choose the photo again.' };
  }

  let storage: ReturnType<SupabaseClient['storage']['from']> | null = null;
  try {
    const supabase = await createUserClient();
    storage = supabase.storage.from(DOCUMENTS_BUCKET);
    const { data: object, error: downloadError } = await storage.download(parsed.data.path);
    if (downloadError || !object) {
      log.warn('photos.upload pending read failed', { code: downloadError?.name });
      return { ok: false, error: 'The uploaded photo could not be checked. Check your connection and try again.' };
    }

    const buffer = Buffer.from(await object.arrayBuffer());
    if (buffer.byteLength !== parsed.data.size) {
      await storage.remove([parsed.data.path]);
      return { ok: false, error: 'The upload was incomplete. Please upload the photo again.' };
    }

    const validation = await validateUpload({
      buffer,
      declaredName: parsed.data.name,
      declaredMime: parsed.data.mime,
      imagesOnly: true,
    });
    if (!validation.ok) {
      await storage.remove([parsed.data.path]);
      return { ok: false, error: REJECTION_MESSAGE[validation.reason] };
    }

    const photoId = randomUUID();
    const encrypted = encryptPhotoBytes(validation.data.buffer, photoAad(owner.id, photoId));
    const storagePath = photoStoragePath(owner.id);

    const { error: uploadError } = await storage.upload(storagePath, encrypted, {
      contentType: 'application/octet-stream',
      upsert: false,
    });
    if (uploadError) {
      await storage.remove([parsed.data.path]);
      log.warn('photos.upload encrypt store failed', { code: uploadError.name });
      return { ok: false, error: 'The photo could not be stored securely. Please try again.' };
    }

    const { error: dbError } = await supabase.from('private_photos').insert({
      id: photoId,
      owner_id: owner.id,
      name: validation.data.safeName,
      storage_path: storagePath,
      mime: validation.data.mime,
      size: validation.data.size,
    });

    // The plaintext staging object is no longer needed either way.
    await storage.remove([parsed.data.path]);

    if (dbError) {
      await storage.remove([storagePath]);
      log.warn('photos.record failed', { code: dbError.code });
      return { ok: false, error: 'The photo could not be saved. Try again.' };
    }

    revalidatePath('/dashboard/photos');
    return { ok: true, message: `${validation.data.safeName} added to your private album.` };
  } catch (cause) {
    // Encryption (keyring) and any other unexpected failure surface as a clean
    // error instead of bubbling up as a generic "interrupted" message.
    const message = cause instanceof Error ? cause.message : 'unknown';
    log.warn('photos.upload finalize threw', { message });
    // Best-effort cleanup of the plaintext staging object.
    if (storage) {
      try {
        await storage.remove([parsed.data.path]);
      } catch {
        // A retry uses a new random path; a failed cleanup cannot expose the file.
      }
    }
    return {
      ok: false,
      error: `The photo could not be encrypted and saved (${message}). Check that FIELD_ENCRYPTION_KEYS is set correctly and try again.`,
    };
  }
}

/** Deletes one photo: the encrypted object first, then its metadata row. */
export async function deletePrivatePhotoAction(photoId: string): Promise<PhotosState> {
  const owner = await requireOwner('/dashboard/photos');
  const parsed = z.uuid().safeParse(photoId);
  if (!parsed.success) return { ok: false, error: 'That photo no longer exists.' };

  const supabase = await createUserClient();
  const { data: photo } = await supabase
    .from('private_photos')
    .select('storage_path')
    .eq('id', parsed.data)
    .eq('owner_id', owner.id)
    .maybeSingle<{ storage_path: string }>();

  if (!photo) return { ok: false, error: 'That photo no longer exists.' };

  const { error: storageError } = await supabase.storage.from(DOCUMENTS_BUCKET).remove([photo.storage_path]);
  if (storageError) {
    log.warn('photos.delete storage failed', { code: storageError.name });
    return { ok: false, error: 'The stored photo could not be removed. Try again.' };
  }

  const { error: dbError } = await supabase
    .from('private_photos')
    .delete()
    .eq('id', parsed.data)
    .eq('owner_id', owner.id);

  if (dbError) {
    log.warn('photos.delete failed', { code: dbError.code });
    return { ok: false, error: 'The photo could not be deleted. Try again.' };
  }

  revalidatePath('/dashboard/photos');
  return { ok: true, message: 'Photo deleted.' };
}

/** Sets or rotates the album password (Argon2id). Service-role write only. */
export async function setPhotoPasswordAction(_prev: PhotosState, formData: FormData): Promise<PhotosState> {
  const owner = await requireOwner('/dashboard/photos');

  const throttle = await guardOwnerAction(owner.id, 'photos.password');
  if (!throttle.allowed) {
    return { ok: false, error: `Too many attempts. Try again in ${throttle.retryAfterMinutes} minutes.` };
  }

  const parsed = z
    .object({
      password: passwordSchema,
      confirm: z.string(),
    })
    .safeParse({
      password: String(formData.get('password') ?? ''),
      confirm: String(formData.get('confirm') ?? ''),
    });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Choose a stronger album password.' };
  }
  if (parsed.data.password !== parsed.data.confirm) {
    return { ok: false, error: 'The two passwords do not match.' };
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const supabase = createServiceClient();
  const { error } = await supabase.from('owner_secrets').upsert(
    {
      owner_id: owner.id,
      photo_password_hash: passwordHash,
      photo_password_set_at: new Date().toISOString(),
    },
    { onConflict: 'owner_id' },
  );
  if (error) {
    log.warn('photos.password save failed', { code: error.code });
    return { ok: false, error: 'The album password could not be saved. Try again.' };
  }

  revalidatePath('/dashboard/photos');
  return { ok: true, message: 'Album password saved. Share it separately from the access code.' };
}

/** Turns the album on or off. Enabling requires an album password to exist. */
export async function setPrivatePhotosEnabledAction(enabled: boolean): Promise<PhotosState> {
  const owner = await requireOwner('/dashboard/photos');

  const throttle = await guardOwnerAction(owner.id, 'photos.settings');
  if (!throttle.allowed) {
    return { ok: false, error: `Too many changes just now. Try again in ${throttle.retryAfterMinutes} minutes.` };
  }

  const supabase = createServiceClient();
  if (enabled) {
    const { data } = await supabase
      .from('owner_secrets')
      .select('photo_password_hash')
      .eq('owner_id', owner.id)
      .maybeSingle<{ photo_password_hash: string | null }>();
    if (!data?.photo_password_hash) {
      return { ok: false, error: 'Set an album password before switching private photos on.' };
    }
  }

  const { error } = await supabase.from('owner_secrets').upsert(
    { owner_id: owner.id, private_photos_enabled: enabled },
    { onConflict: 'owner_id' },
  );
  if (error) {
    log.warn('photos.enabled save failed', { code: error.code });
    return { ok: false, error: 'The setting could not be saved. Try again.' };
  }

  revalidatePath('/dashboard/photos');
  return {
    ok: true,
    message: enabled
      ? 'Private photos are live on your profile link.'
      : 'Private photos are switched off. The album is no longer reachable.',
  };
}
