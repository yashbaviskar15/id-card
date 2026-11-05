import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-2xl font-bold tracking-tight">Private Identity Vault</h1>
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
