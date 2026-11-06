import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { loadGrantedDocument } from '@/lib/access/visitor';
import { signedServiceDownloadUrl } from '@/lib/storage';
import { slugSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

const NO_STORE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
} as const;

/**
 * Opens one shared document for a live visitor session.
 *
 * It sits under `/p/<slug>`, so the path-scoped visitor cookie is required and
 * the grant is re-validated on this request. The database returns a storage
 * path only when the grant opted into documents and the document is still
 * shared; the file itself is then handed over through a ≤60 s signed URL, so no
 * link a visitor could keep ever outlives the session.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> },
) {
  const { slug, id } = await params;

  const parsedSlug = slugSchema.safeParse(slug);
  const parsedId = z.uuid().safeParse(id);
  if (!parsedSlug.success || !parsedId.success) {
    return new NextResponse('Not found', { status: 404, headers: NO_STORE });
  }

  const document = await loadGrantedDocument(parsedSlug.data, parsedId.data);
  if (!document) {
    return new NextResponse('Unauthorized', { status: 401, headers: NO_STORE });
  }

  const url = await signedServiceDownloadUrl(document.storagePath, document.name);
  if (!url) {
    return new NextResponse('Not found', { status: 404, headers: NO_STORE });
  }

  return NextResponse.redirect(url, { status: 302, headers: NO_STORE });
}
