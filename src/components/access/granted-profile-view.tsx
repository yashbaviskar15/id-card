'use client';

import { useEffect, useRef, useState } from 'react';
import { buttonVariants } from '@/components/ui/button';
import { SessionTimer } from '@/components/access/session-timer';
import { BrandMark } from '@/components/brand/brand-mark';
import {
  CalendarDays,
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

const iconProps = { size: 20, strokeWidth: 1.8, 'aria-hidden': true } as const;
const cardClass = 'min-w-0 rounded-2xl border border-[#E2E6EB] bg-white shadow-[0_2px_10px_rgba(15,23,42,0.035)]';
const actionButtonClass = 'visitor-print-hide inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#D7DDE4] bg-white text-[#334155] transition-colors hover:border-[#AEB8C4] hover:bg-[#F7F8FA] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#334155]';

/**
 * Accent colors stay deliberately restrained so the visitor page reads like a
 * professional contact sheet rather than a large, theme-colored banner.
 */
const VISITOR_THEMES = {
  ink: { stripe: 'bg-[#172033]', accent: 'bg-[#172033] hover:bg-[#28354B]' },
  ocean: { stripe: 'bg-sky-800', accent: 'bg-sky-800 hover:bg-sky-900' },
  forest: { stripe: 'bg-emerald-800', accent: 'bg-emerald-800 hover:bg-emerald-900' },
} as const;

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

type ContactKind = 'email' | 'phone';

/** A contact item whose value is guaranteed to be a non-empty string. */
type ValidContactItem = GrantContactItem & { value: string };

/**
 * The `fields.value` column is nullable, so the projection may include items
 * with a null/empty value. Drop those before rendering so we never call
 * `.replace()` / `new URL()` on a non-string.
 */
function hasContactValue(item: GrantContactItem): item is ValidContactItem {
  return typeof item.value === 'string' && item.value.trim().length > 0;
}

function ContactRow({ item, kind }: { item: ValidContactItem; kind: ContactKind }) {
  const isEmail = kind === 'email';
  const LabelIcon = isEmail ? Mail : Phone;
  const label = item.label || (isEmail ? 'Email' : 'Phone');
  const phone = item.value.replace(/[^\d+]/g, '');
  const whatsapp = whatsAppNumber(item.value);

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-t border-[#E8EBEF] py-4 sm:grid-cols-[150px_minmax(0,1fr)_auto] sm:gap-4">
      <p className="col-span-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.09em] text-[#697586] sm:col-span-1 sm:col-start-1 sm:row-start-1">
        <LabelIcon size={15} strokeWidth={1.8} aria-hidden="true" />
        {label}
      </p>
      <p className="col-start-1 row-start-2 min-w-0 break-words text-[15px] leading-6 text-[#172033] [overflow-wrap:anywhere] sm:col-start-2 sm:row-start-1">
        {item.value}
      </p>
      {isEmail ? (
        <a className={`${actionButtonClass} col-start-2 row-start-2 sm:col-start-3 sm:row-start-1`} href={`mailto:${encodeURIComponent(item.value)}`} aria-label={`Email ${item.value}`}>
          <Mail {...iconProps} />
        </a>
      ) : (
        <div className="col-start-2 row-start-2 flex shrink-0 gap-2 sm:col-start-3 sm:row-start-1">
          <a className={`${actionButtonClass} visitor-print-hide`} href={`tel:${phone}`} aria-label={`Call ${item.value}`}>
            <Phone {...iconProps} />
          </a>
          {whatsapp ? (
            <a className={`${actionButtonClass} visitor-print-hide`} href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer" aria-label={`Message ${item.value} on WhatsApp`}>
              <MessageCircle {...iconProps} />
            </a>
          ) : null}
        </div>
      )}
    </div>
  );
}

function ContactSection({
  emails,
  phones,
  dob,
  address,
}: {
  emails: ValidContactItem[];
  phones: ValidContactItem[];
  dob: string | null;
  address: string | null;
}) {
  const hasContact = emails.length > 0 || phones.length > 0 || dob || address;

  return (
    <section className={`${cardClass} px-5 py-5 sm:px-7 sm:py-6`}>
      <header className="mb-2 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8792A0]">Details</p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-[#172033]">Contact information</h2>
        </div>
        <p className="text-xs text-[#697586]">Shared by the owner</p>
      </header>
      {hasContact ? (
        <>
          {emails.map((item, index) => <ContactRow key={`email-${index}`} item={item} kind="email" />)}
          {phones.map((item, index) => <ContactRow key={`phone-${index}`} item={item} kind="phone" />)}
          {dob ? <Detail label="Date of birth" value={formatBirthDate(dob)} /> : null}
          {address ? <Detail label="Address" value={address} /> : null}
        </>
      ) : (
        <div className="flex items-start gap-3 border-t border-[#E8EBEF] py-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F1F3F5] text-[#596678]">
            <LockKeyhole size={17} strokeWidth={1.8} aria-hidden="true" />
          </span>
          <div>
            <h3 className="font-medium text-[#172033]">Contact details are private</h3>
            <p className="mt-1 text-sm leading-5 text-[#697586]">The owner has not shared contact details for this visit.</p>
          </div>
        </div>
      )}
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

function SocialLinks({ items }: { items: ValidContactItem[] }) {
  const links = items.flatMap((item, index) => {
    const url = safeSocialUrl(item.value);
    return url ? [{ ...item, url, key: `${item.label ?? 'link'}-${index}` }] : [];
  });
  if (links.length === 0) return null;

  return (
    <section className={`${cardClass} px-5 py-5 sm:px-7 sm:py-6`}>
      <header className="mb-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8792A0]">Elsewhere</p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight text-[#172033]">Online profiles</h2>
      </header>
      <div className="grid min-w-0 grid-cols-1 gap-x-6 sm:grid-cols-2">
        {links.map((item) => (
          <a key={item.key} href={item.url.toString()} target="_blank" rel="noopener noreferrer"
            aria-label={`${item.label || 'Website'}: ${item.url.hostname} (opens in a new tab)`}
            className="group flex min-h-14 min-w-0 items-center gap-3 border-t border-[#E8EBEF] py-3 transition-colors hover:text-[#0F172A]">
            <span className="text-[#7C8795]"><ExternalLink size={17} strokeWidth={1.8} aria-hidden="true" /></span>
            <span className="min-w-0 flex-1">
              <span className="block break-words text-sm font-medium text-[#172033] [overflow-wrap:anywhere]">{item.label || 'Website'}</span>
              <span className="mt-0.5 block break-words text-xs text-[#697586] [overflow-wrap:anywhere]">{item.url.hostname}</span>
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  const Icon = label === 'Address' ? MapPin : CalendarDays;

  return (
    <div className="grid min-w-0 grid-cols-1 gap-y-1 border-t border-[#E8EBEF] py-4 sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-4">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.09em] text-[#697586]">
        <Icon size={15} strokeWidth={1.8} aria-hidden="true" />
        {label}
      </p>
      <p className="min-w-0 break-words text-[15px] leading-6 text-[#172033] [overflow-wrap:anywhere] sm:col-start-2 sm:row-start-1">{value}</p>
    </div>
  );
}

function DocumentsRows({ slug, documents }: { slug: string; documents: GrantDocument[] }) {
  return (
    <ul className="mt-3 divide-y divide-[#E8EBEF]">
      {documents.map((document) => (
        <li key={document.id} className="flex min-w-0 items-center gap-3 py-3 first:pt-0">
          <FileText size={18} strokeWidth={1.8} className="shrink-0 text-[#697586]" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block break-words text-sm font-medium text-[#172033] [overflow-wrap:anywhere]">{document.name}</span>
            <span className="text-xs text-[#697586]">{formatSize(document.size)}</span>
          </span>
          <a href={`/p/${encodeURIComponent(slug)}/doc/${encodeURIComponent(document.id)}/view`} target="_blank" rel="noopener noreferrer"
            aria-label={`View ${document.name}`} className="visitor-print-hide inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-[#334155] transition-colors hover:bg-[#F3F5F7]">
            <Download size={16} strokeWidth={1.8} aria-hidden="true" /><span>Open</span>
          </a>
        </li>
      ))}
    </ul>
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
  const [photoLoading, setPhotoLoading] = useState(Boolean(initialPhotoUrl));
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
      if (snapshot.photoChanged) {
        setPhotoUrl(snapshot.photoUrl ?? null);
        setPhotoLoading(Boolean(snapshot.photoUrl));
      }
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
      fallbackTimer = window.setInterval(() => void refreshSnapshot(), 1_000);
    };

    const stopFallbackPolling = () => {
      if (fallbackTimer === null) return;
      window.clearInterval(fallbackTimer);
      fallbackTimer = null;
    };

    const openStream = () => {
      if (disposed || source) return;
      source = new EventSource(`/p/${encodeURIComponent(slug)}/stream`);

      source.addEventListener('open', () => {
        failures = 0;
        setReconnecting(false);
        stopFallbackPolling();
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
      if (document.visibilityState !== 'visible') return;
      void refreshSnapshot();
      if (fallbackTimer !== null) openStream();
    };
    const reconnectWhenOnline = () => {
      if (document.visibilityState === 'visible' && fallbackTimer !== null) openStream();
      void refreshSnapshot();
    };
    document.addEventListener('visibilitychange', refreshWhenVisible);
    window.addEventListener('focus', refreshWhenVisible);
    window.addEventListener('online', reconnectWhenOnline);

    return () => {
      disposed = true;
      source?.close();
      if (fallbackTimer !== null) window.clearInterval(fallbackTimer);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      window.removeEventListener('focus', refreshWhenVisible);
      window.removeEventListener('online', reconnectWhenOnline);
      controller?.abort();
    };
  }, [sessionEnded, slug]);

  if (sessionEnded || !profile) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#F6F7F8] px-4 py-10 font-inter">
        <section className="w-full max-w-md rounded-2xl border border-[#E2E6EB] bg-white p-7 text-center shadow-[0_2px_10px_rgba(15,23,42,0.035)] sm:p-9">
          <BrandMark className="mx-auto rounded-xl" />
          <span className="mx-auto mt-6 flex h-11 w-11 items-center justify-center rounded-full bg-[#F1F3F5] text-[#334155]">
            <LockKeyhole size={19} strokeWidth={1.8} aria-hidden="true" />
          </span>
          <h1 className="mt-5 text-xl font-semibold tracking-tight text-[#172033]">This access session has ended</h1>
          <p className="mt-2 text-sm leading-6 text-[#697586]">
            The owner may have revoked access or the session may have expired. Request a new code to continue.
          </p>
          <a href={`/p/${slug}`} className={cn(buttonVariants(), 'mt-6 h-11 rounded-full px-5 font-medium')}>
            Return to access screen
          </a>
        </section>
      </main>
    );
  }

  const theme = VISITOR_THEMES[profile.visitor_theme] ?? VISITOR_THEMES.ink;
  const compact = profile.visitor_layout === 'compact';

  // Drop any contact items that carry a null/empty value before they reach
  // rendering code that calls `.replace()` or `new URL()` on the value.
  const emails = (profile.emails ?? []).filter(hasContactValue);
  const phones = (profile.phones ?? []).filter(hasContactValue);
  const socialLinks = (profile.social_links ?? []).filter(hasContactValue);

  return (
    <div className="visitor-page min-h-dvh bg-[#F6F7F8] font-inter text-[#172033]">
      <header className="border-b border-[#E6E9ED] bg-white">
        <div className="mx-auto flex min-h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <BrandMark className="rounded-[10px]" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-tight text-[#172033]">Private Identity</p>
              <p className="hidden text-[10px] font-medium uppercase tracking-[0.14em] text-[#8792A0] sm:block">Secure contact profile</p>
            </div>
          </div>
          <span className="inline-flex min-h-9 shrink-0 items-center gap-2 rounded-full border border-[#E4E8EC] bg-white px-3 text-xs font-medium text-[#465365]">
            <ShieldCheck size={16} strokeWidth={1.8} aria-hidden="true" />
            Protected share
          </span>
        </div>
      </header>

      <main className="animate-enter mx-auto w-full min-w-0 px-4 pb-10 pt-6 sm:px-7 sm:pt-9">
        {reconnecting ? (
          <p role="status" className="mx-auto mb-4 max-w-6xl rounded-lg border border-[#E3E7EB] bg-white px-4 py-3 text-sm text-[#697586]">
            Connection interrupted. Retrying securely…
          </p>
        ) : null}

        <div className={`mx-auto grid w-full items-start gap-5 ${compact ? 'max-w-2xl grid-cols-1' : 'max-w-6xl grid-cols-1 lg:grid-cols-[minmax(0,1fr)_290px]'}`}>
          <div className="min-w-0 space-y-5">
            <section className={`${cardClass} overflow-hidden`}>
              <div className={`h-1 ${theme.stripe}`} aria-hidden="true" />
              <div className="grid min-w-0 gap-5 p-5 sm:grid-cols-[96px_minmax(0,1fr)] sm:items-center sm:p-7">
                <div className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-[#E5E8EC] bg-[#F2F4F6] text-[#718096] sm:h-24 sm:w-24">
                  {photoUrl ? (
                    <>
                      {photoLoading ? <span className="absolute inset-0 animate-pulse bg-[#E7EAEE]" aria-hidden="true" /> : null}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photoUrl} alt="" className={`relative h-full w-full object-cover ${photoLoading ? 'opacity-0' : 'opacity-100'}`}
                        referrerPolicy="no-referrer" onLoad={() => setPhotoLoading(false)} onError={() => { setPhotoLoading(false); setPhotoUrl(null); }} />
                    </>
                  ) : (
                    <UserRound size={34} strokeWidth={1.5} aria-hidden="true" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8792A0]">Shared contact</p>
                  <h1 className="mt-1 break-words text-[clamp(26px,4vw,34px)] font-semibold leading-tight tracking-[-0.035em] text-[#172033] [overflow-wrap:anywhere]">
                    {profile.full_name || <span className="block h-9 w-64 max-w-full animate-pulse rounded bg-[#EEF0F3]" aria-label="Loading name" />}
                  </h1>
                  {profile.visitor_intro ? (
                    <p className="mt-2 max-w-2xl whitespace-pre-wrap break-words text-sm leading-6 text-[#596678]">{profile.visitor_intro}</p>
                  ) : null}
                  <div className="mt-4">
                    <SessionTimer until={profile.session_expires_at} serverNow={profile.server_now} />
                  </div>
                </div>
              </div>
              <nav aria-label="Contact actions" className="visitor-print-hide flex flex-wrap gap-2 border-t border-[#E9ECEF] px-5 py-4 sm:px-7">
                {[
                  { label: 'Save contact', href: `/p/${encodeURIComponent(slug)}/vcf`, download: true, icon: Download, primary: true },
                  ...(phones[0] ? [{ label: 'Call', href: `tel:${phones[0].value.replace(/[^\d+]/g, '')}`, icon: Phone }] : []),
                  ...(phones[0] && whatsAppNumber(phones[0].value) ? [{ label: 'Message', href: `https://wa.me/${whatsAppNumber(phones[0].value)}`, icon: MessageCircle, external: true }] : []),
                  ...(emails[0] ? [{ label: 'Email', href: `mailto:${encodeURIComponent(emails[0].value)}`, icon: Mail }] : []),
                ].map((action) => {
                  const Icon = action.icon;
                  const isPrimary = 'primary' in action && action.primary;
                  return (
                    <a key={action.label} href={action.href} {...('download' in action && action.download ? { download: true } : {})}
                      {...('external' in action && action.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                      className={`inline-flex min-h-11 flex-[1_1_125px] items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#334155] sm:flex-none ${isPrimary ? `text-white ${theme.accent}` : 'border border-[#DCE2E8] bg-white text-[#344154] hover:bg-[#F5F7F8]'}`}>
                      <Icon size={17} strokeWidth={1.8} aria-hidden="true" />
                      <span>{action.label}</span>
                    </a>
                  );
                })}
              </nav>
            </section>

            <ContactSection emails={emails} phones={phones} dob={profile.dob} address={profile.address} />
            <SocialLinks items={socialLinks} />
          </div>

          <aside className={`${cardClass} min-w-0 overflow-hidden`}>
            <div className="p-5 sm:p-6">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8792A0]">Access</p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight text-[#172033]">Shared with you</h2>
              <p className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-[#344154]">
                <span className="h-2 w-2 rounded-full bg-emerald-600" aria-hidden="true" />
                Temporary access is active
              </p>
            </div>
            <div className="border-t border-[#E9ECEF] px-5 py-5 sm:px-6">
              <div className="flex items-center gap-2">
                <FileText size={16} strokeWidth={1.8} className="text-[#697586]" aria-hidden="true" />
                <h3 className="text-sm font-semibold text-[#172033]">
                  {profile.can_view_documents && (profile.documents?.length ?? 0) > 0 ? 'Shared documents' : 'Documents'}
                </h3>
              </div>
              {profile.can_view_documents && (profile.documents?.length ?? 0) > 0 ? (
                <DocumentsRows slug={slug} documents={profile.documents ?? []} />
              ) : (
                <p className="mt-2 text-sm leading-5 text-[#697586]">Documents are not included in this share.</p>
              )}
            </div>
            <div className="flex items-start gap-3 border-t border-[#E9ECEF] bg-[#FAFBFC] px-5 py-4 sm:px-6">
              <ShieldCheck size={17} strokeWidth={1.8} className="mt-0.5 shrink-0 text-[#697586]" aria-hidden="true" />
              <p className="text-xs leading-5 text-[#697586]">
                Only details selected by the owner are shared. Recipients may save information they can view.
              </p>
            </div>
          </aside>
        </div>

        <footer className="mx-auto mt-8 max-w-6xl border-t border-[#E2E6EB] pt-5 text-center text-xs leading-5 text-[#8792A0]">
          Shared privately by its owner. Access closes automatically when the session expires.
        </footer>
      </main>
    </div>
  );
}
