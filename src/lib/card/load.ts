import 'server-only';
import { createUserClient } from '@/lib/db/user';
import { generateSlug } from '@/lib/crypto/random';
import { log } from '@/lib/log';
import type { CardData } from '@/lib/card/data';
import type { ProfileRow } from '@/lib/types';

/** Private bucket that holds every owner file. Never public. */
export const DOCUMENTS_BUCKET = 'documents';

/** Signed URLs are short-lived (≤60 s) and are the only way to read a file. */
export const SIGNED_URL_TTL_SECONDS = 60;

const PROFILE_COLUMNS =
  'id, owner_id, slug, full_name, dob, address, photo_path, show_dob, show_address, show_photo, is_active, created_at, updated_at';

export async function getProfile(ownerId: string): Promise<ProfileRow | null> {
  const supabase = await createUserClient();
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('owner_id', ownerId)
    .maybeSingle<ProfileRow>();
  if (error) {
    log.warn('profile.read failed', { code: error.code });
    return null;
  }
  return data ?? null;
}

/**
 * First-run profile creation. The slug is generated here, exactly once, from a
 * CSPRNG — never derived from the name or the email — and the database refuses
 * every later change to it. Nothing that follows may ever call this again.
 */
export async function createProfile(
  ownerId: string,
  input: { fullName: string; dob?: string | null; address?: string | null },
): Promise<ProfileRow> {
  const supabase = await createUserClient();

  // A unique-violation (23505) here can only be a slug collision: retry with a
  // fresh 80-bit slug. Five attempts is overwhelmingly safe.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const slug = generateSlug();
    const { data, error } = await supabase
      .from('profiles')
      .insert({
        owner_id: ownerId,
        slug,
        full_name: input.fullName,
        dob: input.dob ?? null,
        address: input.address ?? null,
      })
      .select(PROFILE_COLUMNS)
      .single<ProfileRow>();

    if (!error && data) return data;
    if (error?.code !== '23505') {
      log.warn('profile.create failed', { code: error?.code });
      throw new Error('Could not create the profile.');
    }
  }
  throw new Error('Could not create the profile.');
}

/**
 * Profile update. The column list is explicit and never contains `slug`, and it
 * is always an UPDATE — never a delete-and-insert, never an upsert. This is what
 * keeps the QR payload stable for the lifetime of the app.
 */
export async function updateProfile(
  ownerId: string,
  input: {
    full_name: string;
    dob: string | null;
    address: string | null;
    show_dob: boolean;
    show_address: boolean;
    show_photo: boolean;
    is_active: boolean;
  },
): Promise<ProfileRow | null> {
  const supabase = await createUserClient();
  const { data, error } = await supabase
    .from('profiles')
    .update({
      full_name: input.full_name,
      dob: input.dob,
      address: input.address,
      show_dob: input.show_dob,
      show_address: input.show_address,
      show_photo: input.show_photo,
      is_active: input.is_active,
    })
    .eq('owner_id', ownerId)
    .select(PROFILE_COLUMNS)
    .maybeSingle<ProfileRow>();

  if (error) {
    log.warn('profile.update failed', { code: error.code });
    throw new Error('Could not save the profile.');
  }
  return data ?? null;
}

export async function setProfilePhoto(ownerId: string, photoPath: string | null): Promise<void> {
  const supabase = await createUserClient();
  const { error } = await supabase
    .from('profiles')
    .update({ photo_path: photoPath })
    .eq('owner_id', ownerId);
  if (error) {
    log.warn('profile.photo failed', { code: error.code });
    throw new Error('Could not update the photo.');
  }
}

/** Short-lived signed URL for a stored object. Returns null when unavailable. */
export async function signedUrlFor(path: string | null): Promise<string | null> {
  if (!path) return null;
  const supabase = await createUserClient();
  const { data, error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data) return null;
  return data.signedUrl;
}

/**
 * The exact projection the identity card renders. Contact details come from the
 * owner's public email/phone fields; nothing sensitive is ever included.
 */
export async function loadCardData(ownerId: string): Promise<CardData | null> {
  const supabase = await createUserClient();
  const profile = await getProfile(ownerId);
  if (!profile) return null;

  const { data: contacts } = await supabase
    .from('fields')
    .select('kind, value, sort')
    .eq('owner_id', ownerId)
    .eq('is_public', true)
    .in('kind', ['email', 'phone'])
    .order('sort', { ascending: true });

  let email: string | null = null;
  let phone: string | null = null;
  for (const row of contacts ?? []) {
    if (row.kind === 'email' && !email) email = row.value;
    if (row.kind === 'phone' && !phone) phone = row.value;
  }

  return {
    slug: profile.slug,
    fullName: profile.full_name,
    dob: profile.dob,
    address: profile.address,
    phone,
    email,
    photoUrl: await signedUrlFor(profile.photo_path),
  };
}
