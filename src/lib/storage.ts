import 'server-only';
import { createServiceClient } from '@/lib/db/service';
import { createUserClient } from '@/lib/db/user';

/**
 * Private Storage access. Every file lives in a private bucket under the owner's
 * folder, and the only way to read one is a signed URL that expires within 60
 * seconds. Public URLs are never generated anywhere in the app.
 */

/** Private bucket that holds every owner file. Never public. */
export const DOCUMENTS_BUCKET = 'documents';

/** Signed URLs are short-lived (≤60 s) and are the only way to read a file. */
export const SIGNED_URL_TTL_SECONDS = 60;

const UNSAFE_DISPOSITION_CHARS = /[^A-Za-z0-9._-]+/g;

/**
 * ASCII-only file name for the Content-Disposition header. Anything outside a
 * conservative set is folded to "_", so a hostile name can neither break nor
 * inject into the header.
 */
export function dispositionName(filename: string): string {
  const cleaned = filename.replace(UNSAFE_DISPOSITION_CHARS, '_').replace(/^[.]+/, '').slice(0, 120);
  return cleaned || 'download';
}

/**
 * Short-lived signed URL for inline display (e.g. the card photo), read through
 * the owner's own session so RLS applies.
 */
export async function signedUrlFor(path: string | null): Promise<string | null> {
  if (!path) return null;
  const supabase = await createUserClient();
  const { data, error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data) return null;
  return data.signedUrl;
}

/** Owner-scoped download URL: forces an attachment carrying the display name. */
export async function signedDownloadUrl(path: string, filename: string): Promise<string | null> {
  const supabase = await createUserClient();
  const { data, error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS, { download: dispositionName(filename) });
  if (error || !data) return null;
  return data.signedUrl;
}

/**
 * Service-role variants. Only ever called after an owner session, a visitor
 * session or a share link has been validated server side — situations where
 * there is no usable owner cookie to mint the URL with.
 */
export async function signedServiceUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const supabase = createServiceClient();
  const { data, error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data) return null;
  return data.signedUrl;
}

export async function signedServiceDownloadUrl(path: string, filename: string): Promise<string | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS, { download: dispositionName(filename) });
  if (error || !data) return null;
  return data.signedUrl;
}
