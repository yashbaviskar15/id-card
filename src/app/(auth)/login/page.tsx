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
    <main className="relative flex min-h-dvh items-center justify-center px-6 py-12 overflow-hidden bg-[#f8f9fa]">
      <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-ink/5 blur-3xl" />
      <div className="absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-ink/5 blur-3xl" />
      
      <div className="w-full max-w-sm relative z-10">
        <div className="flex flex-col items-center text-center mb-10">
          <div className="h-14 w-14 rounded-2xl bg-ink flex items-center justify-center text-white font-bold text-3xl shadow-xl shadow-ink/20 mb-6 rotate-3">P</div>
          <h1 className="text-3xl font-black tracking-tighter text-ink">Welcome Back</h1>
          <p className="mt-2 text-base font-medium text-label">Owner authentication required.</p>
        </div>

        {params.reset ? (
          <div className="mt-4 rounded-2xl border-2 border-ink/5 bg-white p-4 text-sm font-bold text-ink shadow-sm text-center">
            Password updated successfully.
          </div>
        ) : null}
        {params.error === 'link' ? (
          <div className="mt-4 rounded-2xl border-2 border-destructive/10 bg-destructive/5 p-4 text-sm font-bold text-destructive shadow-sm text-center">
            Invalid or expired link.
          </div>
        ) : null}

        <div className="bg-white p-8 rounded-[32px] border border-hairline shadow-[0_20px_50px_rgba(0,0,0,0.04)]">
          <LoginForm
            next={params.next ?? '/dashboard'}
            nonce={nonce}
            turnstileSiteKey={turnstileEnabled ? (clientEnv.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? null) : null}
          />
        </div>

        <p className="mt-8 text-center text-xs font-bold text-label/40 uppercase tracking-widest">
          Private Identity Vault &copy; 2026
        </p>
      </div>
    </main>
  );
}
