import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { slugSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_STORE = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
} as const;

/** Keep the old document URL as a compatibility redirect to the watermarked viewer. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> },
) {
  const { slug, id } = await params;
  const parsedSlug = slugSchema.safeParse(slug);
  const parsedId = z.uuid().safeParse(id);
  if (!parsedSlug.success || !parsedId.success) {
    return new NextResponse('Not found', { status: 404, headers: NO_STORE });
  }

  return NextResponse.redirect(
    new URL(`/p/${encodeURIComponent(parsedSlug.data)}/doc/${parsedId.data}/view`, request.url),
    { status: 307, headers: NO_STORE },
  );
}
