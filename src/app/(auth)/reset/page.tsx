import { redirect } from 'next/navigation';
import { getOwnerOrNull } from '@/lib/auth/session';
import { ResetForm } from './reset-form';
import { createShareMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export const metadata = createShareMetadata({
  title: 'Reset your password',
  description: 'Set a new password for your private identity vault.',
  path: '/reset',
});

export default async function ResetPage() {
  // Reaching here requires the recovery session created by /auth/callback.
  const owner = await getOwnerOrNull();
  if (!owner) redirect('/login?error=link');

  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-bold tracking-tight">Choose a new password</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          At least 12 characters. Every other device will be signed out.
        </p>
        <ResetForm />
      </div>
    </main>
  );
}
