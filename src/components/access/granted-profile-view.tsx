import { buttonVariants } from '@/components/ui/button';
import { SessionTimer } from '@/components/access/session-timer';
import { signedVisitorPhotoUrl } from '@/lib/access/visitor';
import { Download, FileText } from 'lucide-react';
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

function ActionLink({ href, children, external }: { href: string; children: React.ReactNode; external?: boolean }) {
  return (
    <a
      href={href}
      className={buttonVariants({ variant: 'outline', size: 'sm' })}
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
  return (
    <section className="rounded-2xl border border-hairline bg-white p-5 shadow-sm">
      <h2 className="text-[10px] font-bold tracking-[0.2em] text-label uppercase">{title}</h2>
      <ul className="mt-4 space-y-4">
        {items.map((item, index) => (
          <li key={`${kind}-${index}`} className="min-w-0">
            {item.label ? <p className="text-[10px] font-bold text-label/60 uppercase tracking-wider">{item.label}</p> : null}
            <p className="truncate text-lg font-bold text-ink">{item.value}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {kind === 'email' ? (
                <ActionLink href={`mailto:${encodeURIComponent(item.value)}`}>Email</ActionLink>
              ) : (
                <>
                  <ActionLink href={`tel:${item.value.replace(/\s+/g, '')}`}>Call</ActionLink>
                  {whatsAppNumber(item.value) ? (
                    <ActionLink href={`https://wa.me/${whatsAppNumber(item.value)}`} external>
                      WhatsApp
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

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold tracking-[0.2em] text-label uppercase">{label}</p>
      <p className="mt-1 text-lg font-bold break-words text-ink">{value}</p>
    </div>
  );
}

function DocumentsSection({ slug, documents }: { slug: string; documents: GrantDocument[] }) {
  if (documents.length === 0) return null;
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2 px-4">
        <div className="h-1.5 w-1.5 rounded-full bg-ink/20" />
        <h2 className="text-[10px] font-black tracking-[0.3em] text-label/60 uppercase">Shared Documents</h2>
      </div>
      <div className="overflow-hidden rounded-[32px] border border-hairline bg-white shadow-sm">
        <ul className="divide-y divide-subtle-line">
          {documents.map((document) => (
            <li key={document.id}>
              <a
                href={`/p/${slug}/doc/${document.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between px-6 py-5 transition-colors hover:bg-[#f8f9fa] group"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-[20px] border border-hairline bg-white text-label transition-all group-hover:border-ink group-hover:bg-ink group-hover:text-white group-hover:scale-105 shadow-sm">
                    <FileText className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-base font-black text-ink group-hover:underline">{document.name}</p>
                    <p className="text-[10px] font-bold text-label uppercase tracking-widest">{formatSize(document.size)}</p>
                  </div>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-hairline text-label transition-all group-hover:border-ink group-hover:text-ink group-hover:scale-110 shadow-sm">
                  <Download className="h-5 w-5" />
                </div>
              </a>
            </li>
          ))}
        </ul>
        <div className="bg-[#f8f9fa] px-6 py-4 border-t border-hairline">
          <p className="text-[10px] font-bold text-label/40 uppercase tracking-[0.2em] text-center">
            Files are decrypted on demand and expire with the session
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
export async function GrantedProfileView({ slug, profile }: { slug: string; profile: GrantedProfile }) {
  const photoUrl = await signedVisitorPhotoUrl(profile.photo_path);

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-12 sm:py-20">
      <div className="relative overflow-hidden rounded-[40px] border border-hairline bg-white shadow-2xl shadow-ink/5">
        <div className="absolute inset-x-0 top-0 h-2 bg-ink" />
        <div className="flex flex-col items-center gap-8 p-10 text-center sm:flex-row sm:items-start sm:text-left">
          <div className="relative group">
            <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-[32px] border-2 border-subtle-line bg-photo-placeholder shadow-md transition-transform group-hover:scale-105 sm:h-24 sm:w-24">
              {photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <span className="text-[10px] font-black tracking-[0.2em] text-label/40 uppercase">Photo</span>
              )}
            </div>
            <div className="absolute -inset-1 rounded-[32px] border border-ink/5 pointer-events-none" />
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex items-center justify-center gap-2 sm:justify-start">
              <div className="h-1.5 w-1.5 rounded-full bg-ink/20" />
              <p className="text-[10px] font-black tracking-[0.3em] text-label/60 uppercase">Verified Identity</p>
            </div>
            <h1 className="text-4xl leading-none font-black tracking-tight text-ink break-words sm:text-3xl">
              {profile.full_name}
            </h1>
            <div className="mt-4 flex justify-center sm:justify-start">
              <SessionTimer until={profile.session_expires_at} />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 space-y-6">
        <div className="grid gap-6">
          <ContactBlock title="Email" items={profile.emails} kind="email" />
          <ContactBlock title="Phone" items={profile.phones} kind="phone" />
        </div>

        {profile.dob || profile.address ? (
          <section className="space-y-8 rounded-[32px] border border-hairline bg-white p-8 shadow-sm">
            {profile.dob ? <Detail label="Date of birth" value={profile.dob} /> : null}
            {profile.address ? <Detail label="Address" value={profile.address} /> : null}
          </section>
        ) : null}

        <DocumentsSection slug={slug} documents={profile.documents ?? []} />

        <div className="pt-4">
          <a
            href={`/p/${slug}/vcf`}
            download
            className={cn(buttonVariants(), 'h-16 w-full rounded-[24px] text-xl font-black shadow-xl shadow-ink/10 transition-all hover:scale-[1.02] active:scale-[0.98]')}
          >
            Save contact
          </a>
        </div>

        <div className="flex flex-col items-center gap-4 py-8">
          <div className="h-px w-8 bg-subtle-line" />
          <p className="text-center text-[10px] font-black tracking-[0.4em] text-label/30 uppercase">
            Private · Secure · Encrypted
          </p>
        </div>
      </div>
    </div>
  );
}
