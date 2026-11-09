import 'server-only';
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { NextRequest, NextResponse } from 'next/server';
import { clientEnv } from '@/lib/env';

/**
 * User-scoped Supabase client. Every owner read and write goes through this so
 * Row Level Security is always in force — a bug in application code cannot turn
 * into cross-owner data access.
 */
export async function createUserClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  return createServerClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component render: cookies are read-only there.
            // Session refresh is handled by middleware instead.
          }
        },
      },
    },
  );
}

/**
 * Client for middleware, where the request/response pair is available and the
 * refreshed session cookies can actually be written.
 */
export function createMiddlewareClient(request: NextRequest, response: NextResponse): SupabaseClient {
  return createServerClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            // Make refreshed tokens visible to downstream middleware and the
            // current request as well as the browser's next request.
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );
}
