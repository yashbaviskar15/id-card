'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServiceClient } from '@/lib/db/service';
import { setVisitorSession } from '@/lib/access/visitor';
import { clientIpFromHeaders, hashIp, truncateUserAgent } from '@/lib/crypto/ip';
import { buildAccessCodeProof } from '@/lib/crypto/proofs';
import { accessCodeSchema, slugSchema } from '@/lib/validation';
import { isLocked, RATE_LIMITS } from '@/lib/rate-limit';
import { alertAccessGateLockout, alertGrantUsed } from '@/lib/mail';
import { writeAudit } from '@/lib/audit';
import { log } from '@/lib/log';
import type { ConsumeCodeVerdict } from '@/lib/types';
import type { FormState } from '@/app/(auth)/form-state';

/**
 * Wrong, expired, used and revoked codes all produce this one message, so the
 * screen never reveals which of those happened.
 */
const INVALID_CODE = 'That code is not valid. Ask the owner for a new one.';
const RATE_LIMITED = 'Too many attempts from this device. Wait a few minutes and try again.';
const LOCKED = 'Too many attempts. Access is paused. Ask the owner for a new code.';

export async function submitAccessCodeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const slugRaw = String(formData.get('slug') ?? '').trim().toLowerCase();
  const slugParsed = slugSchema.safeParse(slugRaw);
  if (!slugParsed.success) return { ok: false, error: INVALID_CODE };
  const slug = slugParsed.data;

  const codeRaw = String(formData.get('code') ?? '');
  const codeClean = codeRaw.replace(/\D/g, ''); // Remove all non-digits
  const codeParsed = accessCodeSchema.safeParse(codeClean);
  if (!codeParsed.success) return { ok: false, error: INVALID_CODE };

  const headerList = await headers();
  const ipHash = hashIp(clientIpFromHeaders(headerList));
  const userAgent = truncateUserAgent(headerList.get('user-agent'));

  // If a lockout is already in force the attempt is short-circuited and no new
  // alert is raised — the owner gets exactly one mail per lockout.
  const alreadyLocked = await isLocked('slug', slug);

  const supabase = createServiceClient();
  const proof = buildAccessCodeProof(slug, codeParsed.data);

  const { data, error } = await supabase.rpc('consume_access_code', {
    p_slug: slug,
    p_code_hash: proof,
    p_ip_hash: ipHash,
    p_user_agent: userAgent,
  });

  if (error) {
    log.warn('access.consume failed', { slug, code: error.code, message: error.message });
    return {
      ok: false,
      error: 'Could not verify the code right now. Ask the owner to check the verification service and issue a new code.',
    };
  }

  const verdict = data as ConsumeCodeVerdict;

  if (!verdict.ok) {
    log.warn('access.consume verdict not ok', { slug, reason: verdict.reason });
    if (verdict.reason === 'locked') {
      if (!alreadyLocked) {
        // The lockout has just tripped: the database has already revoked every
        // outstanding code, so tell the owner right away.
        await alertAccessGateLockout({
          slugSuffix: slug.slice(-6),
          attempts: RATE_LIMITS.codeSlugLockoutAfter,
        });
        const owner = await ownerIdForSlug(slug);
        if (owner) {
          await writeAudit({
            ownerId: owner,
            actor: 'system',
            action: 'access.lockout',
            entityType: 'profile',
            detail: { reason: 'wrong_code_threshold', window_minutes: RATE_LIMITS.codeSlugLockoutMinutes },
            ipHash,
            userAgent,
          });
        }
      }
      return { ok: false, error: LOCKED };
    }
    if (verdict.reason === 'rate_limited') return { ok: false, error: RATE_LIMITED };
    return { ok: false, error: INVALID_CODE };
  }

  if (!verdict.grant_id || !verdict.session_expires_at) {
    return { ok: false, error: INVALID_CODE };
  }

  const seconds = (Date.parse(verdict.session_expires_at) - Date.now()) / 1000;
  await setVisitorSession({ grantId: verdict.grant_id, slug }, seconds);

  const owner = await ownerIdForSlug(slug);
  if (owner) {
    await writeAudit({
      ownerId: owner,
      actor: 'visitor',
      action: 'access.grant_used',
      entityType: 'access_grant',
      entityId: verdict.grant_id,
      detail: { scope: verdict.scope },
      ipHash,
      userAgent,
    });
    if (verdict.scope) await notifyGrantUsed(owner, slug, verdict.scope);
  }

  redirect(`/p/${slug}`);
}

/**
 * M-6 — tells the owner the moment a visitor uses a code, unless the alert is
 * switched off. Best-effort: it runs after the session is issued and can never
 * block the visitor's redirect.
 */
async function notifyGrantUsed(
  ownerId: string,
  slug: string,
  scope: 'contact' | 'full',
): Promise<void> {
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from('owner_settings')
      .select('alert_on_access')
      .eq('owner_id', ownerId)
      .maybeSingle<{ alert_on_access: boolean }>();
    if (data?.alert_on_access ?? true) {
      await alertGrantUsed({ slugSuffix: slug.slice(-6), scope });
    }
  } catch {
    // Alerts must never break the visitor's redirect.
  }
}

async function ownerIdForSlug(slug: string): Promise<string | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('profiles')
    .select('owner_id')
    .eq('slug', slug)
    .maybeSingle<{ owner_id: string }>();
  return data?.owner_id ?? null;
}
