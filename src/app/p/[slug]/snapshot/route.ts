import { NextResponse, type NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/db/service';
import { readVisitorSession, visitorPhotoUrl } from '@/lib/access/visitor';
import { log } from '@/lib/log';
import { slugSchema } from '@/lib/validation';
import type { GrantedProfile } from '@/lib/types';

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

  const session = await readVisitorSession(parsed.data);
  if (!session) {
    return NextResponse.json({ error: 'session_ended' }, { status: 401, headers: NO_STORE });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc('get_granted_profile', {
    p_grant_id: session.grantId,
    p_slug: parsed.data,
  });
  if (error) {
    log.warn('access.snapshot read failed', { code: error.code });
    return NextResponse.json({ error: 'temporarily_unavailable' }, { status: 503, headers: NO_STORE });
  }
  if (!data) {
    return NextResponse.json({ error: 'session_ended' }, { status: 401, headers: NO_STORE });
  }

  const profile = data as GrantedProfile;
  // The client value only avoids re-signing an unchanged image; the URL is
  // always minted from the database's grant-filtered result above.
  const knownPhotoPath = request.nextUrl.searchParams.get('photoPath');
  const photoChanged = profile.photo_path !== knownPhotoPath;
  const photoUrl = photoChanged ? visitorPhotoUrl(parsed.data, profile.photo_path) : undefined;
  if (photoChanged && profile.photo_path && !photoUrl) {
    return NextResponse.json({ error: 'temporarily_unavailable' }, { status: 503, headers: NO_STORE });
  }

  return NextResponse.json(
    { profile, photoChanged, ...(photoChanged ? { photoUrl } : {}) },
    { headers: NO_STORE },
  );
}
