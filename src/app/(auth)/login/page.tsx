import { headers } from 'next/headers';
import { turnstileEnabled, clientEnv } from '@/lib/env';
import { AuthScreen } from '@/components/auth/auth-screen';
import { LoginForm } from './login-form';

export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reset?: string; error?: string }>;
}) {
  const [h, params] = await Promise.all([headers(), searchParams]);
  const nonce = h.get('x-nonce') ?? '';

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
      />
    </AuthScreen>
  );
}
