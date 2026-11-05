'use client';

import { createBrowserClient } from '@supabase/ssr';
import { clientEnv } from '@/lib/env';

/**
 * Browser client. It only ever sees the public anon key (RLS applies) and is
 * used for interactive auth calls such as sign-in and password recovery.
 * Service-role and encryption keys must never reach this module.
 */
export function createBrowserSupabase() {
  return createBrowserClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
