import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { createMiddlewareClient } from '@/lib/db/user';

/**
 * Refreshes the Supabase session on every request and returns both the response
 * (carrying refreshed cookies) and the resolved user.
 *
 * Note: `supabase.auth.getUser()` must be called to actually refresh; do not
 * replace it with `getSession()`, which trusts the cookie.
 */
export async function updateSession(request: NextRequest): Promise<{
  response: NextResponse;
  userId: string | null;
  userEmail: string | null;
}> {
  const response = NextResponse.next({ request });
  const supabase = createMiddlewareClient(request, response);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return {
    response,
    userId: user?.id ?? null,
    userEmail: user?.email ?? null,
  };
}
