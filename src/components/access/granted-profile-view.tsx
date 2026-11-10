'use client';

import { useEffect, useRef, useState } from 'react';
import { buttonVariants } from '@/components/ui/button';
import { SessionTimer } from '@/components/access/session-timer';
import { BrandMark } from '@/components/brand/brand-mark';
import {
  CalendarDays,
  Clock3,
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
const cardClass = 'min-w-0 rounded-2xl border border-[#E5E7EB] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)]';
const iconTileClass = 'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F3F4F6] text-[#334155]';
const actionButtonClass = 'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#D1D5DB] bg-white text-[#0F172A] transition-colors hover:bg-[#F3F4F6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F172A]';

/**
 * The owner picks one of these themes on the Customize page. The hero band and
 * the primary quick-action button follow the chosen colour so the live visitor
 * page matches what the preview promised.
 */
const VISITOR_THEMES = {
  ink: { hero: 'bg-[#0B1220]', accent: 'bg-[#0F172A]', accentHover: 'hover:bg-[#1E293B]' },
  ocean: { hero: 'bg-sky-800', accent: 'bg-sky-700', accentHover: 'hover:bg-sky-800' },
  forest: { hero: 'bg-emerald-800', accent: 'bg-emerald-700', accentHover: 'hover:bg-emerald-800' },
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

function ContactRow({ item, kind }: { item: GrantContactItem; kind: ContactKind }) {
  const isEmail = kind === 'email';
  const LabelIcon = isEmail ? Mail : Phone;
  const label = item.label || (isEmail ? 'Email' : 'Phone');
  const phone = item.value.replace(/[^\d+]/g, '');
  const whatsapp = whatsAppNumber(item.value);

  return (
    <div className="flex min-w-0 items-center gap-3 border-t border-[#E5E7EB] px-5 py-3.5 sm:gap-4">
      <span className={iconTileClass}><LabelIcon {...iconProps} /></span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#5B6472]">{label}</p>
        <p className="mt-0.5 break-words text-base leading-6 text-[#0F172A] [overflow-wrap:anywhere]">{item.value}</p>
      </div>
      {isEmail ? (
        <a className={`${actionButtonClass} visitor-print-hide`} href={`mailto:${encodeURIComponent(item.value)}`} aria-label={`Email ${item.value}`}>
          <Mail {...iconProps} />
        </a>
      ) : (
        <div className="flex shrink-0 gap-2">
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
  emails: GrantContactItem[];
  phones: GrantContactItem[];
  dob: string | null;
  address: string | null;
}) {
  const hasContact = emails.length > 0 || phones.length > 0 || dob || address;

  return (
    <section className={`${cardClass} overflow-hidden`}>
      <header className="px-5 py-4">
        <h2 className="text-lg font-semibold text-[#0F172A]">Contact details</h2>
        <p className="text-sm text-[#5B6472]">Choose the most convenient way to get in touch.</p>
      </header>
      {hasContact ? (
        <>
          {emails.map((item, index) => <ContactRow key={`email-${index}`} item={item} kind="email" />)}
          {phones.map((item, index) => <ContactRow key={`phone-${index}`} item={item} kind="phone" />)}
          {dob ? <Detail label="Date of birth" value={formatBirthDate(dob)} /> : null}
          {address ? <Detail label="Address" value={address} /> : null}
        </>
      ) : (
        <div className="flex items-start gap-3 border-t border-[#E5E7EB] px-5 py-4">
          <span className={iconTileClass}><LockKeyhole {...iconProps} /></span>
          <div>
            <h3 className="font-medium text-[#0F172A]">Contact details are private</h3>
            <p className="mt-1 text-sm leading-5 text-[#5B6472]">The owner has not shared contact details for this visit.</p>
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

function SocialLinks({ items }: { items: GrantContactItem[] }) {
  const links = items.flatMap((item, index) => {
    const url = safeSocialUrl(item.value);
    return url ? [{ ...item, url, key: `${item.label ?? 'link'}-${index}` }] : [];
  });
  if (links.length === 0) return null;

  return (
    <section className={`${cardClass} p-5`}>
      <header className="mb-4">
        <h2 className="text-lg font-semibold text-[#0F172A]">Find me online</h2>
        <p className="text-sm text-[#5B6472]">Profiles the owner chose to share.</p>
      </header>
      <div className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(min(100%,230px),1fr))] gap-3">
        {links.map((item) => (
          <a key={item.key} href={item.url.toString()} target="_blank" rel="noopener noreferrer"
            aria-label={`${item.label || 'Website'}: ${item.url.hostname} (opens in a new tab)`}
            className="group flex min-h-[68px] min-w-0 items-center gap-3 rounded-xl border border-[#E5E7EB] bg-white p-3 transition-colors hover:bg-[#F8FAFC]">
            <span className={iconTileClass}><ExternalLink {...iconProps} /></span>
            <span className="min-w-0 flex-1">
              <span className="block break-words text-sm font-semibold text-[#0F172A] [overflow-wrap:anywhere]">{item.label || 'Website'}</span>
              <span className="mt-0.5 block break-words text-sm text-[#5B6472] [overflow-wrap:anywhere]">{item.url.hostname}</span>
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
    <div className="flex min-w-0 items-center gap-3 border-t border-[#E5E7EB] px-5 py-3.5 sm:gap-4">
      <span className={iconTileClass}><Icon {...iconProps} /></span>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#5B6472]">{label}</p>
        <p className="mt-0.5 break-words text-base leading-6 text-[#0F172A] [overflow-wrap:anywhere]">{value}</p>
      </div>
    </div>
  );
}

function DocumentsRows({ slug, documents }: { slug: string; documents: GrantDocument[] }) {
  return (
    <ul className="mt-3 space-y-2">
      {documents.map((document) => (
        <li key={document.id} className="flex min-w-0 items-center gap-2">
          <FileText {...iconProps} />
          <span className="min-w-0 flex-1">
            <span className="block break-words text-sm font-medium text-[#0F172A] [overflow-wrap:anywhere]">{document.name}</span>
            <span className="text-xs text-[#5B6472]">{formatSize(document.size)}</span>
          </span>
          <a href={`/p/${encodeURIComponent(slug)}/doc/${encodeURIComponent(document.id)}/view`} target="_blank" rel="noopener noreferrer"
            aria-label={`View ${document.name}`} className="visitor-print-hide inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg border border-[#D1D5DB] px-3 text-sm font-semibold text-[#0F172A]">
            <Download {...iconProps} /><span>View</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

function AboutRow({ icon: Icon, title, children }: { icon: typeof Clock3; title: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-3 border-t border-[#E5E7EB] px-5 py-4">
      <span className={iconTileClass}><Icon {...iconProps} /></span>
      <div className="min-w-0 flex-1">
        <h3 className="font-medium text-[#0F172A]">{title}</h3>
        <div className="mt-1 text-sm leading-5 text-[#5B6472]">{children}</div>
      </div>
    </div>
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

  const theme = VISITOR_THEMES[profile.visitor_theme] ?? VISITOR_THEMES.ink;
  const compact = profile.visitor_layout === 'compact';

  return (
    <div className="visitor-page min-h-dvh bg-[#F3F4F6] font-inter text-[#0F172A]">
      <header className="border-b border-[#E5E7EB] bg-white">
        <div className="mx-auto flex min-h-[62px] w-full max-w-[1120px] flex-wrap items-center justify-between gap-x-4 gap-y-2 px-[clamp(12px,3vw,32px)] py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <BrandMark className="rounded-[9px]" />
            <span className="text-base font-semibold text-[#0F172A]">Private Identity</span>
          </div>
          <span className="inline-flex min-h-9 items-center gap-2 rounded-full bg-[#F3F4F6] px-3.5 text-sm font-medium text-[#334155]">
            <ShieldCheck {...iconProps} />
            Temporary access active
          </span>
        </div>
      </header>

      <main className="animate-enter mx-auto flex w-full max-w-[1120px] min-w-0 flex-col gap-5 px-[clamp(12px,3vw,32px)] pt-3 pb-8 sm:py-8">
        {reconnecting ? (
          <p role="status" className="text-sm text-[#5B6472]">Connection interrupted. Retrying securely…</p>
        ) : null}

        <section className={`flex min-w-0 flex-wrap items-center gap-7 rounded-[20px] p-5 text-white sm:p-9 ${theme.hero}`}>
          <div className="relative flex h-[120px] w-[120px] shrink-0 items-center justify-center overflow-hidden rounded-[28px] border border-white/20 bg-white/10">
            {photoUrl ? (
              <>
                {photoLoading ? <span className="absolute inset-0 animate-pulse bg-white/15" aria-hidden="true" /> : null}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoUrl} alt="" className={`relative h-full w-full object-cover ${photoLoading ? 'opacity-0' : 'opacity-100'}`}
                  referrerPolicy="no-referrer" onLoad={() => setPhotoLoading(false)} onError={() => { setPhotoLoading(false); setPhotoUrl(null); }} />
              </>
            ) : (
              <UserRound size={48} strokeWidth={1.8} className="text-white/60" aria-hidden="true" />
            )}
          </div>
          <div className="min-w-0 flex-[1_1_350px]">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-white/70">Shared with you</p>
            <h1 className="mt-1 min-h-[1.2em] break-words text-[clamp(28px,5vw,44px)] font-semibold leading-tight tracking-tight text-white [overflow-wrap:anywhere]">
              {profile.full_name || <span className="block h-[1.05em] w-64 max-w-full animate-pulse rounded bg-white/15" aria-label="Loading name" />}
            </h1>
            {profile.visitor_intro ? (
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-white/80">{profile.visitor_intro}</p>
            ) : null}
            <div className="mt-4">
              <SessionTimer until={profile.session_expires_at} serverNow={profile.server_now} />
            </div>
          </div>
        </section>

        <nav aria-label="Quick actions" className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(min(100%,150px),1fr))] gap-3">
          {[
            { label: 'Save contact', href: `/p/${encodeURIComponent(slug)}/vcf`, download: true, icon: Download, primary: true },
            ...(profile.phones[0] ? [{ label: 'Call', href: `tel:${profile.phones[0].value.replace(/[^\d+]/g, '')}`, icon: Phone }] : []),
            ...(profile.phones[0] && whatsAppNumber(profile.phones[0].value) ? [{ label: 'Message', href: `https://wa.me/${whatsAppNumber(profile.phones[0].value)}`, icon: MessageCircle, external: true }] : []),
            ...(profile.emails[0] ? [{ label: 'Email', href: `mailto:${encodeURIComponent(profile.emails[0].value)}`, icon: Mail }] : []),
          ].map((action) => {
            const Icon = action.icon;
            const isPrimary = 'primary' in action && action.primary;
            return (
              <a key={action.label} href={action.href} {...('download' in action && action.download ? { download: true } : {})}
                {...('external' in action && action.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                className={`visitor-print-hide flex min-h-[88px] min-w-0 flex-col items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F172A] ${isPrimary ? `border-transparent text-white ${theme.accent} ${theme.accentHover}` : 'border-[#E5E7EB] bg-white text-[#0F172A] hover:bg-[#F8FAFC]'}`}>
                <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
                <span className="break-words text-center">{action.label}</span>
              </a>
            );
          })}
        </nav>

        <div className={`flex min-w-0 items-start gap-5 ${compact ? 'flex-col' : 'flex-wrap'}`}>
          <div className={`min-w-0 space-y-5 ${compact ? 'w-full' : 'flex-[2_1_420px]'}`}>
            <ContactSection emails={profile.emails} phones={profile.phones} dob={profile.dob} address={profile.address} />
            <SocialLinks items={profile.social_links ?? []} />
          </div>

          <aside className={`${cardClass} min-w-0 overflow-hidden ${compact ? 'w-full' : 'flex-[1_1_300px]'}`}>
            <h2 className="px-5 py-4 text-lg font-semibold text-[#0F172A]">About this access</h2>
            <AboutRow icon={Clock3} title="Temporary session">
              Access closes automatically when the timer ends.
            </AboutRow>
            <AboutRow icon={FileText} title={profile.can_view_documents && (profile.documents?.length ?? 0) > 0 ? 'Shared documents' : 'Documents not included'}>
              {profile.can_view_documents && (profile.documents?.length ?? 0) > 0 ? (
                <DocumentsRows slug={slug} documents={profile.documents} />
              ) : (
                <span>Ask the owner for a new access code that includes shared documents.</span>
              )}
            </AboutRow>
            <AboutRow icon={ShieldCheck} title="Private by design">
              Recipients may keep information or files they already saved.
            </AboutRow>
          </aside>
        </div>

        <footer className="border-t border-[#E5E7EB] pt-5 text-center text-sm leading-5 text-[#5B6472]">
          Information is shared temporarily by its owner. Access closes automatically when the session ends.
        </footer>
      </main>
    </div>
  );
}
