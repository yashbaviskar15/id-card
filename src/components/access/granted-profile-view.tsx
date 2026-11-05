import { buttonVariants } from '@/components/ui/button';
import { SessionTimer } from '@/components/access/session-timer';
import { signedVisitorPhotoUrl } from '@/lib/access/visitor';
import { cn } from 'cn';
import type { GrantedProfile, GrantContactItem } from '@/lib/types';

/** wa.me and tel: both want digits and a leading plus, not punctuation. */
function whatsAppNumber(value: string): string {
  return value.replace(/[^\d]/g, '');
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

/**
 * The complete visitor view. It renders only what the database projection
 * returned for this grant's scope — Aadhaar, PAN, notes, accounts and documents
 * are not part of the projection and cannot be requested from here.
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
