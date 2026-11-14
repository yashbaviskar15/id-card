import { NextResponse, type NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/db/service';
import { readAlbumSession } from '@/lib/access/visitor';
import { log } from '@/lib/log';
import { slugSchema } from '@/lib/validation';
import type { GrantedPhotoAlbum } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_STORE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
} as const;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const parsed = slugSchema.safeParse(slug);
  if (!parsed.success) {
    return NextResponse.json({ error: 'not_found' }, { status: 404, headers: NO_STORE });
  }

  const session = await readAlbumSession(parsed.data);
  if (!session) {
    return NextResponse.json({ error: 'session_ended' }, { status: 401, headers: NO_STORE });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc('get_granted_photos', {
    p_grant_id: session.grantId,
    p_slug: parsed.data,
  });
  if (error) {
    log.warn('access.album.snapshot read failed', { code: error.code });
    return NextResponse.json({ error: 'temporarily_unavailable' }, { status: 503, headers: NO_STORE });
  }
  if (!data) {
    return NextResponse.json({ error: 'session_ended' }, { status: 401, headers: NO_STORE });
  }

  return NextResponse.json({ album: data as GrantedPhotoAlbum }, { headers: NO_STORE });
}
