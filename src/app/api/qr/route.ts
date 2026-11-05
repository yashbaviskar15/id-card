import { NextResponse, type NextRequest } from 'next/server';
import { createUserClient } from '@/lib/db/user';
import { renderQrPng, renderQrSvg } from '@/lib/qr/render';

export const dynamic = 'force-dynamic';

/**
 * On-demand QR rendering. Nothing is stored; the bytes are a pure function of
 * NEXT_PUBLIC_SITE_URL + the slug.
 *   /api/qr?format=svg
 *   /api/qr?format=png&size=1024   (default) or size=3000 (print)
 */
export async function GET(request: NextRequest) {
  const supabase = await createUserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse('Unauthorized', { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('slug')
    .eq('owner_id', user.id)
    .maybeSingle<{ slug: string }>();

  if (!profile) return new NextResponse('No profile yet', { status: 404 });

  const format = request.nextUrl.searchParams.get('format') ?? 'png';
  const sizeParam = Number(request.nextUrl.searchParams.get('size') ?? '1024');
  const size = sizeParam === 3000 ? 3000 : 1024;

  if (format === 'svg') {
    const svg = await renderQrSvg(profile.slug);
    return new NextResponse(svg, {
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Content-Disposition': 'attachment; filename="profile-qr.svg"',
        'Cache-Control': 'no-store',
      },
    });
  }

  const png = await renderQrPng(profile.slug, size);
  return new NextResponse(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Content-Disposition': `attachment; filename="profile-qr-${size}.png"`,
      'Cache-Control': 'no-store',
    },
  });
}
