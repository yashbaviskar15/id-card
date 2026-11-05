'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { createUserClient } from '@/lib/db/user';
import { createProfile, getProfile, setProfilePhoto, updateProfile } from '@/lib/card/load';
import { DOCUMENTS_BUCKET } from '@/lib/storage';
import { clientIpFromHeaders, hashIp, truncateUserAgent } from '@/lib/crypto/ip';
import { profileUpdateSchema } from '@/lib/validation';
import { zodFieldErrors } from '@/lib/result';
import { writeAudit } from '@/lib/audit';
import { log } from '@/lib/log';
import { requireOwner } from '@/lib/auth/session';
import { storagePathFor, validateUpload } from '@/lib/files/validate';
import type { FormState } from '@/app/(auth)/form-state';

const PHOTO_MAX_BYTES = 8 * 1024 * 1024;

async function requestContext() {
  const h = await headers();
  return { ipHash: hashIp(clientIpFromHeaders(h)), userAgent: truncateUserAgent(h.get('user-agent')) };
}

function readBoolean(formData: FormData, key: string): boolean {
  return formData.get(key) === 'on' || formData.get(key) === 'true';
}

/**
 * Create-or-update the profile. `slug` is never part of the payload: creation
 * generates it once, and every later write is an UPDATE of an explicit column
 * list. That is what keeps the QR payload byte-for-byte identical forever.
 */
export async function saveProfileAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const owner = await requireOwner('/dashboard/card');

  const parsed = profileUpdateSchema.safeParse({
    full_name: formData.get('full_name'),
    dob: formData.get('dob') ?? '',
    address: formData.get('address') ?? '',
    show_dob: readBoolean(formData, 'show_dob'),
    show_address: readBoolean(formData, 'show_address'),
    show_photo: readBoolean(formData, 'show_photo'),
    is_active: readBoolean(formData, 'is_active'),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: 'Please fix the highlighted fields.',
      fieldErrors: zodFieldErrors(parsed.error.flatten().fieldErrors as Record<string, string[]>),
    };
  }

  const input = parsed.data;
  const existing = await getProfile(owner.id);
  const { ipHash, userAgent } = await requestContext();

  try {
    if (!existing) {
      // First save: the slug is generated here, exactly once.
      const created = await createProfile(owner.id, {
        fullName: input.full_name,
        dob: input.dob || null,
        address: input.address || null,
      });
      await updateProfile(owner.id, {
        full_name: input.full_name,
        dob: input.dob || null,
        address: input.address || null,
        show_dob: input.show_dob,
        show_address: input.show_address,
        show_photo: input.show_photo,
        is_active: input.is_active,
      });
      await writeAudit({
        ownerId: owner.id,
        actor: 'owner',
        action: 'profile.create',
        entityType: 'profile',
        entityId: created.id,
        ipHash,
        userAgent,
      });
    } else {
      const updated = await updateProfile(owner.id, {
        full_name: input.full_name,
        dob: input.dob || null,
        address: input.address || null,
        show_dob: input.show_dob,
        show_address: input.show_address,
        show_photo: input.show_photo,
        is_active: input.is_active,
      });
      if (!updated) return { ok: false, error: 'Could not save the profile.' };
      await writeAudit({
        ownerId: owner.id,
        actor: 'owner',
        action: 'profile.update',
        entityType: 'profile',
        entityId: updated.id,
        detail: {
          show_dob: input.show_dob,
          show_address: input.show_address,
          show_photo: input.show_photo,
          is_active: input.is_active,
        },
        ipHash,
        userAgent,
      });
    }
  } catch (error) {
    log.warn('profile.save failed', { message: error instanceof Error ? error.message : 'unknown' });
    return { ok: false, error: 'Could not save the profile. Try again.' };
  }

  revalidatePath('/dashboard/card');
  revalidatePath('/dashboard');
  return { ok: true, message: 'Card saved.' };
}

export async function uploadPhotoAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const owner = await requireOwner('/dashboard/card');

  const file = formData.get('photo');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'Choose an image first.' };
  }
  if (file.size > PHOTO_MAX_BYTES) {
    return { ok: false, error: 'The photo must be smaller than 8 MB.' };
  }

  const validated = await validateUpload({
    buffer: Buffer.from(await file.arrayBuffer()),
    declaredName: file.name,
    declaredMime: file.type,
    imagesOnly: true,
  });
  if (!validated.ok) {
    const messages: Record<string, string> = {
      too_large: 'The photo is too large.',
      empty: 'That file is empty.',
      blocked_extension: 'That file type is not allowed.',
      type_not_allowed: 'Use a PNG, JPEG, WebP, HEIC or TIFF image.',
      type_mismatch: 'That file does not look like an image.',
      content_mismatch: 'The file contents do not match its name.',
    };
    return { ok: false, error: messages[validated.reason] ?? 'That file cannot be used.' };
  }

  const supabase = await createUserClient();
  const previous = (await getProfile(owner.id))?.photo_path ?? null;
  const objectPath = storagePathFor(owner.id, validated.data);

  const upload = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .upload(objectPath, validated.data.buffer, {
      contentType: validated.data.mime,
      upsert: false,
    });
  if (upload.error) {
    log.warn('photo.upload failed', { code: upload.error.name });
    return { ok: false, error: 'Could not upload the photo. Try again.' };
  }

  try {
    await setProfilePhoto(owner.id, objectPath);
  } catch {
    await supabase.storage.from(DOCUMENTS_BUCKET).remove([objectPath]);
    return { ok: false, error: 'Could not save the photo. Try again.' };
  }

  if (previous) {
    // Best-effort cleanup; a failure here never breaks the save.
    await supabase.storage.from(DOCUMENTS_BUCKET).remove([previous]).catch(() => undefined);
  }

  const { ipHash, userAgent } = await requestContext();
  await writeAudit({
    ownerId: owner.id,
    actor: 'owner',
    action: 'profile.photo_set',
    entityType: 'profile',
    detail: { mime: validated.data.mime, size: validated.data.size },
    ipHash,
    userAgent,
  });

  revalidatePath('/dashboard/card');
  return { ok: true, message: 'Photo updated.' };
}

export async function removePhotoAction(): Promise<void> {
  const owner = await requireOwner('/dashboard/card');
  const supabase = await createUserClient();
  const previous = (await getProfile(owner.id))?.photo_path ?? null;
  if (!previous) return;

  await setProfilePhoto(owner.id, null);
  await supabase.storage.from(DOCUMENTS_BUCKET).remove([previous]).catch(() => undefined);

  const { ipHash, userAgent } = await requestContext();
  await writeAudit({
    ownerId: owner.id,
    actor: 'owner',
    action: 'profile.photo_removed',
    entityType: 'profile',
    ipHash,
    userAgent,
  });

  revalidatePath('/dashboard/card');
}
