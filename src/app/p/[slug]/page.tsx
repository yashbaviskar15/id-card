import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { loadGrantedProfile, recordVisitorView } from '@/lib/access/visitor';
import { clientIpFromHeaders, hashIp, truncateUserAgent } from '@/lib/crypto/ip';
import { slugSchema } from '@/lib/validation';
import { GrantedProfileView } from '@/components/access/granted-profile-view';
import { LockScreen } from './lock-screen';

/**
 * The single public entry point of the whole app. It is dynamic, never cached
 * and never indexed, and it renders the profile only after the grant cookie has
 * been re-validated against the database on this very request.
 */
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Protected profile',
  robots: { index: false, follow: false, nocache: true },
};

export default async function PublicProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const parsed = slugSchema.safeParse(slug);
  if (!parsed.success) {
    // An unknown shape can never match a stored slug; the screen is identical
    // to the one a valid-but-locked profile shows, so nothing is disclosed.
    return <LockScreen slug={slug} />;
  }

  const granted = await loadGrantedProfile(parsed.data);
  if (!granted) return <LockScreen slug={parsed.data} />;

  const headerList = await headers();
  await recordVisitorView({
    slug: parsed.data,
    grantId: granted.grantId,
    ipHash: hashIp(clientIpFromHeaders(headerList)),
    userAgent: truncateUserAgent(headerList.get('user-agent')),
  });

  return <GrantedProfileView slug={parsed.data} profile={granted.profile} />;
}
