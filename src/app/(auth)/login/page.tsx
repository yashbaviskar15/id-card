import { headers } from 'next/headers';
import { turnstileEnabled, clientEnv } from '@/lib/env';
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
    <main className="flex min-h-dvh items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-bold tracking-tight">Sign in</h1>
        <p className="mt-2 text-sm text-muted-foreground">Owner access only.</p>
        {params.reset ? (
          <p className="mt-4 rounded-md border border-border bg-[#F3F4F6] px-3 py-2 text-sm">
            Your password was updated. Sign in with the new password.
          </p>
        ) : null}
        {params.error === 'link' ? (
          <p className="mt-4 rounded-md border border-border bg-[#F3F4F6] px-3 py-2 text-sm">
            That link is invalid or has expired. Request a new one.
          </p>
        ) : null}
        <LoginForm
          next={params.next ?? '/dashboard'}
          nonce={nonce}
          turnstileSiteKey={turnstileEnabled ? (clientEnv.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? null) : null}
        />
      </div>
    </main>
  );
}
