import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/db/service';
import { loadGrantedDocument } from '@/lib/access/visitor';
import { DOCUMENTS_BUCKET } from '@/lib/storage';
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
  'X-Frame-Options': 'SAMEORIGIN',
} as const;

const PREVIEWABLE_MIMES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

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
  if (!document) return new NextResponse('Not found', { status: 404, headers: NO_STORE });
  if (!PREVIEWABLE_MIMES.has(document.mime)) {
    return new NextResponse('Preview unavailable', { status: 415, headers: NO_STORE });
  }

  const { data: file, error } = await createServiceClient()
    .storage.from(DOCUMENTS_BUCKET).download(document.storagePath);
  if (error || !file) {
    log.warn('access.document preview failed', { code: error?.name });
    return new NextResponse('Not found', { status: 404, headers: NO_STORE });
  }

  return new NextResponse(file.stream(), {
    status: 200,
    headers: {
      ...NO_STORE,
      'Content-Type': document.mime,
      'Content-Length': String(file.size),
      'Content-Disposition': 'inline',
    },
  });
}
