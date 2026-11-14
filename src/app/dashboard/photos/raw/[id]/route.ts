import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getOwnerIdOrNull } from '@/lib/auth/session';
import { createServiceClient } from '@/lib/db/service';
import { decryptPhotoBytes, photoAad } from '@/lib/crypto/photos';
import { DOCUMENTS_BUCKET } from '@/lib/storage';
import { log } from '@/lib/log';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const NO_STORE = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, nofollow',
  'Cross-Origin-Resource-Policy': 'same-origin',
} as const;

const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/tiff']);

/**
 * Owner-side album preview. The dashboard cannot use a signed Storage URL here
 * because the stored object is ciphertext; this route decrypts for the owner
 * only after the session is resolved. It is never linked from a visitor page.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ownerId = await getOwnerIdOrNull();
  const parsedId = z.uuid().safeParse((await params).id);
  if (!ownerId || !parsedId.success) return new NextResponse('Not found', { status: 404, headers: NO_STORE });

  const supabase = createServiceClient();
  const { data: photo } = await supabase
    .from('private_photos')
    .select('storage_path, mime')
    .eq('id', parsedId.data)
    .eq('owner_id', ownerId)
    .maybeSingle<{ storage_path: string; mime: string }>();
  if (!photo) return new NextResponse('Not found', { status: 404, headers: NO_STORE });

  const { data: object, error } = await supabase.storage.from(DOCUMENTS_BUCKET).download(photo.storage_path);
  if (error || !object) {
    log.warn('photos.preview read failed', { code: error?.name });
    return new NextResponse('Not found', { status: 404, headers: NO_STORE });
  }

  let plain: Buffer;
  try {
    plain = decryptPhotoBytes(Buffer.from(await object.arrayBuffer()), photoAad(ownerId, parsedId.data));
  } catch (cause) {
    log.warn('photos.preview decrypt failed', {
      message: cause instanceof Error ? cause.message : 'unknown',
    });
    return new NextResponse('Not found', { status: 404, headers: NO_STORE });
  }

  const contentType = IMAGE_MIMES.has(photo.mime) ? photo.mime : 'application/octet-stream';
  return new NextResponse(new Uint8Array(plain), {
    status: 200,
    headers: {
      ...NO_STORE,
      'Content-Type': contentType,
      'Content-Length': String(plain.byteLength),
      'Content-Disposition': 'inline',
    },
  });
}
