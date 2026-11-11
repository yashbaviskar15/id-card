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
import { effectiveQuickPresets, parseQuickPresets, quickPresetSchema, MAX_QUICK_PRESETS } from '@/lib/access/presets';
import { isReauthenticated } from '@/lib/auth/reauth';
import { guardOwnerAction } from '@/lib/rate-limit';
import { requireOwner } from '@/lib/auth/session';
import { writeAudit } from '@/lib/audit';
import { log } from '@/lib/log';
import type { AccessScope } from '@/lib/types';
import type { GrantFormState } from './form-state';

async function requestContext() {
  const h = await headers();
  return { ipHash: hashIp(clientIpFromHeaders(h)), userAgent: truncateUserAgent(h.get('user-agent')) };
}

type UserClient = Awaited<ReturnType<typeof createUserClient>>;

type DraftResult =
  | { ok: true; scope: AccessScope; validityMinutes: number; includeDocuments: boolean }
  | { ok: false; error: string };

/**
 * Resolves what a new code should carry. A `preset_id` (a one-click quick
 * preset) wins over the form fields; otherwise the submitted scope/validity are
 * used. Presets live on owner_settings and are validated on read.
 */
async function resolveGrantDraft(supabase: UserClient, ownerId: string, formData: FormData): Promise<DraftResult> {
  const presetId = formData.get('preset_id');
  if (typeof presetId === 'string' && presetId.length > 0) {
    const { data } = await supabase
      .from('owner_settings')
      .select('quick_presets')
      .eq('owner_id', ownerId)
      .maybeSingle<{ quick_presets: unknown }>();
    const preset = effectiveQuickPresets(data?.quick_presets).find((p) => p.id === presetId);
    if (!preset) return { ok: false, error: 'That quick preset no longer exists. Refresh and try again.' };
    return {
      ok: true,
      scope: preset.scope,
      validityMinutes: preset.validity_minutes,
      includeDocuments: preset.include_documents,
    };
  }

  const scopeParsed = scopeSchema.safeParse(formData.get('scope'));
  const validityParsed = validityMinutesSchema.safeParse(formData.get('validity_minutes'));
  const includeDocuments = includeDocumentsSchema.safeParse(formData.get('include_documents'));
  if (!scopeParsed.success || !validityParsed.success) {
    return { ok: false, error: 'Choose a scope and a validity between 1 and 30 minutes.' };
  }
  return {
    ok: true,
    scope: scopeParsed.data,
    validityMinutes: validityParsed.data,
    includeDocuments: includeDocuments.success && includeDocuments.data,
  };
}

/**
 * Issues one single-use code. The code is generated here with a CSPRNG and only
 * its slug-bound HMAC is written to the database — the plaintext is returned to
 * the owner's screen once and never stored, logged or audited.
 */
export async function createGrantAction(_prev: GrantFormState, formData: FormData): Promise<GrantFormState> {
  const owner = await requireOwner('/dashboard/access');

  const throttle = await guardOwnerAction(owner.id, 'access.grant_create');
  if (!throttle.allowed) {
    return {
      ok: false,
      error: `You have created many codes just now. Try again in ${throttle.retryAfterMinutes} minutes.`,
    };
  }

  try {
    if (!(await isReauthenticated())) {
      return { ok: false, error: 'Enter your password again before handing out a code.' };
    }

    const supabase = await createUserClient();
    const draft = await resolveGrantDraft(supabase, owner.id, formData);
    if (!draft.ok) return { ok: false, error: draft.error };
    const scope = draft.scope;
    const validityMinutes = draft.validityMinutes;
    const withDocuments = draft.includeDocuments;

    const profile = await getProfile(owner.id);
    if (!profile) {
      return { ok: false, error: 'Save your card first, then hand out a code.' };
    }
    if (!profile.is_active) {
      return { ok: false, error: 'Your profile is switched off, so no code could work. Switch it back on in Card & QR.' };
    }

    const expiresAt = new Date(Date.now() + validityMinutes * 60_000).toISOString();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = generateAccessCode();
      const codeHash = buildAccessCodeProof(profile.slug, code);

      const { data, error } = await supabase
        .from('access_grants')
        .insert({
          owner_id: owner.id,
          code_hash: codeHash,
          scope,
          include_documents: withDocuments,
          expires_at: expiresAt,
          session_duration_minutes: validityMinutes,
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
          detail: { scope, validity_minutes: validityMinutes, include_documents: withDocuments },
          ipHash,
          userAgent,
        });
        // Remember these choices as the starting point for the next code.
        await supabase
          .from('owner_settings')
          .update({
            last_scope: scope,
            last_validity_minutes: validityMinutes,
            last_include_documents: withDocuments,
          })
          .eq('owner_id', owner.id);
        revalidatePath('/dashboard/access');
        return {
          ok: true,
          code,
          grantId: data.id,
          expiresAt: data.expires_at,
          scope,
        };
      }

      // The only expected unique violation is a code collision; retry with a new one.
      if (error?.code !== '23505') {
        log.warn('access.grant create failed', { code: error?.code });
        const missingSchema = ['42P01', '42703', 'PGRST204', 'PGRST205'].includes(error?.code ?? '');
        return {
          ok: false,
          error: missingSchema
            ? 'Access-code database migrations are missing. Apply migrations 0001–0010 from SETUP.md.'
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

/** Adds or replaces one quick-access preset (one-click code). */
export async function saveQuickPresetAction(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const owner = await requireOwner('/dashboard/access');
  if (!(await isReauthenticated())) {
    return { ok: false, error: 'Enter your password again before changing presets.' };
  }

  const parsed = quickPresetSchema.safeParse({
    id: (formData.get('id') as string | null) || crypto.randomUUID(),
    label: formData.get('label'),
    scope: formData.get('scope'),
    validity_minutes: formData.get('validity_minutes'),
    include_documents: formData.get('include_documents'),
  });
  if (!parsed.success) {
    return { ok: false, error: 'Give the preset a name, a scope and a validity between 1 and 30 minutes.' };
  }

  const supabase = await createUserClient();
  const { data, error } = await supabase
    .from('owner_settings')
    .select('quick_presets')
    .eq('owner_id', owner.id)
    .maybeSingle<{ quick_presets: unknown }>();
  if (error) return { ok: false, error: 'Could not load your presets. Try again.' };

  const next = [...parseQuickPresets(data?.quick_presets).filter((p) => p.id !== parsed.data.id), parsed.data];
  if (next.length > MAX_QUICK_PRESETS) {
    return { ok: false, error: `You can keep up to ${MAX_QUICK_PRESETS} presets. Remove one first.` };
  }

  const { error: updateError } = await supabase
    .from('owner_settings')
    .update({ quick_presets: next })
    .eq('owner_id', owner.id);
  if (updateError) {
    log.warn('access.preset save failed', { code: updateError.code });
    return { ok: false, error: 'Could not save the preset. Try again.' };
  }

  revalidatePath('/dashboard/access');
  return { ok: true };
}

/** Removes one quick-access preset. */
export async function deleteQuickPresetAction(
  presetId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const owner = await requireOwner('/dashboard/access');
  if (!(await isReauthenticated())) {
    return { ok: false, error: 'Enter your password again before changing presets.' };
  }
  if (typeof presetId !== 'string' || presetId.length === 0 || presetId.length > 40) {
    return { ok: false, error: 'That preset no longer exists.' };
  }

  const supabase = await createUserClient();
  const { data, error } = await supabase
    .from('owner_settings')
    .select('quick_presets')
    .eq('owner_id', owner.id)
    .maybeSingle<{ quick_presets: unknown }>();
  if (error) return { ok: false, error: 'Could not load your presets. Try again.' };

  const next = parseQuickPresets(data?.quick_presets).filter((p) => p.id !== presetId);
  const { error: updateError } = await supabase
    .from('owner_settings')
    .update({ quick_presets: next })
    .eq('owner_id', owner.id);
  if (updateError) {
    log.warn('access.preset delete failed', { code: updateError.code });
    return { ok: false, error: 'Could not remove the preset. Try again.' };
  }

  revalidatePath('/dashboard/access');
  return { ok: true };
}
