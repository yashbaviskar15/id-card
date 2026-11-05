import { NextResponse, type NextRequest } from 'next/server';
import { loadGrantedProfile } from '@/lib/access/visitor';
import { slugSchema } from '@/lib/validation';
import type { GrantedProfile } from '@/lib/types';

export const dynamic = 'force-dynamic';

const NO_STORE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
} as const;

/** vCard 3.0 escaping: backslash, semicolon, comma and newlines. */
function esc(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/([;,])/g, '\\$1').replace(/\r?\n/g, '\\n');
}

function buildVCard(profile: GrantedProfile): string {
  const lines = ['BEGIN:VCARD', 'VERSION:3.0', `N:${esc(profile.full_name)};;;;`, `FN:${esc(profile.full_name)}`];

  for (const item of profile.phones) lines.push(`TEL;TYPE=CELL:${esc(item.value)}`);
  for (const item of profile.emails) lines.push(`EMAIL;TYPE=INTERNET:${esc(item.value)}`);
  if (profile.address) lines.push(`ADR;TYPE=HOME:;;${esc(profile.address)};;;;`);
  if (profile.dob) lines.push(`BDAY:${esc(profile.dob)}`);

  lines.push('END:VCARD');
  // RFC 6350 requires CRLF between content lines.
  return `${lines.join('\r\n')}\r\n`;
}

/**
 * Contact download. It sits under the same path as the profile page, so the
 * path-scoped visitor cookie is required: without a valid, unexpired and
 * unrevoked grant this returns 401 and no data.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const parsed = slugSchema.safeParse(slug);
  if (!parsed.success) {
    return new NextResponse('Not found', { status: 404, headers: NO_STORE });
  }

  const granted = await loadGrantedProfile(parsed.data);
  if (!granted) {
    return new NextResponse('Unauthorized', { status: 401, headers: NO_STORE });
  }

  return new NextResponse(buildVCard(granted.profile), {
    status: 200,
    headers: {
      ...NO_STORE,
      'Content-Type': 'text/vcard; charset=utf-8',
      'Content-Disposition': 'attachment; filename="contact.vcf"',
    },
  });
}
