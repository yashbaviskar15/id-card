import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { loadGrantedPhotos } from '@/lib/access/visitor';
import { slugSchema } from '@/lib/validation';
import { PhotoAlbumView } from './photo-album-view';

/**
 * The private photo album behind the same public link. It is only reachable
 * once the visitor has presented BOTH a valid one-time code and the owner's
 * album password; without that album cookie the visitor is returned to the
 * choice screen. Every request re-validates the grant against the database.
 */
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Private photos',
  robots: { index: false, follow: false, nocache: true },
};

export default async function PrivatePhotosPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const parsed = slugSchema.safeParse(slug);
  if (!parsed.success) redirect('/');

  const album = await loadGrantedPhotos(parsed.data);
  if (!album) redirect(`/p/${encodeURIComponent(parsed.data)}`);

  return <PhotoAlbumView slug={parsed.data} album={album} />;
}
