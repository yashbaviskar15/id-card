import { siteUrl } from '@/lib/env';
import { SLUG_PATTERN } from '@/lib/slug';

/**
 * THE single source of the QR payload (invariant 8.1).
 *
 * It is built from NEXT_PUBLIC_SITE_URL (set once, build-gated) and the profile
 * slug from the database — never from window.location, a preview URL, a code,
 * or any user data. Nothing else in the app may construct this string.
 */
export function qrPayload(slug: string): string {
  if (!SLUG_PATTERN.test(slug)) {
    throw new Error('qrPayload: refusing to build a payload from a malformed slug');
  }
  return `${siteUrl}/p/${slug}`;
}
