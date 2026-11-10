'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

/** Secondary action for error pages: return to wherever the visitor came from. */
export function ErrorBackButton({ label = 'Go back' }: { label?: string }) {
  const router = useRouter();
  return (
    <Button variant="outline" className="min-h-11" onClick={() => router.back()}>
      {label}
    </Button>
  );
}
