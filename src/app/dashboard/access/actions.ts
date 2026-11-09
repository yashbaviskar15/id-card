'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { z } from 'zod';
import { createUserClient } from '@/lib/db/user';
import { getProfile } from '@/lib/card/load';
import { generateAccessCode } from '@/lib/crypto/random';
import { buildAccessCodeProof } from '@/lib/crypto/proofs';
import { clientIpFromHeaders, hashIp, truncateUserAgent } from '@/lib/crypto/ip';
import { scopeSchema, validityMinutesSchema, includeDocumentsSchema } from '@/lib/validation';
import { isReauthenticated } from '@/lib/auth/reauth';
import { requireOwner } from '@/lib/auth/session';
import { writeAudit } from '@/lib/audit';
import { log } from '@/lib/log';
import type { GrantFormState } from './form-state';

async function requestContext() {
  const h = await headers();
  return { ipHash: hashIp(clientIpFromHeaders(h)), userAgent: truncateUserAgent(h.get('user-agent')) };
}

/**
 * Issues one single-use code. The code is generated here with a CSPRNG and only
 * its slug-bound HMAC is written to the database — the plaintext is returned to
 * the owner's screen once and never stored, logged or audited.
 */
export async function createGrantAction(_prev: GrantFormState, formData: FormData): Promise<GrantFormState> {
  const owner = await requireOwner('/dashboard/access');

  try {
    if (!(await isReauthenticated())) {
      return { ok: false, error: 'Enter your password again before handing out a code.' };
    }

    const scopeParsed = scopeSchema.safeParse(formData.get('scope'));
    const validityParsed = validityMinutesSchema.safeParse(formData.get('validity_minutes'));
    const includeDocuments = includeDocumentsSchema.safeParse(formData.get('include_documents'));
    if (!scopeParsed.success || !validityParsed.success) {
      return { ok: false, error: 'Choose a scope and a validity between 1 and 30 minutes.' };
    }
    const withDocuments = includeDocuments.success && includeDocuments.data;

    const profile = await getProfile(owner.id);
    if (!profile) {
      return { ok: false, error: 'Save your card first, then hand out a code.' };
    }
    if (!profile.is_active) {
      return { ok: false, error: 'Your profile is switched off, so no code could work. Switch it back on in Card & QR.' };
    }

    const expiresAt = new Date(Date.now() + validityParsed.data * 60_000).toISOString();
    const supabase = await createUserClient();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = generateAccessCode();
      const codeHash = buildAccessCodeProof(profile.slug, code);

      const { data, error } = await supabase
        .from('access_grants')
        .insert({
          owner_id: owner.id,
          code_hash: codeHash,
          scope: scopeParsed.data,
          include_documents: withDocuments,
          expires_at: expiresAt,
        })
        .select('id, expires_at')
        .single<{ id: string; expires_at: string }>();

      if (!error && data) {
        const { ipHash, userAgent } = await requestContext();
        await writeAudit({
          ownerId: owner.id,
          actor: 'owner',
          action: 'access.grant_create',
          entityType: 'access_grant',
          entityId: data.id,
          detail: { scope: scopeParsed.data, validity_minutes: validityParsed.data, include_documents: withDocuments },
          ipHash,
          userAgent,
        });
        return {
          ok: true,
          code,
          grantId: data.id,
          expiresAt: data.expires_at,
          scope: scopeParsed.data,
        };
      }

      // The only expected unique violation is a code collision; retry with a new one.
      if (error?.code !== '23505') {
        log.warn('access.grant create failed', { code: error?.code });
        const missingSchema = ['42P01', '42703', 'PGRST204', 'PGRST205'].includes(error?.code ?? '');
        return {
          ok: false,
          error: missingSchema
            ? 'Access-code database migrations are missing. Apply migrations 0001–0007 from SETUP.md.'
            : 'Could not create the code. Check the connection and try again.',
        };
      }
    }

    return { ok: false, error: 'Could not create the code. Try again.' };
  } catch (cause) {
    const missingConfiguration = cause instanceof Error && cause.message.startsWith('Invalid server environment');
    log.warn('access.grant create threw', { category: missingConfiguration ? 'configuration' : 'unexpected' });
    return {
      ok: false,
      error: missingConfiguration
        ? 'Access-code creation is not configured on the server. Verify the required variables in SETUP.md and redeploy.'
        : 'The request could not be completed. Check your connection and Access History before retrying.',
    };
  }
}

/**
 * Ends a grant immediately. The visitor's next request fails the database check,
 * so a live session stops working at once — no waiting for the cookie to expire.
 */
export async function revokeGrantAction(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const owner = await requireOwner('/dashboard/access');
  const parsed = z.uuid().safeParse(formData.get('grant_id'));
  if (!parsed.success) return { ok: false, error: 'That access code no longer exists.' };

  const supabase = await createUserClient();
  const { error } = await supabase
    .from('access_grants')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', parsed.data)
    .eq('owner_id', owner.id)
    .is('revoked_at', null);
  if (error) {
    log.warn('access.grant revoke failed', { code: error.code });
    return { ok: false, error: 'Could not revoke the code. Check your connection and try again.' };
  }

  const { ipHash, userAgent } = await requestContext();
  await writeAudit({
    ownerId: owner.id,
    actor: 'owner',
    action: 'access.grant_revoke',
    entityType: 'access_grant',
    entityId: parsed.data,
    ipHash,
    userAgent,
  });

  revalidatePath('/dashboard/access');
  return { ok: true };
}
