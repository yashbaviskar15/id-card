import { headers } from 'next/headers';
import { turnstileEnabled, clientEnv } from '@/lib/env';
import { isOwnerEmail } from '@/lib/env.server';
import { createUserClient } from '@/lib/db/user';
import { AuthScreen } from '@/components/auth/auth-screen';
import { LoginForm } from './login-form';
import { createShareMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export const metadata = createShareMetadata({
  title: 'Sign in securely',
  description: 'Sign in to manage your private identity card and document vault.',
  path: '/login',
});

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reset?: string; error?: string }>;
}) {
  const [h, params] = await Promise.all([headers(), searchParams]);
  const nonce = h.get('x-nonce') ?? '';

  // A password-only session that still owes a second factor is allowed to stay
  // here so it can finish the TOTP challenge instead of bouncing to the dashboard.
  const supabase = await createUserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let mfaRequired = false;
  if (user && isOwnerEmail(user.email)) {
    const hasTotp = (user.factors ?? []).some(
      (factor) => factor.factor_type === 'totp' && factor.status === 'verified',
    );
    if (hasTotp) {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      mfaRequired = aal?.currentLevel !== 'aal2';
    }
  }

  return (
    <AuthScreen title="Welcome back" description="Sign in to manage your private identity vault.">
      {params.reset ? (
        <div className="mt-6 rounded-xl border border-ink/10 bg-muted/50 p-4 text-sm font-semibold text-ink" role="status">
          Password updated successfully.
        </div>
      ) : null}
      {params.error === 'link' ? (
        <div className="mt-6 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm font-semibold text-destructive" role="alert">
          This sign-in link is invalid or has expired.
        </div>
      ) : null}
      <LoginForm
        next={params.next ?? '/dashboard'}
        nonce={nonce}
        turnstileSiteKey={turnstileEnabled ? (clientEnv.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? null) : null}
        mfaRequired={mfaRequired}
      />
    </AuthScreen>
  );
}
