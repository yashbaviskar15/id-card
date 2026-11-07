import { NextResponse, type NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/db/service';
import { loadGrantedProfile } from '@/lib/access/visitor';
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
} as const;

const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/tiff']);

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const parsed = slugSchema.safeParse(slug);
  if (!parsed.success) return new NextResponse('Not found', { status: 404, headers: NO_STORE });

  const granted = await loadGrantedProfile(parsed.data);
  const path = granted?.profile.photo_path;
  if (!path) return new NextResponse('Not found', { status: 404, headers: NO_STORE });

  const { data: image, error } = await createServiceClient()
    .storage.from(DOCUMENTS_BUCKET).download(path);
  if (error || !image) {
    log.warn('access.photo read failed', { code: error?.name });
    return new NextResponse('Not found', { status: 404, headers: NO_STORE });
  }

  const contentType = IMAGE_MIMES.has(image.type) ? image.type : 'application/octet-stream';
  return new NextResponse(image.stream(), {
    status: 200,
    headers: {
      ...NO_STORE,
      'Content-Type': contentType,
      'Content-Length': String(image.size),
      'Content-Disposition': 'inline; filename="profile-photo"',
    },
  });
}
