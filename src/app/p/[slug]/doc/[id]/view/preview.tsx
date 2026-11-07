'use client';

import { useEffect, useState } from 'react';
import { LockKeyhole } from 'lucide-react';

export function DocumentPreview({
  slug,
  documentId,
  mime,
  documentName,
  watermark,
  expiresAt,
}: {
  slug: string;
  documentId: string;
  mime: string;
  documentName: string;
  watermark: string;
  expiresAt: string;
}) {
  const [ended, setEnded] = useState(false);
  const [accessConfirmed, setAccessConfirmed] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);

  useEffect(() => {
    const source = new EventSource(`/p/${encodeURIComponent(slug)}/stream`);
    const expiryTimer = window.setTimeout(
      () => {
        source.close();
        setEnded(true);
      },
      Math.max(0, Date.parse(expiresAt) - Date.now()),
    );
    source.addEventListener('message', () => {
      setAccessConfirmed(true);
      setReconnecting(false);
    });
    source.addEventListener('ended', () => {
      setEnded(true);
      source.close();
    });
    source.addEventListener('error', () => {
      setAccessConfirmed(false);
      setReconnecting(true);
      void fetch(`/p/${encodeURIComponent(slug)}/snapshot`, {
        cache: 'no-store',
        credentials: 'same-origin',
      }).then((response) => {
        if (response.status === 401 || response.status === 404) setEnded(true);
        else if (response.ok) {
          setAccessConfirmed(true);
          setReconnecting(false);
        }
      }).catch(() => {
        // Keep the file hidden until the stream or snapshot can verify access.
      });
    });
    return () => {
      window.clearTimeout(expiryTimer);
      source.close();
    };
  }, [expiresAt, slug]);

  const src = `/p/${encodeURIComponent(slug)}/doc/${encodeURIComponent(documentId)}/file`;

  if (ended) {
    return (
      <section role="status" className="surface shadow-card mx-auto flex min-h-64 max-w-3xl flex-col items-center justify-center p-6 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-ink">
          <LockKeyhole className="h-6 w-6" aria-hidden="true" />
        </span>
        <h2 className="mt-4 text-lg font-semibold text-ink">Preview access has ended</h2>
        <p className="mt-2 max-w-lg text-sm leading-6 text-label">
          The secure viewer has been closed. Request a new access code from the owner to view this file again.
        </p>
      </section>
    );
  }

  if (!accessConfirmed) {
    return (
      <section role="status" className="surface shadow-card flex min-h-64 items-center justify-center p-6 text-center">
        <p className="text-sm text-label">
          {reconnecting ? 'Reconnecting to verify access. The document is hidden.' : 'Verifying your access…'}
        </p>
      </section>
    );
  }

  return (
    <section className="surface shadow-card overflow-hidden">
      {reconnecting ? (
        <p role="status" className="border-b border-subtle-line bg-muted/60 px-4 py-2 text-xs text-label">
          Reconnecting to confirm your access…
        </p>
      ) : null}
      <div className="relative min-h-[65vh] bg-muted/30 sm:min-h-[75vh]">
        {mime.startsWith('image/') ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={`Preview of ${documentName}`} className="absolute inset-0 h-full w-full object-contain" referrerPolicy="no-referrer" />
        ) : (
          <iframe
            title={`Preview of ${documentName}`}
            src={`${src}#toolbar=0&navpanes=0&scrollbar=0`}
            className="absolute inset-0 h-full w-full border-0"
            referrerPolicy="no-referrer"
          />
        )}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 grid select-none grid-cols-2 place-items-center gap-8 overflow-hidden p-3 opacity-30 sm:grid-cols-3 sm:gap-12 sm:p-8"
        >
          {Array.from({ length: 12 }, (_, index) => (
            <span
              key={index}
              className="max-w-full -rotate-[24deg] break-all rounded bg-white/50 px-2 py-1 text-center text-[10px] font-semibold leading-4 text-slate-900 shadow-sm [overflow-wrap:anywhere] sm:text-xs"
            >
              {watermark}
            </span>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-1 border-t border-subtle-line px-4 py-3 text-xs text-label sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <span>Session watermarked preview · downloading is not offered here</span>
        <span>Access ends {new Date(expiresAt).toISOString().slice(11, 16)} UTC</span>
      </div>
    </section>
  );
}
