import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { createMiddlewareClient } from '@/lib/db/user';

/**
 * Refreshes the Supabase session on every request and returns the response
 * (carrying refreshed cookies), the resolved user, and whether the session still
 * owes a second factor.
 *
 * `needsMfa` is true when the account has a verified authenticator factor but
 * the current token is only aal1 (password). It is checked against the user's
 * factors so a password-only session cannot reach `/dashboard` directly.
 *
 * Note: `supabase.auth.getUser()` must be called to actually refresh; do not
 * replace it with `getSession()`, which trusts the cookie.
 */
export async function updateSession(request: NextRequest): Promise<{
  response: NextResponse;
  userId: string | null;
  userEmail: string | null;
  needsMfa: boolean;
}> {
  const response = NextResponse.next({ request });
  const supabase = createMiddlewareClient(request, response);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let needsMfa = false;
  if (user) {
    const hasTotp = (user.factors ?? []).some(
      (factor) => factor.factor_type === 'totp' && factor.status === 'verified',
    );
    if (hasTotp) {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      needsMfa = aal?.currentLevel !== 'aal2';
    }
  }

  return {
    response,
    userId: user?.id ?? null,
    userEmail: user?.email ?? null,
    needsMfa,
  };
}
