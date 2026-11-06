import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createUserClient } from '@/lib/db/user';
import { signedServiceDownloadUrl } from '@/lib/storage';

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
  const { id } = await params;
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) {
    return new NextResponse('Not found', { status: 404, headers: NO_STORE });
  }

  // Use the owner's own client: RLS handles the owner_id check automatically.
  // This is safer and ensures the session is valid.
  const supabase = await createUserClient();
  const { data: document, error } = await supabase
    .from('documents')
    .select('storage_path, name')
    .eq('id', parsed.data)
    .maybeSingle<{ storage_path: string; name: string }>();

  if (error || !document) {
    // If we're not logged in or the document doesn't exist, we get no data.
    return new NextResponse('Not found', { status: 404, headers: NO_STORE });
  }

  // Signed URL must be minted through the service role because storage RLS
  // might be too restrictive for the browser session in some environments.
  const url = await signedServiceDownloadUrl(document.storage_path, document.name);
  if (!url) {
    return new NextResponse('Not found', { status: 404, headers: NO_STORE });
  }

  return NextResponse.redirect(url, { status: 302, headers: NO_STORE });
}
