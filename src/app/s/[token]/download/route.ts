import { NextResponse, type NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/db/service';
import { hashToken } from '@/lib/crypto/proofs';
import { resolveShareLink, shareTokenSchema } from '@/lib/share/load';
import { isShareUnlocked } from '@/lib/share/unlock';
import { DOCUMENTS_BUCKET, dispositionName } from '@/lib/storage';
import { log } from '@/lib/log';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const NO_STORE = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'X-Content-Type-Options': 'nosniff',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'X-Frame-Options': 'SAMEORIGIN',
} as const;

function notAvailable(): NextResponse {
  return new NextResponse('Not found', { status: 404, headers: NO_STORE });
}

interface ConsumedShare {
  share_id: string;
  owner_id: string;
  storage_path: string;
  name: string;
  mime: string;
}

/**
 * Streams one document for a share link.
 *
 * The link is re-validated here (never trusting the landing page). Storage is
 * read before the atomic consume so an unavailable object does not spend a
 * download; the consume function re-checks expiry, revocation and limits before
 * any bytes are returned. Every failure uses the same generic 404.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const parsed = shareTokenSchema.safeParse(token);
  if (!parsed.success) return notAvailable();

  const link = await resolveShareLink(parsed.data);
  if (!link) return notAvailable();

  // A protected link must have been unlocked in this session first.
  if (link.requiresPassword && !(await isShareUnlocked(parsed.data))) {
    return NextResponse.redirect(new URL(`/s/${encodeURIComponent(parsed.data)}`, request.url), {
      status: 307,
      headers: NO_STORE,
    });
  }

  const supabase = createServiceClient();
  const { data: file, error: fileError } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .download(link.storagePath);
  if (fileError || !file) {
    log.warn('share.download read failed', { code: fileError?.name });
    return notAvailable();
  }

  const { data, error } = await supabase.rpc('consume_share_download', {
    p_token_hash: hashToken(parsed.data),
    p_expected_storage_path: link.storagePath,
  });
  if (error) {
    log.warn('share.download consume failed', { code: error.code });
    return notAvailable();
  }
  if (!data) return notAvailable();

  const consumed = data as ConsumedShare;
  // Defend in depth; the RPC also checks this before consuming quota.
  if (consumed.storage_path !== link.storagePath) return notAvailable();

  return new NextResponse(file.stream(), {
    status: 200,
    headers: {
      ...NO_STORE,
      'Content-Type': consumed.mime,
      'Content-Length': String(file.size),
      'Content-Disposition': `attachment; filename="${dispositionName(consumed.name)}"`,
    },
  });
}
