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
    <section className="rounded-2xl border border-hairline bg-white p-5 shadow-sm">
      <h2 className="text-[10px] font-bold tracking-[0.2em] text-label uppercase">Documents</h2>
      <ul className="mt-4 divide-y divide-subtle-line">
        {documents.map((document) => (
          <li key={document.id} className="flex items-center gap-4 py-4 first:pt-0 last:pb-0">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-subtle-line bg-photo-placeholder shadow-inner">
              <FileText className="h-6 w-6 text-ink" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-base font-bold text-ink">{document.name}</span>
              <span className="block text-xs font-medium text-label">{formatSize(document.size)}</span>
            </span>
            <a
              href={`/p/${slug}/doc/${document.id}`}
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'h-9 shrink-0 px-4 font-bold')}
            >
              <Download className="h-4 w-4 mr-2" aria-hidden="true" />
              Open
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-[10px] font-medium text-label/60">
        Files are decrypted on demand and expire when this session ends.
      </p>
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
    <div className="mx-auto w-full max-w-lg px-4 py-8 sm:py-12">
      <div className="overflow-hidden rounded-3xl border border-hairline bg-white shadow-sm">
        <div className="flex flex-col items-center gap-6 p-8 text-center sm:flex-row sm:items-start sm:text-left">
          <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-subtle-line bg-photo-placeholder shadow-inner sm:h-20 sm:w-20">
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <span className="text-[10px] font-bold tracking-[0.2em] text-label uppercase">No Photo</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold tracking-[0.2em] text-label uppercase">Verified Identity</p>
            <h1 className="mt-2 text-3xl leading-tight font-extrabold break-words text-ink sm:text-2xl">{profile.full_name}</h1>
            <div className="mt-4 flex justify-center sm:justify-start">
              <SessionTimer until={profile.session_expires_at} />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        <ContactBlock title="Email" items={profile.emails} kind="email" />
        <ContactBlock title="Phone" items={profile.phones} kind="phone" />

        {profile.dob || profile.address ? (
          <section className="space-y-6 rounded-2xl border border-hairline bg-white p-5 shadow-sm">
            {profile.dob ? <Detail label="Date of birth" value={profile.dob} /> : null}
            {profile.address ? <Detail label="Address" value={profile.address} /> : null}
          </section>
        ) : null}

        <DocumentsSection slug={slug} documents={profile.documents ?? []} />

        <a
          href={`/p/${slug}/vcf`}
          download
          className={cn(buttonVariants(), 'h-14 w-full rounded-2xl text-lg font-bold shadow-md shadow-ink/10 transition-transform active:scale-[0.98]')}
        >
          Save contact to phone
        </a>

        <p className="pb-8 text-center text-[10px] font-bold tracking-widest text-label/40 uppercase">
          End-to-end Encrypted · Single-use Session
        </p>
      </div>
    </div>
  );
}
