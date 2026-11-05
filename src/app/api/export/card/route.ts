import { NextResponse, type NextRequest } from 'next/server';
import { getOwnerOrNull } from '@/lib/auth/session';
import { loadCardData } from '@/lib/card/load';
import { renderCardPng } from '@/lib/export/card-image';
import { renderCardPdf } from '@/lib/export/card-pdf';

export const dynamic = 'force-dynamic';

/**
 * Card export. Rendered on demand from the database — nothing is cached, and
 * the output is a pure function of the saved profile.
 *   /api/export/card?format=png&face=front|back&bleed=0|1
 *   /api/export/card?format=pdf&face=front|back|both&bleed=0|1
 */
export async function GET(request: NextRequest) {
  const owner = await getOwnerOrNull();
  if (!owner) return new NextResponse('Unauthorized', { status: 401 });

  const data = await loadCardData(owner.id);
  if (!data) return new NextResponse('No card yet', { status: 404 });

  const params = request.nextUrl.searchParams;
  const format = params.get('format') === 'pdf' ? 'pdf' : 'png';
  const bleed = params.get('bleed') === '1';
  const faceParam = params.get('face');
  const face = faceParam === 'back' ? 'back' : 'front';

  const noStore = {
    'Cache-Control': 'no-store',
    'X-Robots-Tag': 'noindex, nofollow, noarchive',
  } as const;

  if (format === 'pdf') {
    const faces = faceParam === 'both' ? 'both' : face;
    const bytes = await renderCardPdf({ data, faces, bleed });
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        ...noStore,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="identity-card${bleed ? '-bleed' : ''}.pdf"`,
      },
    });
  }

  const png = await renderCardPng({ face, data, bleed });
  return new NextResponse(new Uint8Array(png), {
    headers: {
      ...noStore,
      'Content-Type': 'image/png',
      'Content-Disposition': `attachment; filename="identity-card-${face}${bleed ? '-bleed' : ''}.png"`,
    },
  });
}
