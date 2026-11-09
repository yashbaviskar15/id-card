import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { createShareMetadata } from '@/lib/seo';

export const metadata = createShareMetadata({
  title: 'Private identity, shared securely',
  description: 'Create a private identity card and securely share files with owner-issued access.',
  path: '/',
});

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; error_code?: string }>;
}) {
  const params = await searchParams;
  const emailLinkExpired = params.error_code === 'otp_expired' || params.error === 'access_denied';

  return (
    <main className="flex min-h-dvh items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-2xl font-bold tracking-tight">Private Identity Vault</h1>
        {emailLinkExpired ? (
          <div className="mt-5 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-left text-sm text-destructive" role="alert">
            <p>This email link expired or was already used. Request a fresh password reset link.</p>
            <Link href="/forgot" className="mt-2 inline-block font-semibold underline underline-offset-4">
              Request a new reset link
            </Link>
          </div>
        ) : null}
        <p className="mt-3 text-sm text-muted-foreground">
          A private identity card and document vault. Access to the profile is by owner-issued
          one-time codes only.
        </p>
        <Button className="mt-8 h-11 w-full" render={<Link href="/login" />}>
          Sign in
        </Button>
      </div>
    </main>
  );
}
