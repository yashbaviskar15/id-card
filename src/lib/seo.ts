import type { Metadata } from 'next';
import { siteUrl } from '@/lib/env';

export const SITE_NAME = 'Private Identity';
export const DEFAULT_PAGE_DESCRIPTION =
  'Private identity cards and secure file sharing, protected by owner-issued access.';
export const SOCIAL_IMAGE_PATH = '/og/private-identity.jpg';
export const SOCIAL_IMAGE_URL = new URL(SOCIAL_IMAGE_PATH, `${siteUrl}/`).toString();

type ShareMetadataOptions = {
  title: string;
  description: string;
  path?: string;
  robots?: Metadata['robots'];
};

/** Builds crawler-readable metadata without including private profile or file data. */
export function createShareMetadata({
  title,
  description,
  path,
  robots,
}: ShareMetadataOptions): Metadata {
  const pageUrl = path ? new URL(path, `${siteUrl}/`).toString() : undefined;

  return {
    title,
    description,
    ...(pageUrl ? { alternates: { canonical: pageUrl } } : {}),
    ...(robots ? { robots } : {}),
    openGraph: {
      type: 'website',
      title,
      description,
      ...(pageUrl ? { url: pageUrl } : {}),
      siteName: SITE_NAME,
      locale: 'en_US',
      images: [
        {
          url: SOCIAL_IMAGE_URL,
          width: 1200,
          height: 630,
          alt: 'Private Identity, private by design',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [
        {
          url: SOCIAL_IMAGE_URL,
          alt: 'Private Identity, private by design',
        },
      ],
    },
  };
}
