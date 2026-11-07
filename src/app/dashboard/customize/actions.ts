'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { requireOwner } from '@/lib/auth/session';
import { getProfile } from '@/lib/card/load';
import { createUserClient } from '@/lib/db/user';
import { clientIpFromHeaders, hashIp, truncateUserAgent } from '@/lib/crypto/ip';
import { writeAudit } from '@/lib/audit';
import { visitorPresentationSchema } from '@/lib/validation';
import { zodFieldErrors } from '@/lib/result';
import type { FormState } from '@/app/(auth)/form-state';

export async function saveVisitorPresentationAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const owner = await requireOwner('/dashboard/customize');
  const parsed = visitorPresentationSchema.safeParse({
    visitor_theme: formData.get('visitor_theme'),
    visitor_layout: formData.get('visitor_layout'),
    visitor_intro: formData.get('visitor_intro') ?? '',
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: 'Please review your visitor page settings.',
      fieldErrors: zodFieldErrors(
        parsed.error.flatten().fieldErrors as Record<string, string[]>,
      ),
    };
  }

  const profile = await getProfile(owner.id);
  if (!profile) {
    return { ok: false, error: 'Create your identity card before customizing its visitor page.' };
  }

  const supabase = await createUserClient();
  const { error } = await supabase
    .from('profiles')
    .update(parsed.data)
    .eq('owner_id', owner.id);

  if (error) {
    return { ok: false, error: 'Could not save these visitor page settings. Try again.' };
  }

  const requestHeaders = await headers();
  await writeAudit({
    ownerId: owner.id,
    actor: 'owner',
    action: 'profile.presentation_update',
    entityType: 'profile',
    entityId: profile.id,
    detail: {
      visitor_theme: parsed.data.visitor_theme,
      visitor_layout: parsed.data.visitor_layout,
      visitor_intro_length: parsed.data.visitor_intro.length,
    },
    ipHash: hashIp(clientIpFromHeaders(requestHeaders)),
    userAgent: truncateUserAgent(requestHeaders.get('user-agent')),
  });

  revalidatePath('/dashboard/customize');
  revalidatePath('/dashboard');
  revalidatePath(`/p/${profile.slug}`);
  return { ok: true, message: 'Visitor page updated. Open visitor sessions will refresh automatically.' };
}
