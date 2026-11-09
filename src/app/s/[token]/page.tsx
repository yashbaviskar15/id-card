import type { Metadata } from 'next';
import { Download, FileText } from 'lucide-react';
import { cn } from 'cn';
import { buttonVariants } from '@/components/ui/button';
import { resolveShareLink, shareTokenSchema } from '@/lib/share/load';
import { isShareUnlocked } from '@/lib/share/unlock';
import { ShareShell, UnlockForm, UnlockHeading } from './unlock-form';
import { createShareMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;

  return createShareMetadata({
    title: 'Secure file sharing',
    description: 'A private file has been shared with you through a secure, time-limited link.',
    path: `/s/${encodeURIComponent(token)}`,
    robots: { index: false, follow: false, nocache: true },
  });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** The single, identical state for every unavailable link — nothing is disclosed. */
function Unavailable() {
  return (
    <ShareShell>
      <div className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-label">
          <FileText className="h-5 w-5" aria-hidden="true" />
        </div>
        <h1 className="mt-5 text-xl font-semibold tracking-tight text-ink">This link is not available</h1>
        <p className="mt-2 text-sm leading-6 text-label">
          It may have expired, been revoked or reached its download limit. Ask the owner for a new link.
        </p>
      </div>
    </ShareShell>
  );
}

export default async function ShareLandingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const parsed = shareTokenSchema.safeParse(token);
  if (!parsed.success) return <Unavailable />;

  const link = await resolveShareLink(parsed.data);
  if (!link) return <Unavailable />;

  if (link.requiresPassword && !(await isShareUnlocked(parsed.data))) {
    return (
      <ShareShell>
        <UnlockHeading />
        <UnlockForm token={parsed.data} />
      </ShareShell>
    );
  }

  // Best-effort: nothing to persist here; the download route does the counting.
  const downloadHref = `/s/${encodeURIComponent(parsed.data)}/download`;

  return (
    <ShareShell>
      <div className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-ink">
          <FileText className="h-5 w-5" aria-hidden="true" />
        </div>
        <h1 className="mt-5 text-xl font-semibold tracking-tight text-ink">A file has been shared with you</h1>
        <p className="mt-2 break-all text-sm font-medium text-ink [overflow-wrap:anywhere]">{link.name}</p>
        <p className="mt-1 text-xs text-label">{formatSize(link.size)}</p>

        <a href={downloadHref} download className={cn(buttonVariants({ variant: 'default' }), 'mt-6 h-11 w-full gap-2 font-medium')}>
          <Download className="h-4 w-4" aria-hidden="true" />
          Download
        </a>
        <p className="mt-4 text-xs leading-5 text-label">
          This link is private. Do not forward it to anyone you do not trust.
        </p>
      </div>
    </ShareShell>
  );
}
