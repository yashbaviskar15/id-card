import type { Metadata } from 'next';
import { after } from 'next/server';
import { headers } from 'next/headers';
import { loadGrantedProfile, recordVisitorView, visitorPhotoUrl } from '@/lib/access/visitor';
import { clientIpFromHeaders, hashIp, truncateUserAgent } from '@/lib/crypto/ip';
import { slugSchema } from '@/lib/validation';
import { GrantedProfileView } from '@/components/access/granted-profile-view';
import { LockScreen } from './lock-screen';
import { createShareMetadata } from '@/lib/seo';
import { siteUrl } from '@/lib/env';

/**
 * The single public entry point of the whole app. It is dynamic, never cached
 * and never indexed, and it renders the profile only after the grant cookie has
 * been re-validated against the database on this very request.
 */
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const parsed = slugSchema.safeParse(slug);
  const title = 'Private Identity';
  const description = 'Securely shared contact';
  const path = `/p/${encodeURIComponent(parsed.success ? parsed.data : slug)}`;
  const sharedMetadata = createShareMetadata({
    title,
    description,
    path,
    robots: { index: false, follow: false, nocache: true },
  });

  return {
    ...sharedMetadata,
    title: { absolute: title },
    description,
    openGraph: {
      type: 'website',
      title,
      description,
      url: new URL(path, `${siteUrl}/`).toString(),
      siteName: 'Private Identity',
      locale: 'en_US',
      images: [{ url: '/logo.png', width: 512, height: 512, alt: 'Private Identity' }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['/logo.png'],
    },
  };
}

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
  after(async () => {
    await recordVisitorView({
      slug: parsed.data,
      grantId: granted.grantId,
      ipHash: hashIp(clientIpFromHeaders(headerList)),
      userAgent: truncateUserAgent(headerList.get('user-agent')),
    });
  });

  const photoUrl = visitorPhotoUrl(parsed.data, granted.profile.photo_path);
  return <GrantedProfileView slug={parsed.data} profile={granted.profile} photoUrl={photoUrl} />;
}
