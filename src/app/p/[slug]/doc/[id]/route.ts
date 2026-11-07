import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/db/service';
import { loadGrantedDocument } from '@/lib/access/visitor';
import { dispositionName, DOCUMENTS_BUCKET } from '@/lib/storage';
import { log } from '@/lib/log';
import { slugSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const NO_STORE = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'X-Content-Type-Options': 'nosniff',
  'Cross-Origin-Resource-Policy': 'same-origin',
} as const;

/**
 * Opens one shared document for a live visitor session.
 *
 * It sits under `/p/<slug>`, so the path-scoped visitor cookie is required and
 * the grant is re-validated on this request. The database returns a storage
 * path only when the grant opted into documents and the document is still
 * shared. The bytes are proxied through this route instead of redirecting to a
 * storage URL, so a copied storage link cannot survive grant revocation.
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

  const { data: file, error } = await createServiceClient()
    .storage.from(DOCUMENTS_BUCKET).download(document.storagePath);
  if (error || !file) {
    log.warn('access.document download failed', { code: error?.name });
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
