import { requireOwner } from '@/lib/auth/session';
import { createUserClient } from '@/lib/db/user';
import { createServiceClient } from '@/lib/db/service';
import { getProfile } from '@/lib/card/load';
import { qrPayload } from '@/lib/qr/payload';
import { CopyableLink } from '../card/copyable-link';
import { log } from '@/lib/log';
import { PhotosClient, type DashboardPhoto } from './photos-client';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Private photos' };

interface PhotoRow {
  id: string;
  name: string;
  size: number;
  created_at: string;
}

export default async function PrivatePhotosPage() {
  const owner = await requireOwner('/dashboard/photos');
  const supabase = await createUserClient();

  const [photosResult, profile] = await Promise.all([
    supabase
      .from('private_photos')
      .select('id, name, size, created_at')
      .eq('owner_id', owner.id)
      .order('created_at', { ascending: false })
      .returns<PhotoRow[]>(),
    getProfile(owner.id),
  ]);
  if (photosResult.error) {
    log.warn('photos.list read failed', { code: photosResult.error.code });
  }

  // owner_secrets has no RLS policy: it is readable only with the server role.
  const { data: secrets, error: secretsError } = await createServiceClient()
    .from('owner_secrets')
    .select('photo_password_set_at, private_photos_enabled')
    .eq('owner_id', owner.id)
    .maybeSingle<{ photo_password_set_at: string | null; private_photos_enabled: boolean }>();
  if (secretsError) {
    log.warn('photos.secrets read failed', { code: secretsError.code });
  }

  const photos: DashboardPhoto[] = (photosResult.data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    size: row.size,
    created_at: row.created_at,
  }));

  return (
    <div className="w-full min-w-0 space-y-5 lg:space-y-6">
      <header className="min-w-0">
        <h1 className="page-title">Private photos</h1>
        <p className="mt-1 max-w-prose text-sm text-label">
          An encrypted album reachable from your existing profile link. Visitors pick &ldquo;Private photos&rdquo;,
          then enter a one-time access code AND your album password. Photos are view-only, encrypted at rest and
          never downloadable.
        </p>
      </header>

      {profile ? (
        <section className="surface shadow-card min-w-0 p-5 sm:p-6">
          <h2 className="text-sm font-semibold text-ink">Your public link</h2>
          <CopyableLink value={qrPayload(profile.slug)} />
          <p className="mt-3 text-xs leading-5 text-label">
            The same link opens both the contact profile and this photo album.
          </p>
        </section>
      ) : null}

      <PhotosClient
        photos={photos}
        enabled={Boolean(secrets?.private_photos_enabled)}
        passwordSet={Boolean(secrets?.photo_password_set_at)}
        loadFailed={Boolean(photosResult.error)}
      />
    </div>
  );
}
