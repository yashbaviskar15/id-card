import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createUserClient } from '@/lib/db/user';
import { log } from '@/lib/log';

export const dynamic = 'force-dynamic';

/**
 * Handles both Supabase email-link shapes:
 *   - PKCE `?code=...`
 *   - OTP   `?token_hash=...&type=recovery`
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type');
  const rawNext = url.searchParams.get('next') ?? '/dashboard';
  const next = /^\/[A-Za-z0-9\-_/?=&%.]*$/.test(rawNext) && !rawNext.startsWith('//') ? rawNext : '/dashboard';

  try {
    const supabase = await createUserClient();

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(new URL(next, url.origin));
      log.warn('auth.email_link_verification_failed', {
        flow: 'code',
        code: error.code ?? 'unknown',
        status: error.status,
      });
    }

    if (tokenHash && type) {
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as EmailOtpType });
      if (!error) return NextResponse.redirect(new URL(next, url.origin));
      log.warn('auth.email_link_verification_failed', {
        flow: 'token_hash',
        code: error.code ?? 'unknown',
        status: error.status,
      });
    }
  } catch {
    log.warn('auth.email_link_verification_failed', { reason: 'request_failed' });
  }

  return NextResponse.redirect(new URL('/login?error=link', url.origin));
}
