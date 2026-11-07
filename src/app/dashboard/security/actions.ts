'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { requireOwner } from '@/lib/auth/session';
import { isReauthenticated } from '@/lib/auth/reauth';
import { createUserClient } from '@/lib/db/user';
import { clientIpFromHeaders, hashIp, truncateUserAgent } from '@/lib/crypto/ip';
import { writeAudit } from '@/lib/audit';
import { log } from '@/lib/log';

export async function revokeAllAccessAction(): Promise<
  { ok: true; count: number } | { ok: false; error: string }
> {
  const owner = await requireOwner('/dashboard/security');
  if (!(await isReauthenticated(owner.id))) {
    return { ok: false, error: 'Confirm your password in Access before revoking all codes.' };
  }

  const supabase = await createUserClient();
  const { data, error } = await supabase
    .from('access_grants')
    .update({ revoked_at: new Date().toISOString() })
    .eq('owner_id', owner.id)
    .is('revoked_at', null)
    .select('id');

  if (error) {
    log.warn('security.revoke_all failed', { code: error.code });
    return { ok: false, error: 'Could not revoke access codes. Try again.' };
  }

  const requestHeaders = await headers();
  await writeAudit({
    ownerId: owner.id,
    actor: 'owner',
    action: 'security.revoke_all_access',
    detail: { revoked_count: data?.length ?? 0 },
    ipHash: hashIp(clientIpFromHeaders(requestHeaders)),
    userAgent: truncateUserAgent(requestHeaders.get('user-agent')),
  });

  revalidatePath('/dashboard/security');
  revalidatePath('/dashboard/access');
  return { ok: true, count: data?.length ?? 0 };
}
