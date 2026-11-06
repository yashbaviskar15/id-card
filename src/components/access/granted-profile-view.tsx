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
    <section className="rounded-xl border border-hairline bg-white p-4">
      <h2 className="text-xs font-normal tracking-[0.14em] text-label uppercase">{title}</h2>
      <ul className="mt-3 space-y-3">
        {items.map((item, index) => (
          <li key={`${kind}-${index}`} className="min-w-0">
            {item.label ? <p className="text-xs text-label">{item.label}</p> : null}
            <p className="truncate text-base font-semibold text-ink">{item.value}</p>
            <div className="mt-2 flex flex-wrap gap-2">
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
      <p className="text-xs font-normal tracking-[0.14em] text-label uppercase">{label}</p>
      <p className="mt-1 text-base font-semibold break-words text-ink">{value}</p>
    </div>
  );
}

function DocumentsSection({ slug, documents }: { slug: string; documents: GrantDocument[] }) {
  if (documents.length === 0) return null;
  return (
    <section className="rounded-xl border border-hairline bg-white p-4">
      <h2 className="text-xs font-normal tracking-[0.14em] text-label uppercase">Documents</h2>
      <ul className="mt-3 divide-y divide-subtle-line">
        {documents.map((document) => (
          <li key={document.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-subtle-line bg-photo-placeholder">
              <FileText className="h-5 w-5 text-ink" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-ink">{document.name}</span>
              <span className="block text-xs text-label">{formatSize(document.size)}</span>
            </span>
            <a
              href={`/p/${slug}/doc/${document.id}`}
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'shrink-0')}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Open
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-label">
        These files open through a link that stops working when this view closes.
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
    <div className="mx-auto w-full max-w-lg px-4 py-6">
      <div className="rounded-2xl border border-hairline bg-white p-5">
        <div className="flex items-center gap-4">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-subtle-line bg-photo-placeholder">
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
            ) : null}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-normal tracking-[0.2em] text-label uppercase">Shared with you</p>
            <h1 className="mt-1 text-2xl leading-tight font-bold break-words text-ink">{profile.full_name}</h1>
          </div>
        </div>

        <div className="mt-4 border-t border-subtle-line pt-4">
          <SessionTimer until={profile.session_expires_at} />
        </div>
      </div>

      <div className="mt-4 space-y-4">
        <ContactBlock title="Email" items={profile.emails} kind="email" />
        <ContactBlock title="Phone" items={profile.phones} kind="phone" />

        {profile.dob || profile.address ? (
          <section className="space-y-4 rounded-xl border border-hairline bg-white p-4">
            {profile.dob ? <Detail label="Date of birth" value={profile.dob} /> : null}
            {profile.address ? <Detail label="Address" value={profile.address} /> : null}
          </section>
        ) : null}

        <DocumentsSection slug={slug} documents={profile.documents ?? []} />

        <a
          href={`/p/${slug}/vcf`}
          download
          className={cn(buttonVariants(), 'h-12 w-full text-base')}
        >
          Save contact
        </a>

        <p className="pb-4 text-center text-xs text-label">
          What you see is limited to this visit. The profile closes by itself.
        </p>
      </div>
    </div>
  );
}
