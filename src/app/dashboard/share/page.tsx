import { requireOwner } from '@/lib/auth/session';
import { isReauthenticated } from '@/lib/auth/reauth';
import { ReauthPanel } from '@/components/auth/reauth-panel';
import { createUserClient } from '@/lib/db/user';
import { loadOwnerDocuments, loadOwnerShareLinks } from '@/lib/share/load';
import { MAX_BULK_SHARE_DOCUMENTS } from '@/lib/validation';
import { ShareCreator, ShareLinks, type ShareLinkItem } from './share-client';

export const dynamic = 'force-dynamic';

export default async function SharePage() {
  const owner = await requireOwner('/dashboard/share');
  const [reauthenticated, links, documents, supabase] = await Promise.all([
    isReauthenticated(owner.id),
    loadOwnerShareLinks(owner.id),
    loadOwnerDocuments(owner.id),
    createUserClient(),
  ]);

  const { data: settings } = await supabase
    .from('owner_settings')
    .select('share_default_expiry_minutes, share_default_max_downloads')
    .eq('owner_id', owner.id)
    .maybeSingle<{ share_default_expiry_minutes: number; share_default_max_downloads: number | null }>();

  const items: ShareLinkItem[] = links.map((link) => ({
    id: link.id,
    document_name: link.document_name,
    created_at: link.created_at,
    expires_at: link.expires_at,
    download_count: link.download_count,
    max_downloads: link.max_downloads,
    has_password: link.has_password,
    status: link.status,
  }));

  return (
    <div className="space-y-6 lg:space-y-8">
      <header>
        <h1 className="page-title">Share links</h1>
        <p className="mt-1 max-w-2xl text-sm text-label">
          Share one or more documents with private, expiring links — with an optional password and download limit.
          Links can be revoked at any time.
        </p>
      </header>

      {reauthenticated ? (
        <ShareCreator
          documents={documents}
          defaultExpiryMinutes={settings?.share_default_expiry_minutes ?? 1440}
          defaultMaxDownloads={settings?.share_default_max_downloads ?? null}
          maxDocuments={MAX_BULK_SHARE_DOCUMENTS}
        />
      ) : (
        <ReauthPanel action="create a share link" />
      )}

      <ShareLinks links={items} />
    </div>
  );
}
