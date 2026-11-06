import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getOwnerIdOrNull } from '@/lib/auth/session';
import { createUserClient } from '@/lib/db/user';
import { signedDownloadUrl } from '@/lib/storage';

export const dynamic = 'force-dynamic';

const NO_STORE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
} as const;

/**
 * Owner-only download. The row is read through the owner's own session, so RLS
 * scopes it to their folder; the file is then served through a ≤60 s signed URL
 * with an attachment disposition.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ownerId = await getOwnerIdOrNull();
  if (!ownerId) {
    return new NextResponse('Unauthorized', { status: 401, headers: NO_STORE });
  }

  const { id } = await params;
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) {
    return new NextResponse('Not found', { status: 404, headers: NO_STORE });
  }

  const supabase = await createUserClient();
  const { data: document } = await supabase
    .from('documents')
    .select('storage_path, name')
    .eq('id', parsed.data)
    .eq('owner_id', ownerId)
    .maybeSingle<{ storage_path: string; name: string }>();

  if (!document) {
    return new NextResponse('Not found', { status: 404, headers: NO_STORE });
  }

  const url = await signedDownloadUrl(document.storage_path, document.name);
  if (!url) {
    return new NextResponse('Not found', { status: 404, headers: NO_STORE });
  }

  return NextResponse.redirect(url, { status: 302, headers: NO_STORE });
}
