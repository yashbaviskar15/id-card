import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-xl font-bold tracking-tight">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This link does not point at anything here.
        </p>
        <Button className="mt-8 h-11 w-full" render={<Link href="/" />}>
          Go to the home page
        </Button>
      </div>
    </main>
  );
}
