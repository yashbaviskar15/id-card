'use client';

import { useEffect, useRef, useState } from 'react';
import { buttonVariants } from '@/components/ui/button';
import { SessionTimer } from '@/components/access/session-timer';
import {
  CalendarDays,
  Contact,
  Download,
  ExternalLink,
  FileText,
  LockKeyhole,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { cn } from 'cn';
import type { GrantedProfile, GrantContactItem, GrantDocument } from '@/lib/types';

/** wa.me and tel: both want digits and a leading plus, not punctuation. */
function whatsAppNumber(value: string): string {
  return value.replace(/[^\d]/g, '');
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatBirthDate(value: string): string {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function ActionLink({ href, children, external }: { href: string; children: React.ReactNode; external?: boolean }) {
  return (
    <a
      href={href}
      className={cn(
        buttonVariants({ variant: 'outline', size: 'sm' }),
        'min-h-11 rounded-lg border-hairline px-3 text-sm font-semibold normal-case tracking-normal transition-colors hover:border-ink hover:bg-muted',
      )}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer nofollow' } : {})}
    >
      {children}
    </a>
  );
}

function ContactBlock({
  title,
  items,
  kind,
}: {
  title: string;
  items: GrantContactItem[];
  kind: 'email' | 'phone';
}) {
  if (items.length === 0) return null;
  const Icon = kind === 'email' ? Mail : Phone;

  return (
    <section className="min-w-0 rounded-2xl border border-hairline bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-ink">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          <p className="text-sm text-label">{kind === 'email' ? 'Send a direct email' : 'Call or message directly'}</p>
        </div>
      </div>
      <ul className="space-y-5">
        {items.map((item, index) => (
          <li key={`${kind}-${index}`} className="min-w-0 border-t border-subtle-line pt-4 first:border-0 first:pt-0">
            {item.label ? <p className="mb-1 text-xs font-medium text-label">{item.label}</p> : null}
            <p className="text-base font-semibold leading-6 text-ink [overflow-wrap:anywhere] sm:text-lg">{item.value}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {kind === 'email' ? (
                <ActionLink href={`mailto:${encodeURIComponent(item.value)}`}>
                  <Mail aria-hidden="true" />
                  Email
                </ActionLink>
              ) : (
                <>
                  <ActionLink href={`tel:${item.value.replace(/[^\d+]/g, '')}`}>
                    <Phone aria-hidden="true" />
                    Call
                  </ActionLink>
                  {whatsAppNumber(item.value) ? (
                    <ActionLink href={`https://wa.me/${whatsAppNumber(item.value)}`} external>
                      <MessageCircle aria-hidden="true" />
                      Message
                    </ActionLink>
                  ) : null}
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function safeSocialUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url : null;
  } catch {
    return null;
  }
}

function SocialLinks({ items }: { items: GrantContactItem[] }) {
  const links = items.flatMap((item, index) => {
    const url = safeSocialUrl(item.value);
    return url ? [{ ...item, url, key: `${item.label ?? 'link'}-${index}` }] : [];
  });
  if (links.length === 0) return null;

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-ink">Find me online</h2>
        <p className="text-sm text-label">Profiles the owner chose to share.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {links.map((item) => (
          <a
            key={item.key}
            href={item.url.toString()}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="group flex min-h-16 min-w-0 items-center gap-3 rounded-xl border border-hairline bg-white p-4 transition-colors hover:border-ink hover:bg-muted/40 focus-visible:outline-offset-2"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-ink">
              <ExternalLink className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-ink">{item.label || 'Website'}</span>
              <span className="mt-0.5 block truncate text-xs text-label">{item.url.hostname}</span>
            </span>
            <ExternalLink className="h-4 w-4 shrink-0 text-label group-hover:text-ink" aria-hidden="true" />
          </a>
        ))}
      </div>
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  const Icon = label === 'Address' ? MapPin : CalendarDays;

  return (
    <div className="min-w-0 rounded-xl bg-muted/70 p-4">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-label">
        <Icon className="h-4 w-4" aria-hidden="true" />
        {label}
      </p>
      <p className="mt-2 break-words text-base font-medium leading-6 text-ink">{value}</p>
    </div>
  );
}

function DocumentsSection({
  slug,
  documents,
  canViewDocuments,
}: {
  slug: string;
  documents: GrantDocument[];
  canViewDocuments: boolean;
}) {
  if (!canViewDocuments) {
    return (
      <section className="rounded-2xl border border-hairline bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-label">
            <FileText className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-ink">Documents not included</h2>
            <p className="mt-1 text-sm leading-6 text-label">
              Ask the owner for a new access code that includes shared documents.
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (documents.length === 0) {
    return (
      <section className="rounded-2xl border border-hairline bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-label">
            <FileText className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-ink">No shared documents</h2>
            <p className="mt-1 text-sm leading-6 text-label">
              This access code allows documents, but the owner has not marked any files as shared.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-hairline bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-subtle-line px-5 py-4 sm:px-6">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-ink">
          <FileText className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-base font-semibold text-ink">Shared documents</h2>
          <p className="text-sm text-label">{documents.length} available for this visit</p>
        </div>
      </div>
      <div>
        <ul className="divide-y divide-subtle-line">
          {documents.map((document) => (
            <li key={document.id}>
              <a
                href={`/p/${slug}/doc/${document.id}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Download ${document.name}`}
                className="group flex min-h-[76px] items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/60 focus-visible:z-10 sm:gap-4 sm:px-6"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-hairline bg-white text-label">
                  <FileText className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-semibold leading-5 text-ink group-hover:underline [overflow-wrap:anywhere]">
                    {document.name}
                  </p>
                  <p className="mt-1 text-xs text-label">{formatSize(document.size)}</p>
                </div>
                <span className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg border border-hairline px-3 text-sm font-semibold text-ink transition-colors group-hover:border-ink">
                  <Download className="h-4 w-4" aria-hidden="true" />
                  <span>Download</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
        <div className="flex items-start gap-2 border-t border-subtle-line bg-muted/50 px-5 py-3 sm:px-6">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-label" aria-hidden="true" />
          <p className="text-xs leading-5 text-label">
            Downloads are temporary and only available while this access session is active.
          </p>
        </div>
      </div>
    </section>
  );
}

/**
 * The complete visitor view. It renders only what the database projection
 * returned for this grant's scope — Aadhaar, PAN, notes and account records are
 * not part of the projection and can never be requested from here, and a
 * document only appears when the owner marked it shareable and this specific
 * hand-out opted into documents.
 */
export function GrantedProfileView({
  slug,
  profile: initialProfile,
  photoUrl: initialPhotoUrl,
}: {
  slug: string;
  profile: GrantedProfile;
  photoUrl: string | null;
}) {
  const [profile, setProfile] = useState<GrantedProfile | null>(initialProfile);
  const [photoUrl, setPhotoUrl] = useState(initialPhotoUrl);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const photoPathRef = useRef(initialProfile.photo_path);

  useEffect(() => {
    if (sessionEnded) return;
    let inFlight = false;
    let controller: AbortController | null = null;

    async function refreshSnapshot() {
      if (document.visibilityState !== 'visible' || inFlight) return;
      inFlight = true;
      controller = new AbortController();
      const query = new URLSearchParams({ photoPath: photoPathRef.current ?? '' });

      try {
        const response = await fetch(`/p/${encodeURIComponent(slug)}/snapshot?${query}`, {
          cache: 'no-store',
          credentials: 'same-origin',
          signal: controller.signal,
        });
        if (response.status === 401) {
          setProfile(null);
          setPhotoUrl(null);
          setSessionEnded(true);
          return;
        }
        if (!response.ok) {
          setReconnecting(true);
          return;
        }

        const snapshot = await response.json() as {
          profile: GrantedProfile;
          photoChanged: boolean;
          photoUrl?: string | null;
        };
        photoPathRef.current = snapshot.profile.photo_path;
        setProfile(snapshot.profile);
        if (snapshot.photoChanged) setPhotoUrl(snapshot.photoUrl ?? null);
        setReconnecting(false);
      } catch {
        if (!controller.signal.aborted) setReconnecting(true);
      } finally {
        inFlight = false;
      }
    }

    const timer = window.setInterval(() => void refreshSnapshot(), 8_000);
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refreshSnapshot();
    };
    document.addEventListener('visibilitychange', refreshWhenVisible);
    window.addEventListener('focus', refreshWhenVisible);
    void refreshSnapshot();

    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      window.removeEventListener('focus', refreshWhenVisible);
      controller?.abort();
    };
  }, [sessionEnded, slug]);

  if (sessionEnded || !profile) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#f4f6f8] px-4 py-10">
        <section className="w-full max-w-md rounded-3xl border border-hairline bg-white p-7 text-center shadow-sm sm:p-9">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-ink">
            <LockKeyhole className="h-6 w-6" aria-hidden="true" />
          </span>
          <h1 className="mt-5 text-2xl font-bold text-ink">This access session has ended</h1>
          <p className="mt-2 text-sm leading-6 text-label">
            The owner may have revoked access or the session may have expired. Request a new code to continue.
          </p>
          <a href={`/p/${slug}`} className={cn(buttonVariants(), 'mt-6 min-h-12 rounded-xl px-5 font-semibold')}>
            Return to access screen
          </a>
        </section>
      </main>
    );
  }

  return (
      <div className="min-h-dvh overflow-x-hidden bg-gradient-to-b from-[#f1f4f8] via-[#f8f9fa] to-[#f8f9fa]">
      <main className="mx-auto min-w-0 w-full max-w-7xl px-3 pb-28 pt-4 sm:px-5 sm:py-8 lg:px-8">
        {reconnecting ? (
          <p role="status" className="mx-auto mb-3 max-w-6xl text-sm text-label">
            Connection interrupted. Retrying securely…
          </p>
        ) : null}
        <div className="mx-auto max-w-6xl space-y-5 sm:space-y-6 lg:space-y-7">
          <section className="min-w-0 overflow-hidden rounded-2xl border border-hairline bg-white shadow-[0_18px_50px_rgba(17,24,39,0.06)] sm:rounded-3xl">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-ink to-slate-800 px-4 py-3 text-white sm:px-7 sm:py-4">
              <div className="flex min-w-0 items-center gap-2 text-sm font-semibold">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10">
                  <Contact className="h-4 w-4" aria-hidden="true" />
                </span>
                <span>Private identity</span>
              </div>
              <span className="inline-flex min-h-9 items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 text-xs font-semibold shadow-sm">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                Temporary access active
              </span>
            </div>
            <div className="flex min-w-0 flex-col gap-4 bg-gradient-to-br from-white to-muted/40 p-4 sm:flex-row sm:items-center sm:gap-6 sm:p-7 lg:p-8">
              <div className="flex h-24 w-24 shrink-0 items-center justify-center self-center overflow-hidden rounded-2xl border-4 border-white bg-muted shadow-lg ring-1 ring-ink/5 sm:h-32 sm:w-32 sm:self-auto">
                {photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photoUrl}
                    alt={`Profile photo of ${profile.full_name}`}
                    className="h-full w-full object-contain p-1"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <UserRound className="h-10 w-10 text-label/60" aria-hidden="true" />
                )}
              </div>
              <div className="min-w-0 flex-1 text-center sm:text-left">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-label">Shared with you</p>
                <h1 className="mt-1 break-words text-2xl font-bold tracking-tight text-ink sm:text-3xl lg:text-4xl [overflow-wrap:anywhere]">
                  {profile.full_name}
                </h1>
                <div className="mt-3 flex justify-center sm:justify-start">
                  <SessionTimer until={profile.session_expires_at} />
                </div>
              </div>
            </div>
          </section>

          <div className="grid min-w-0 items-start gap-4 sm:gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)] lg:gap-6">
            <div className="min-w-0 space-y-5">
              {profile.emails.length > 0 || profile.phones.length > 0 ? (
                <section className="space-y-3">
                  <div>
                    <h2 className="text-lg font-semibold text-ink">Contact information</h2>
                    <p className="text-sm text-label">Choose the most convenient way to get in touch.</p>
                  </div>
                  <div className="grid min-w-0 gap-3 sm:grid-cols-2 sm:gap-4">
                    <ContactBlock title="Email" items={profile.emails} kind="email" />
                    <ContactBlock title="Phone" items={profile.phones} kind="phone" />
                  </div>
                </section>
              ) : null}

              <SocialLinks items={profile.social_links ?? []} />

              {profile.dob || profile.address ? (
                <section className="rounded-2xl border border-hairline bg-white p-5 shadow-sm sm:p-6">
                  <div className="mb-4">
                    <h2 className="text-base font-semibold text-ink">Additional information</h2>
                    <p className="text-sm text-label">Details shared for this visit.</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {profile.dob ? <Detail label="Date of birth" value={formatBirthDate(profile.dob)} /> : null}
                    {profile.address ? <Detail label="Address" value={profile.address} /> : null}
                  </div>
                </section>
              ) : null}
            </div>

            <aside className="min-w-0 space-y-4 sm:space-y-5">
              <DocumentsSection
                slug={slug}
                documents={profile.documents ?? []}
                canViewDocuments={profile.can_view_documents}
              />
              <div className="flex items-start gap-3 rounded-2xl border border-hairline bg-white p-4">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-label" aria-hidden="true" />
                <div>
                  <h2 className="text-sm font-semibold text-ink">Private by design</h2>
                  <p className="mt-1 text-sm leading-5 text-label">
                    This view is temporary. Shared information and documents are available only for this session.
                  </p>
                </div>
              </div>
            </aside>
          </div>

          <div className="hidden justify-end sm:flex">
            <a
              href={`/p/${slug}/vcf`}
              download
              className={cn(buttonVariants(), 'min-h-12 rounded-xl px-5 font-semibold')}
            >
              <Contact className="h-4 w-4" aria-hidden="true" />
              Save contact
            </a>
          </div>

          <footer className="border-t border-hairline pt-5 text-center text-xs text-label">
            Information is shared temporarily by its owner. Access closes automatically when the session ends.
          </footer>
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-hairline bg-white/95 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] shadow-lg backdrop-blur sm:hidden">
        <a
          href={`/p/${slug}/vcf`}
          download
          className={cn(buttonVariants(), 'min-h-12 w-full rounded-xl font-semibold')}
        >
          <Contact className="h-4 w-4" aria-hidden="true" />
          Save contact
        </a>
      </div>
    </div>
  );
}
