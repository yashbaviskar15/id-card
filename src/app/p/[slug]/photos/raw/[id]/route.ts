import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/db/service';
import { loadGrantedPhoto } from '@/lib/access/visitor';
import { decryptPhotoBytes, photoAad } from '@/lib/crypto/photos';
import { DOCUMENTS_BUCKET } from '@/lib/storage';
import { log } from '@/lib/log';
import { slugSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const NO_STORE = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'Cross-Origin-Resource-Policy': 'same-origin',
  // Never render as a standalone document that could be saved.
  'Content-Security-Policy': "default-src 'none'; img-src 'self'; sandbox",
} as const;

const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/tiff']);

/**
 * Streams one album photo, decrypted on the fly. The bytes live encrypted in
 * the private bucket; the storage path is resolved only after the album session
 * is re-validated (grant live, profile active, album enabled, password cookie
 * present). The response is inline-only and no-store, so there is nothing to
 * bookmark, cache or hand to a download manager.
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

  const target = await loadGrantedPhoto(parsedSlug.data, parsedId.data);
  if (!target) return new NextResponse('Not found', { status: 404, headers: NO_STORE });

  const { data: object, error } = await createServiceClient()
    .storage.from(DOCUMENTS_BUCKET).download(target.storagePath);
  if (error || !object) {
    log.warn('access.album photo read failed', { code: error?.name });
    return new NextResponse('Not found', { status: 404, headers: NO_STORE });
  }

  let plain: Buffer;
  try {
    plain = decryptPhotoBytes(Buffer.from(await object.arrayBuffer()), photoAad(target.ownerId, parsedId.data));
  } catch (cause) {
    log.warn('access.album photo decrypt failed', {
      message: cause instanceof Error ? cause.message : 'unknown',
    });
    return new NextResponse('Not found', { status: 404, headers: NO_STORE });
  }

  const contentType = IMAGE_MIMES.has(target.mime) ? target.mime : 'application/octet-stream';
  return new NextResponse(new Uint8Array(plain), {
    status: 200,
    headers: {
      ...NO_STORE,
      'Content-Type': contentType,
      'Content-Length': String(plain.byteLength),
      // Inline only — a separate "attachment" path is never offered.
      'Content-Disposition': 'inline',
    },
  });
}
