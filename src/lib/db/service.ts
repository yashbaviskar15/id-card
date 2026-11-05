import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { clientEnv } from '@/lib/env';
import { serverEnv } from '@/lib/env.server';

/**
 * Service-role client. Server only, never imported by a client component, never
 * returned to the browser.
 *
 * It is used exclusively for:
 *   - the atomic access-code consume function (revoked from anon/authenticated)
 *   - reading the visitor-facing profile projection after a grant is validated
 *   - appending access/audit log rows
 *   - minting short-lived signed storage URLs
 *   - alert email dispatch
 *   - first-login category seeding
 *
 * Every query built with this client must still be filtered by the owner id
 * explicitly: RLS cannot protect us here, so IDOR protection is manual.
 */
let cached: SupabaseClient | null = null;

export function createServiceClient(): SupabaseClient {
  if (cached) return cached;
  const env = serverEnv();
  cached = createClient(clientEnv.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { 'x-application-name': 'private-identity-vault' } },
  });
  return cached;
}
