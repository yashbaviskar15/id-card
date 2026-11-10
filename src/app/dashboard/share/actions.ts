'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { z } from 'zod';
import { requireOwner } from '@/lib/auth/session';
import { isReauthenticated } from '@/lib/auth/reauth';
import { createUserClient } from '@/lib/db/user';
import { generateShareToken } from '@/lib/crypto/random';
import { hashToken } from '@/lib/crypto/proofs';
import { hashPassword } from '@/lib/crypto/password';
import { clientIpFromHeaders, hashIp, truncateUserAgent } from '@/lib/crypto/ip';
import { passwordSchema, shareLinkInputSchema } from '@/lib/validation';
import { siteUrl } from '@/lib/env';
import { writeAudit } from '@/lib/audit';
import { log } from '@/lib/log';
import type { ShareState } from './form-state';

async function requestContext() {
  const h = await headers();
  return { ipHash: hashIp(clientIpFromHeaders(h)), userAgent: truncateUserAgent(h.get('user-agent')) };
}

/**
 * Creates one share link for one of the owner's documents.
 *
 * The token is generated here with a CSPRNG; only its HMAC (hashToken) is
 * written to the database. The full URL is returned to the owner's screen once
 * and can never be rebuilt afterwards, so a lost link must be re-created.
 */
export async function createShareLinkAction(_prev: ShareState, formData: FormData): Promise<ShareState> {
  const owner = await requireOwner('/dashboard/share');

  try {
  if (!(await isReauthenticated(owner.id))) {
    return { ok: false, error: 'Enter your password again before creating a share link.' };
  }

  const maxRaw = formData.get('max_downloads');
  const parsed = shareLinkInputSchema.safeParse({
    document_id: formData.get('document_id'),
    expires_in_minutes: formData.get('expires_in_minutes'),
    password: formData.get('password') ?? '',
    max_downloads: maxRaw ? maxRaw : undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: 'Choose a document and an expiry between 5 minutes and 30 days.' };
  }

  const password = parsed.data.password ?? '';
  if (password) {
    const passwordParsed = passwordSchema.safeParse(password);
    if (!passwordParsed.success) {
      return { ok: false, error: 'The password must be at least 12 characters and not easy to guess.' };
    }
  }

  // The owner-scoped client applies RLS, so a document id belonging to another
  // owner can never match.
  const supabase = await createUserClient();
  const { data: document } = await supabase
    .from('documents')
    .select('id, name')
    .eq('id', parsed.data.document_id)
    .eq('owner_id', owner.id)
    .maybeSingle<{ id: string; name: string }>();
  if (!document) {
    return { ok: false, error: 'That document no longer exists.' };
  }

  const passwordHash = password ? await hashPassword(password) : null;
  const expiresAt = new Date(Date.now() + parsed.data.expires_in_minutes * 60_000).toISOString();

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const token = generateShareToken();
    const { data, error } = await supabase
      .from('share_links')
      .insert({
        owner_id: owner.id,
        document_id: document.id,
        token_hash: hashToken(token),
        password_hash: passwordHash,
        expires_at: expiresAt,
        max_downloads: parsed.data.max_downloads ?? null,
      })
      .select('id, expires_at')
      .single<{ id: string; expires_at: string }>();

    if (!error && data) {
      const { ipHash, userAgent } = await requestContext();
      await writeAudit({
        ownerId: owner.id,
        actor: 'owner',
        action: 'share.link_create',
        entityType: 'share_link',
        entityId: data.id,
        detail: {
          document_id: document.id,
          expires_in_minutes: parsed.data.expires_in_minutes,
          has_password: passwordHash !== null,
          max_downloads: parsed.data.max_downloads ?? null,
        },
        ipHash,
        userAgent,
      });
      revalidatePath('/dashboard/share');
      return {
        ok: true,
        url: `${siteUrl}/s/${token}`,
        shareId: data.id,
        expiresAt: data.expires_at,
        documentName: document.name,
      };
    }

    // The only expected unique violation is a token collision; retry with a new one.
    if (error?.code !== '23505') {
      log.warn('share.link_create failed', { code: error?.code });
      const missingSchema = ['42P01', '42703', 'PGRST204', 'PGRST205'].includes(error?.code ?? '');
      return {
        ok: false,
        error: missingSchema
          ? 'Share-link database migrations are missing. Apply migrations 0001–0009 from SETUP.md.'
          : 'Could not create the link. Check the connection and try again.',
      };
    }
  }

  return { ok: false, error: 'Could not create the link. Try again.' };
  } catch (cause) {
    const category = cause instanceof Error && cause.message.startsWith('Invalid server environment')
      ? 'configuration'
      : 'unexpected';
    log.warn('share.link_create threw', { category });
    return {
      ok: false,
      error: category === 'configuration'
        ? 'Share links are not configured on the server. Verify the required variables in SETUP.md and redeploy.'
        : 'The link request could not be completed. Check the connection and your Share Links list before retrying.',
    };
  }
}

/** Ends a share link immediately: the next visitor request fails the DB check. */
export async function revokeShareLinkAction(shareId: string): Promise<ShareState> {
  const owner = await requireOwner('/dashboard/share');
  try {
  const parsed = z.uuid().safeParse(shareId);
  if (!parsed.success) return { ok: false, error: 'That link no longer exists.' };

  const supabase = await createUserClient();
  const { error } = await supabase
    .from('share_links')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', parsed.data)
    .eq('owner_id', owner.id)
    .is('revoked_at', null);

  if (error) {
    log.warn('share.link_revoke failed', { code: error.code });
    return { ok: false, error: 'Could not revoke the link. Try again.' };
  }

  const { ipHash, userAgent } = await requestContext();
  await writeAudit({
    ownerId: owner.id,
    actor: 'owner',
    action: 'share.link_revoke',
    entityType: 'share_link',
    entityId: parsed.data,
    ipHash,
    userAgent,
  });

  revalidatePath('/dashboard/share');
  return { ok: true };
  } catch {
    log.warn('share.link_revoke threw');
    return { ok: false, error: 'The revoke request could not be completed. Refresh the list before retrying.' };
  }
}
