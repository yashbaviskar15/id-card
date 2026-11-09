import 'server-only';
import { z } from 'zod';
import { createUserClient } from '@/lib/db/user';
import { createServiceClient } from '@/lib/db/service';
import { hashToken } from '@/lib/crypto/proofs';
import { log } from '@/lib/log';
import type { ShareLinkRow } from '@/lib/types';

/**
 * Share-link reads.
 *
 * Owner reads go through the owner-scoped client so Row Level Security applies:
 * a link that belongs to another owner simply returns nothing. The visitor
 * resolution is the one exception — the token hash is itself the secret, so it
 * is looked up with the service client (matching the access-code gate).
 */

/** A share token is 32 random bytes, base64url; nothing else can ever match. */
export const shareTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{20,120}$/, 'Invalid link.');

export type ShareLinkStatus = 'active' | 'expired' | 'revoked' | 'exhausted';

export interface OwnerDocumentOption {
  id: string;
  name: string;
}

export interface OwnerShareLink {
  id: string;
  document_name: string;
  created_at: string;
  expires_at: string;
  download_count: number;
  max_downloads: number | null;
  has_password: boolean;
  revoked_at: string | null;
  status: ShareLinkStatus;
}

/** Active share-link data used only on the server; rendered pages expose no storage path or token. */
export interface ShareLinkTarget {
  ownerId: string;
  name: string;
  mime: string;
  size: number;
  storagePath: string;
  requiresPassword: boolean;
}

function shareLinkStatus(row: Pick<ShareLinkRow, 'revoked_at' | 'expires_at' | 'max_downloads' | 'download_count'>, now: number): ShareLinkStatus {
  if (row.revoked_at) return 'revoked';
  if (Date.parse(row.expires_at) <= now) return 'expired';
  if (row.max_downloads !== null && row.download_count >= row.max_downloads) return 'exhausted';
  return 'active';
}

export async function loadOwnerShareLinks(ownerId: string): Promise<OwnerShareLink[]> {
  const supabase = await createUserClient();
  const { data, error } = await supabase
    .from('share_links')
    .select(
      'id, created_at, expires_at, download_count, max_downloads, revoked_at, password_hash, documents!share_links_document_owner_fkey(name)',
    )
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false });

  if (error) {
    log.warn('share.links failed', { code: error.code });
    return [];
  }

  type Joined = Pick<
    ShareLinkRow,
    'id' | 'created_at' | 'expires_at' | 'download_count' | 'max_downloads' | 'revoked_at' | 'password_hash'
  > & { documents: { name: string } | null };

  const now = Date.now();
  return ((data ?? []) as unknown as Joined[]).map((row) => ({
    id: row.id,
    document_name: row.documents?.name ?? 'Deleted document',
    created_at: row.created_at,
    expires_at: row.expires_at,
    download_count: row.download_count,
    max_downloads: row.max_downloads,
    has_password: row.password_hash !== null,
    revoked_at: row.revoked_at,
    status: shareLinkStatus(row, now),
  }));
}

export async function loadOwnerDocuments(ownerId: string): Promise<OwnerDocumentOption[]> {
  const supabase = await createUserClient();
  const { data, error } = await supabase
    .from('documents')
    .select('id, name')
    .eq('owner_id', ownerId)
    .order('name', { ascending: true });

  if (error) {
    log.warn('share.documents failed', { code: error.code });
    return [];
  }
  return (data ?? []) as OwnerDocumentOption[];
}

/**
 * Resolves a token to its document target, without consuming a download. Returns
 * null for a link that is missing, revoked, expired or exhausted — the caller
 * renders one identical "not available" state for all of them, so the screen
 * never reveals which one happened.
 */
export async function resolveShareLink(token: string): Promise<ShareLinkTarget | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('share_links')
    .select(
      'owner_id, password_hash, expires_at, max_downloads, download_count, revoked_at, documents!share_links_document_owner_fkey(owner_id, name, mime, size, storage_path)',
    )
    .eq('token_hash', hashToken(token))
    .maybeSingle();

  if (error) {
    log.warn('share.resolve failed', { code: error.code });
    return null;
  }
  if (!data) return null;

  type Joined = Pick<
    ShareLinkRow,
    'owner_id' | 'password_hash' | 'expires_at' | 'max_downloads' | 'download_count' | 'revoked_at'
  > & {
    documents: { owner_id: string; name: string; mime: string; size: number; storage_path: string } | null;
  };

  const row = data as unknown as Joined;
  if (shareLinkStatus(row, Date.now()) !== 'active') return null;
  if (!row.documents || row.documents.owner_id !== row.owner_id) return null;

  return {
    ownerId: row.owner_id,
    name: row.documents.name,
    mime: row.documents.mime,
    size: Number(row.documents.size),
    storagePath: row.documents.storage_path,
    requiresPassword: row.password_hash !== null,
  };
}
