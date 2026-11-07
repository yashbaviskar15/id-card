import { createHash } from 'node:crypto';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { z } from 'zod';
import { loadGrantedDocument, loadGrantedProfile } from '@/lib/access/visitor';
import { slugSchema } from '@/lib/validation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Eye, FileLock2, ShieldCheck } from 'lucide-react';
import { DocumentPreview } from './preview';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Secure document preview',
  robots: { index: false, follow: false, nocache: true },
};

const PREVIEWABLE_MIMES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export default async function VisitorDocumentPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const parsedSlug = slugSchema.safeParse(slug);
  const parsedId = z.uuid().safeParse(id);
  if (!parsedSlug.success || !parsedId.success) notFound();

  const [granted, document] = await Promise.all([
    loadGrantedProfile(parsedSlug.data),
    loadGrantedDocument(parsedSlug.data, parsedId.data),
  ]);
  if (!granted || !document) notFound();

  const previewable = PREVIEWABLE_MIMES.has(document.mime);
  const sessionCode = createHash('sha256')
    .update(granted.grantId)
    .digest('hex')
    .slice(0, 8)
    .toUpperCase();
  const stamp = `${granted.profile.full_name} · PRIVATE VIEW · ${sessionCode} · ${new Date().toISOString().slice(0, 16)} UTC`;

  return (
    <main className="bg-page min-h-dvh px-3 py-4 sm:px-6 sm:py-6">
      <div className="mx-auto w-full max-w-7xl space-y-4">
        <header className="surface shadow-card flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-ink">
              <FileLock2 className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="eyebrow">Session-only preview</p>
              <h1 className="mt-1 break-words text-base font-semibold text-ink [overflow-wrap:anywhere]">
                {document.name}
              </h1>
            </div>
          </div>
          <Button render={<Link href={`/p/${encodeURIComponent(parsedSlug.data)}`} />} variant="outline" className="min-h-10 shrink-0 gap-2">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to profile
          </Button>
        </header>

        {previewable ? (
          <DocumentPreview
            slug={parsedSlug.data}
            documentId={parsedId.data}
            mime={document.mime}
            documentName={document.name}
            watermark={stamp}
            expiresAt={granted.profile.session_expires_at}
          />
        ) : (
          <section className="surface shadow-card mx-auto flex min-h-64 max-w-3xl flex-col items-center justify-center p-6 text-center sm:p-10">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-ink">
              <Eye className="h-6 w-6" aria-hidden="true" />
            </span>
            <h2 className="mt-4 text-lg font-semibold text-ink">Preview is not supported for this file</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-label">
              No visitor download is offered for this file type. Ask the owner to share a PDF or image if you need
              to view this document.
            </p>
          </section>
        )}

        <p className="flex items-start gap-2 px-1 text-xs leading-5 text-label">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          The viewer checks access while the session is active and marks this view. This discourages
          casual copying, but screenshots, screen recording, browser tools, and external cameras cannot
          be reliably blocked. Anything already captured cannot be remotely erased.
        </p>
      </div>
    </main>
  );
}
