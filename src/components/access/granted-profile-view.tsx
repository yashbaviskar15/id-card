'use client';

import { useEffect, useRef, useState } from 'react';
import { buttonVariants } from '@/components/ui/button';
import { SessionTimer } from '@/components/access/session-timer';
import { BrandMark } from '@/components/brand/brand-mark';
import {
  CalendarDays,
  Contact,
  Eye,
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
import type { GrantedProfile, GrantContactItem, GrantDocument, VisitorTheme } from '@/lib/types';

const VISITOR_HEADER_THEMES: Record<VisitorTheme, string> = {
  ink: 'bg-gradient-to-r from-slate-950 to-slate-800',
  ocean: 'bg-gradient-to-r from-sky-950 to-sky-800',
  forest: 'bg-gradient-to-r from-emerald-950 to-emerald-800',
};

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

type ContactKind = 'email' | 'phone';

function ContactMethod({ item, kind }: { item: GrantContactItem; kind: ContactKind }) {
  const Icon = kind === 'email' ? Mail : Phone;
  const label = item.label || (kind === 'email' ? 'Email address' : 'Phone number');

  return (
    <li className="min-w-0 rounded-xl border border-hairline bg-white p-4">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-ink">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <p className="min-w-0 truncate text-xs font-semibold uppercase tracking-[0.08em] text-label">
          {label}
        </p>
      </div>
      <p className="mt-3 break-words text-[15px] font-semibold leading-6 text-ink [overflow-wrap:anywhere]">
        {item.value}
      </p>
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
  );
}

function ContactSection({
  emails,
  phones,
}: {
  emails: GrantContactItem[];
  phones: GrantContactItem[];
}) {
  if (emails.length === 0 && phones.length === 0) return null;

  const methods: { kind: ContactKind; item: GrantContactItem; key: string }[] = [];
  const rowCount = Math.max(emails.length, phones.length);

  for (let index = 0; index < rowCount; index += 1) {
    const email = emails[index];
    const phone = phones[index];
    if (email) methods.push({ kind: 'email', item: email, key: `email-${index}` });
    if (phone) methods.push({ kind: 'phone', item: phone, key: `phone-${index}` });
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-semibold text-ink">Contact details</h2>
        <p className="text-sm text-label">Choose the most convenient way to get in touch.</p>
      </div>
      <ul className="grid min-w-0 items-start gap-3 sm:grid-cols-2">
        {methods.map(({ kind, item, key }) => (
          <ContactMethod key={key} item={item} kind={kind} />
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
            aria-label={`${item.label || 'Website'}: ${item.url.hostname} (opens in a new tab)`}
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
      <dl>
        <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-label">
          <Icon className="h-4 w-4" aria-hidden="true" />
          {label}
        </dt>
        <dd className="mt-2 break-words text-base font-medium leading-6 text-ink">{value}</dd>
      </dl>
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
                href={`/p/${slug}/doc/${document.id}/view`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`View ${document.name}`}
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
                  <Eye className="h-4 w-4" aria-hidden="true" />
                  <span>View</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
        <div className="flex items-start gap-2 border-t border-subtle-line bg-muted/50 px-5 py-3 sm:px-6">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-label" aria-hidden="true" />
          <p className="text-xs leading-5 text-label">
            Visitor access opens a watermarked view. Screenshots and screen recording cannot be reliably blocked.
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
    let disposed = false;
    let source: EventSource | null = null;
    let fallbackTimer: number | null = null;
    let failures = 0;
    let inFlight = false;
    let controller: AbortController | null = null;

    const endSession = () => {
      if (disposed) return;
      setProfile(null);
      setPhotoUrl(null);
      setSessionEnded(true);
    };

    const applySnapshot = (snapshot: {
      profile: GrantedProfile;
      photoChanged: boolean;
      photoUrl?: string | null;
    }) => {
      photoPathRef.current = snapshot.profile.photo_path;
      setProfile(snapshot.profile);
      if (snapshot.photoChanged) setPhotoUrl(snapshot.photoUrl ?? null);
      setReconnecting(false);
    };

    // Polling fallback: only used if the live stream cannot stay connected.
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
          endSession();
          return;
        }
        if (!response.ok) {
          setReconnecting(true);
          return;
        }
        applySnapshot(await response.json());
      } catch {
        if (!controller.signal.aborted) setReconnecting(true);
      } finally {
        inFlight = false;
      }
    }

    const startFallbackPolling = () => {
      if (fallbackTimer !== null) return;
      fallbackTimer = window.setInterval(() => void refreshSnapshot(), 5_000);
    };

    const openStream = () => {
      if (disposed) return;
      source = new EventSource(`/p/${encodeURIComponent(slug)}/stream`);

      source.addEventListener('open', () => {
        failures = 0;
        setReconnecting(false);
      });
      source.addEventListener('message', (event) => {
        try {
          applySnapshot(JSON.parse((event as MessageEvent<string>).data));
        } catch {
          /* ignore a malformed frame; the next one corrects it */
        }
      });
      source.addEventListener('ended', () => {
        source?.close();
        source = null;
        endSession();
      });
      source.addEventListener('recycle', () => {
        // The server recycles long streams; reconnect transparently.
        source?.close();
        source = null;
        openStream();
      });
      source.addEventListener('error', () => {
        // EventSource retries on its own; only fall back if it keeps failing.
        failures += 1;
        if (failures >= 4) {
          source?.close();
          source = null;
          setReconnecting(true);
          startFallbackPolling();
          void refreshSnapshot();
        }
      });
    };

    openStream();

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refreshSnapshot();
    };
    document.addEventListener('visibilitychange', refreshWhenVisible);
    window.addEventListener('focus', refreshWhenVisible);

    return () => {
      disposed = true;
      source?.close();
      if (fallbackTimer !== null) window.clearInterval(fallbackTimer);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      window.removeEventListener('focus', refreshWhenVisible);
      controller?.abort();
    };
  }, [sessionEnded, slug]);

  if (sessionEnded || !profile) {
    return (
      <main className="bg-page flex min-h-dvh items-center justify-center px-4 py-10">
        <section className="surface shadow-card w-full max-w-md p-7 text-center sm:p-9">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-ink">
            <LockKeyhole className="h-5 w-5" aria-hidden="true" />
          </span>
          <h1 className="mt-5 text-xl font-semibold text-ink">This access session has ended</h1>
          <p className="mt-2 text-sm leading-6 text-label">
            The owner may have revoked access or the session may have expired. Request a new code to continue.
          </p>
          <a href={`/p/${slug}`} className={cn(buttonVariants(), 'mt-6 h-11 px-5 font-medium')}>
            Return to access screen
          </a>
        </section>
      </main>
    );
  }

  const compact = profile.visitor_layout === 'compact';

  return (
    <div className="bg-page min-h-dvh overflow-x-hidden">
      <main className={`mx-auto w-full min-w-0 px-3 pt-4 pb-28 sm:px-5 sm:py-8 lg:px-8 ${compact ? 'max-w-5xl' : 'max-w-7xl'}`}>
        {reconnecting ? (
          <p role="status" className="mx-auto mb-3 max-w-6xl text-sm text-label">
            Connection interrupted. Retrying securely…
          </p>
        ) : null}
        <div className={`mx-auto space-y-5 sm:space-y-6 ${compact ? 'max-w-4xl' : 'max-w-6xl'}`}>
          <section className="surface shadow-card min-w-0 overflow-hidden rounded-2xl">
            <div className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-white sm:px-6 ${VISITOR_HEADER_THEMES[profile.visitor_theme]}`}>
              <div className="flex min-w-0 items-center gap-2.5 text-sm font-semibold">
                <BrandMark className="rounded-lg ring-1 ring-white/15" />
                <span>Private Identity</span>
              </div>
              <span className="inline-flex min-h-7 items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-2.5 text-xs font-medium">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Temporary access active
              </span>
            </div>
            <div className={`flex min-w-0 flex-col gap-5 bg-gradient-to-b from-white to-muted/20 sm:flex-row sm:items-center sm:gap-6 ${compact ? 'p-4 sm:p-5' : 'p-5 sm:p-7'}`}>
              <div className={`flex shrink-0 items-center justify-center self-center overflow-hidden rounded-2xl border border-hairline bg-white shadow-sm ring-4 ring-muted/60 sm:self-auto ${compact ? 'h-20 w-20' : 'h-24 w-24 sm:h-32 sm:w-32'}`}>
                {photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photoUrl}
                    alt=""
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <UserRound className="h-9 w-9 text-label/60" aria-hidden="true" />
                )}
              </div>
              <div className="min-w-0 flex-1 text-center sm:text-left">
                <p className="eyebrow">Shared with you</p>
                <h1 className={`mt-1.5 font-semibold tracking-tight break-words text-ink [overflow-wrap:anywhere] ${compact ? 'text-xl sm:text-2xl' : 'text-2xl sm:text-3xl'}`}>
                  {profile.full_name}
                </h1>
                {profile.visitor_intro ? (
                  <p className="mx-auto mt-2 max-w-2xl whitespace-pre-wrap break-words text-sm leading-6 text-label sm:mx-0">
                    {profile.visitor_intro}
                  </p>
                ) : null}
                <div className="mt-3 flex justify-center sm:justify-start">
                  <SessionTimer until={profile.session_expires_at} />
                </div>
                {profile.phones[0] || profile.emails[0] ? (
                  <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
                    {profile.phones[0] ? (
                      <ActionLink href={`tel:${profile.phones[0].value.replace(/[^\d+]/g, '')}`}>
                        <Phone aria-hidden="true" />
                        Call
                      </ActionLink>
                    ) : null}
                    {profile.emails[0] ? (
                      <ActionLink href={`mailto:${encodeURIComponent(profile.emails[0].value)}`}>
                        <Mail aria-hidden="true" />
                        Email
                      </ActionLink>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <div className={`grid min-w-0 items-start gap-5 sm:gap-6 lg:gap-8 ${compact ? 'grid-cols-1' : 'lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]'}`}>
            <div className="min-w-0 space-y-5">
              {profile.emails.length > 0 || profile.phones.length > 0 ? (
                <ContactSection emails={profile.emails} phones={profile.phones} />
              ) : (
                <section className="surface shadow-card flex items-start gap-3 p-5 sm:p-6">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-label">
                    <LockKeyhole className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <h2 className="text-base font-semibold text-ink">Contact details are private</h2>
                    <p className="mt-1 text-sm leading-6 text-label">
                      The owner has not shared an email address or phone number for this visit.
                      You can use any social links shown below.
                    </p>
                  </div>
                </section>
              )}

              <SocialLinks items={profile.social_links ?? []} />

              {profile.dob || profile.address ? (
                <section className="surface shadow-card p-5 sm:p-6">
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
              <div className="surface shadow-card flex items-start gap-3 p-4">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-label" aria-hidden="true" />
                <div>
                  <h2 className="text-sm font-semibold text-ink">Private by design</h2>
                  <p className="mt-1 text-sm leading-5 text-label">
                    This page closes when the session ends. Recipients may keep information or files they already saved.
                  </p>
                </div>
              </div>
            </aside>
          </div>

          <div className="hidden justify-end sm:flex">
            <a
              href={`/p/${slug}/vcf`}
              download
              className={cn(buttonVariants(), 'h-11 px-5 font-medium')}
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

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-hairline bg-white/95 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] shadow-float backdrop-blur sm:hidden">
        <a
          href={`/p/${slug}/vcf`}
          download
          className={cn(buttonVariants(), 'h-11 w-full font-medium')}
        >
          <Contact className="h-4 w-4" aria-hidden="true" />
          Save contact
        </a>
      </div>
    </div>
  );
}
