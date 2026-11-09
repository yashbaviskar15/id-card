import Link from 'next/link';
import { requireOwner } from '@/lib/auth/session';
import { getProfile, loadCardData } from '@/lib/card/load';
import { qrPayload } from '@/lib/qr/payload';
import { ResponsiveCard } from '@/components/card/responsive-card';
import { CardForm } from './card-form';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Card & QR' };

const DOWNLOADS = [
  { href: '/api/qr?format=png&size=1024', label: 'QR · PNG 1024 px' },
  { href: '/api/qr?format=svg', label: 'QR · SVG' },
  { href: '/api/qr?format=png&size=3000', label: 'QR · PNG 3000 px (print)' },
] as const;

const EXPORTS = [
  { href: '/api/export/card?format=png&face=front', label: 'Card front · PNG 300 DPI' },
  { href: '/api/export/card?format=png&face=back', label: 'Card back · PNG 300 DPI' },
  { href: '/api/export/card?format=png&face=front&bleed=1', label: 'Card front · PNG + 3 mm bleed' },
  { href: '/api/export/card?format=png&face=back&bleed=1', label: 'Card back · PNG + 3 mm bleed' },
  { href: '/api/export/card?format=pdf&face=both', label: 'Card · PDF (front + back)' },
  { href: '/api/export/card?format=pdf&face=both&bleed=1', label: 'Card · PDF + 3 mm bleed' },
] as const;

export default async function CardPage() {
  const owner = await requireOwner('/dashboard/card');
  const profile = await getProfile(owner.id);
  const card = profile ? await loadCardData(owner.id, profile) : null;

  return (
    <div className="w-full min-w-0 space-y-5 lg:space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="page-title">Card &amp; QR</h1>
          <p className="mt-1 max-w-prose text-sm text-label">
            The card and its QR code are generated from what you save here. The QR encodes only your
            permanent link — editing anything below never changes it.
          </p>
        </div>
        {profile ? (
          <Button
            render={<Link href="/dashboard/customize" />}
            variant="outline"
            className="h-10 gap-2"
          >
            Customize visitor page
          </Button>
        ) : null}
      </header>

      {card ? (
        <>
          <section aria-label="Card previews" className="grid w-full min-w-0 gap-5 2xl:grid-cols-2 2xl:gap-6">
            <div className="min-w-0 space-y-3">
              <h2 className="eyebrow">Front</h2>
              <div className="surface shadow-card mx-auto w-full max-w-[872px] min-w-0 overflow-hidden p-1">
                <ResponsiveCard face="front" data={card} />
              </div>
            </div>
            <div className="min-w-0 space-y-3">
              <h2 className="eyebrow">Back</h2>
              <div className="surface shadow-card mx-auto w-full max-w-[872px] min-w-0 overflow-hidden p-1">
                <ResponsiveCard face="back" data={card} />
              </div>
            </div>
          </section>

          <section className="surface shadow-card min-w-0 p-5 sm:p-7">
            <div className="flex flex-col gap-8 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0 max-w-md">
                <h2 className="text-sm font-semibold text-ink">Permanent link</h2>
                <div className="mt-3 min-w-0 rounded-lg border border-page-border bg-page p-3 font-mono text-xs break-all text-ink sm:text-sm">
                  {qrPayload(card.slug)}
                </div>
                <p className="mt-3 text-xs leading-5 text-label">
                  Rendered on demand from this exact URL. No QR image is ever stored.
                </p>
              </div>

              <div className="min-w-0 flex-1 space-y-6">
                <div>
                  <h3 className="eyebrow">Download the QR</h3>
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {DOWNLOADS.map((item) => (
                      <li key={item.href}>
                        <a
                          href={item.href}
                          className="inline-flex min-h-9 max-w-full items-center rounded-lg border border-hairline bg-white px-3 py-2 text-xs font-medium text-ink transition-colors hover:border-ink hover:bg-muted"
                        >
                          {item.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="eyebrow">Export the card</h3>
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {EXPORTS.map((item) => (
                      <li key={item.href}>
                        <a
                          href={item.href}
                          className="inline-flex min-h-9 max-w-full items-center rounded-lg border border-hairline bg-white px-3 py-2 text-xs font-medium text-ink transition-colors hover:border-ink hover:bg-muted"
                        >
                          {item.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-xs text-label">
                    ID-1 size, 85.60 × 53.98 mm · 300 DPI
                  </p>
                </div>
              </div>
            </div>
          </section>
        </>
      ) : (
        <section className="surface shadow-card p-6 sm:p-8">
          <span className="eyebrow">Getting started</span>
          <h2 className="mt-2 text-lg font-semibold tracking-tight text-ink">Your card does not exist yet</h2>
          <p className="mt-2 max-w-prose text-sm leading-6 text-label">
            Save your details below to create it. The permanent link and QR code are generated once
            and can never change — so take a moment to make sure the details are right.
          </p>
        </section>
      )}

      <CardForm
        profile={profile}
        hasPhoto={Boolean(profile?.photo_path)}
        photoUrl={card?.photoUrl ?? null}
      />

      <p className="text-xs text-label">
        Looking for the profile URL for a print run?{' '}
        <Link href="/dashboard" className="font-medium text-ink underline underline-offset-4">
          It is on the overview page
        </Link>
        .
      </p>
    </div>
  );
}
