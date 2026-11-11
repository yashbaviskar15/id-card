'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { z } from 'zod';
import { requireOwner } from '@/lib/auth/session';
import { isReauthenticated } from '@/lib/auth/reauth';
import { guardOwnerAction } from '@/lib/rate-limit';
import { createUserClient } from '@/lib/db/user';
import { generateShareToken } from '@/lib/crypto/random';
import { hashToken } from '@/lib/crypto/proofs';
import { hashPassword } from '@/lib/crypto/password';
import { clientIpFromHeaders, hashIp, truncateUserAgent } from '@/lib/crypto/ip';
import { passwordSchema, shareLinkBulkInputSchema } from '@/lib/validation';
import { siteUrl } from '@/lib/env';
import { writeAudit } from '@/lib/audit';
import { log } from '@/lib/log';
import type { CreatedShareLink, ShareState } from './form-state';

async function requestContext() {
  const h = await headers();
  return { ipHash: hashIp(clientIpFromHeaders(h)), userAgent: truncateUserAgent(h.get('user-agent')) };
}

/**
 * Creates one share link per selected document in a single request.
 *
 * Each token is generated here with a CSPRNG; only its HMAC (hashToken) is
 * written to the database. The full URLs are returned to the owner's screen
 * once and can never be rebuilt afterwards, so a lost link must be re-created.
 * The expiry and optional download cap are remembered as the owner's defaults.
 */
export async function createShareLinkAction(_prev: ShareState, formData: FormData): Promise<ShareState> {
  const owner = await requireOwner('/dashboard/share');

  const throttle = await guardOwnerAction(owner.id, 'share.link_create');
  if (!throttle.allowed) {
    return {
      ok: false,
      error: `You have created many links just now. Try again in ${throttle.retryAfterMinutes} minutes.`,
    };
  }

  try {
  if (!(await isReauthenticated(owner.id))) {
    return { ok: false, error: 'Enter your password again before creating a share link.' };
  }

  const maxRaw = formData.get('max_downloads');
  const parsed = shareLinkBulkInputSchema.safeParse({
    document_ids: formData.getAll('document_ids').map((value) => String(value)),
    expires_in_minutes: formData.get('expires_in_minutes'),
    password: formData.get('password') ?? '',
    max_downloads: maxRaw ? maxRaw : undefined,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message
        ?? 'Choose a document and an expiry between 5 minutes and 30 days.',
    };
  }

  const password = parsed.data.password ?? '';
  if (password) {
    const passwordParsed = passwordSchema.safeParse(password);
    if (!passwordParsed.success) {
      return { ok: false, error: 'The password must be at least 12 characters and not easy to guess.' };
    }
  }

  // The owner-scoped client applies RLS, so any document id belonging to another
  // owner can never match.
  const supabase = await createUserClient();
  const { data: documentRows } = await supabase
    .from('documents')
    .select('id, name')
    .in('id', parsed.data.document_ids)
    .eq('owner_id', owner.id);
  const namesById = new Map(
    ((documentRows ?? []) as { id: string; name: string }[]).map((row) => [row.id, row.name]),
  );
  if (namesById.size === 0) {
    return { ok: false, error: 'Those documents no longer exist.' };
  }

  const passwordHash = password ? await hashPassword(password) : null;
  const expiresAt = new Date(Date.now() + parsed.data.expires_in_minutes * 60_000).toISOString();

  const links: CreatedShareLink[] = [];
  const skipped: string[] = [];

  for (const documentId of parsed.data.document_ids) {
    const name = namesById.get(documentId);
    if (!name) continue;

    let created: { id: string; token: string; expiresAt: string } | null = null;
    for (let attempt = 0; attempt < 5 && !created; attempt += 1) {
      const token = generateShareToken();
      const { data, error } = await supabase
        .from('share_links')
        .insert({
          owner_id: owner.id,
          document_id: documentId,
          token_hash: hashToken(token),
          password_hash: passwordHash,
          expires_at: expiresAt,
          max_downloads: parsed.data.max_downloads ?? null,
        })
        .select('id, expires_at')
        .single<{ id: string; expires_at: string }>();

      if (!error && data) {
        created = { id: data.id, token, expiresAt: data.expires_at };
        break;
      }
      // The only expected unique violation is a token collision; retry with a new one.
      if (error?.code !== '23505') {
        log.warn('share.link_create failed', { code: error?.code });
        const missingSchema = ['42P01', '42703', 'PGRST204', 'PGRST205'].includes(error?.code ?? '');
        if (missingSchema) {
          return { ok: false, error: 'Share-link database migrations are missing. Apply migrations 0001–0010 from SETUP.md.' };
        }
        break;
      }
    }

    if (created) {
      links.push({
        url: `${siteUrl}/s/${created.token}`,
        shareId: created.id,
        expiresAt: created.expiresAt,
        documentName: name,
      });
    } else {
      skipped.push(name);
    }
  }

  if (links.length === 0) {
    return { ok: false, error: 'Could not create the links. Check the connection and try again.' };
  }

  const { ipHash, userAgent } = await requestContext();
  await writeAudit({
    ownerId: owner.id,
    actor: 'owner',
    action: 'share.link_create',
    entityType: 'share_link',
    entityId: links[0].shareId,
    detail: {
      count: links.length,
      expires_in_minutes: parsed.data.expires_in_minutes,
      has_password: passwordHash !== null,
      max_downloads: parsed.data.max_downloads ?? null,
    },
    ipHash,
    userAgent,
  });

  // Remember these choices as the defaults the next link starts from.
  await supabase
    .from('owner_settings')
    .update({
      share_default_expiry_minutes: parsed.data.expires_in_minutes,
      share_default_max_downloads: parsed.data.max_downloads ?? null,
    })
    .eq('owner_id', owner.id);

  revalidatePath('/dashboard/share');
  return {
    ok: true,
    links,
    message: skipped.length > 0 ? `Created ${links.length}. Could not create for: ${skipped.join(', ')}.` : undefined,
  };
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
