import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createUserClient } from '@/lib/db/user';
import { dispositionName, DOCUMENTS_BUCKET } from '@/lib/storage';
import { log } from '@/lib/log';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_STORE = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'X-Content-Type-Options': 'nosniff',
  'Cross-Origin-Resource-Policy': 'same-origin',
} as const;

/**
 * Owner-only download. The row is read through the owner's own session, so RLS
 * scopes it to their folder; the file is also downloaded with that same session
 * and proxied here instead of exposing a reusable signed storage URL.
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
    console.warn('api.documents: document not found in DB', { id: parsed.data, error });
    // If we're not logged in or the document doesn't exist, we get no data.
    return new NextResponse('Not found', { status: 404, headers: NO_STORE });
  }

  const { data: file, error: storageError } = await supabase
    .storage.from(DOCUMENTS_BUCKET).download(document.storage_path);
  if (storageError || !file) {
    log.warn('api.documents download failed', { code: storageError?.name });
    return new NextResponse('Not found', { status: 404, headers: NO_STORE });
  }

  return new NextResponse(file.stream(), {
    status: 200,
    headers: {
      ...NO_STORE,
      'Content-Type': 'application/octet-stream',
      'Content-Length': String(file.size),
      'Content-Disposition': `attachment; filename="${dispositionName(document.name)}"`,
    },
  });
}
