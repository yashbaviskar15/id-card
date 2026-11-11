import 'server-only';
import { createServiceClient } from '@/lib/db/service';
import { log } from '@/lib/log';

/**
 * This app has exactly one owner. Scheduled jobs run without a browser session
 * (so the owner-scoped client has no RLS identity), which is why they resolve
 * the owner id from the profile row that is created on first sign-in.
 */
export async function loadOwnerId(): Promise<string | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('owner_id')
    .limit(1)
    .maybeSingle<{ owner_id: string }>();
  if (error) {
    log.warn('owner.load failed', { code: error.code });
    return null;
  }
  return data?.owner_id ?? null;
}
