import 'server-only';
import { log } from '@/lib/log';
import { createServiceClient } from '@/lib/db/service';

/**
 * Private Storage access. Visitor downloads are streamed through grant-checked
 * routes; only owner card previews use a short-lived signed URL.
 */

/** Private bucket that holds every owner file. Never public. */
export const DOCUMENTS_BUCKET = 'documents';

/** Only used for owner card previews; downloads use authenticated routes. */
export const SIGNED_URL_TTL_SECONDS = 300;

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
