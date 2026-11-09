'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function CopyableLink({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="mt-3 flex min-w-0 items-center gap-2 rounded-lg border border-page-border bg-page p-3">
      <p className="min-w-0 flex-1 truncate whitespace-nowrap font-mono text-xs text-ink sm:text-sm" title={value}>
        {value}
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 shrink-0 gap-1.5"
        aria-label={copied ? 'Link copied' : 'Copy permanent link'}
        onClick={copyLink}
      >
        {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  );
}
