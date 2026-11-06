import 'server-only';
import { log } from '@/lib/log';
import { createServiceClient } from '@/lib/db/service';

/**
 * Private Storage access. Every file lives in a private bucket under the owner's
 * folder, and the only way to read one is a signed URL that expires within 1 hour.
 * Public URLs are never generated anywhere in the app.
 */

/** Private bucket that holds every owner file. Never public. */
export const DOCUMENTS_BUCKET = 'documents';

/** Signed URLs are valid for 1 hour to prevent expiry during slow loads or caching. */
export const SIGNED_URL_TTL_SECONDS = 3600;

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
 * the service role so RLS does not block signed URL generation.
 */
export async function signedUrlFor(path: string | null): Promise<string | null> {
  if (!path) return null;
  const supabase = createServiceClient();
  const { data, error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error) {
    console.error('storage.signedUrl failed', { path, error });
    log.warn('storage.signedUrl failed', { path, code: error.name, message: error.message });
    return null;
  }
  if (!data) return null;
  return data.signedUrl;
}

/** Owner-scoped download URL: forces an attachment carrying the display name. */
export async function signedDownloadUrl(path: string, filename: string): Promise<string | null> {
  const supabase = createServiceClient();
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
  if (error) {
    console.error('storage.signedServiceUrl failed', { path, error });
    log.warn('storage.signedServiceUrl failed', { path, code: error.name, message: error.message });
    return null;
  }
  if (!data) return null;
  return data.signedUrl;
}

export async function signedServiceDownloadUrl(path: string, filename: string): Promise<string | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS, { download: dispositionName(filename) });
  if (error) {
    console.error('storage.signedServiceDownloadUrl failed', { path, error });
  }
  if (error || !data) return null;
  return data.signedUrl;
}
