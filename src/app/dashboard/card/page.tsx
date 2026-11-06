import Link from 'next/link';
import { requireOwner } from '@/lib/auth/session';
import { getProfile, loadCardData } from '@/lib/card/load';
import { qrPayload } from '@/lib/qr/payload';
import { ResponsiveCard } from '@/components/card/responsive-card';
import { CardForm } from './card-form';

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
  const card = profile ? await loadCardData(owner.id) : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Card &amp; QR</h1>
        <p className="mt-1 max-w-prose text-sm text-label">
          The card and its QR code are generated from what you save here. The QR encodes only your
          permanent link — editing anything below never changes it.
        </p>
      </div>

      {card ? (
        <>
          <section className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-3">
              <h2 className="text-sm font-semibold tracking-wide text-label uppercase">Front</h2>
              <div className="rounded-[32px] border border-hairline shadow-[0_10px_30px_rgba(17,24,39,0.10)]">
                <ResponsiveCard face="front" data={card} />
              </div>
            </div>
            <div className="space-y-3">
              <h2 className="text-sm font-semibold tracking-wide text-label uppercase">Back</h2>
              <div className="rounded-[32px] border border-hairline shadow-[0_10px_30px_rgba(17,24,39,0.10)]">
                <ResponsiveCard face="back" data={card} />
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-hairline bg-white p-6">
            <h2 className="text-base font-bold text-ink">Permanent link</h2>
            <p className="mt-2 text-sm break-all text-ink">{qrPayload(card.slug)}</p>
            <p className="mt-2 text-xs text-label">
              Rendered on demand from this exact URL. No QR image is ever stored.
            </p>

            <h3 className="mt-6 text-sm font-semibold text-ink">Download the QR</h3>
            <ul className="mt-3 flex flex-wrap gap-2">
              {DOWNLOADS.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    className="inline-block rounded-md border border-hairline px-3 py-2 text-sm font-semibold text-ink hover:bg-muted"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>

            <h3 className="mt-6 text-sm font-semibold text-ink">Export the card</h3>
            <ul className="mt-3 flex flex-wrap gap-2">
              {EXPORTS.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    className="inline-block rounded-md border border-hairline px-3 py-2 text-sm font-semibold text-ink hover:bg-muted"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-label">
              ID-1 size, 85.60 × 53.98 mm. Exports are drawn at 300 DPI (1011 × 638 px).
            </p>
          </section>
        </>
      ) : (
        <section className="rounded-xl border border-hairline bg-white p-6">
          <h2 className="text-base font-bold text-ink">Your card does not exist yet</h2>
          <p className="mt-2 max-w-prose text-sm text-label">
            Save your details below to create it. The permanent link and QR code are generated once
            and can never change — so take a moment to make sure the details are right.
          </p>
        </section>
      )}

      <CardForm profile={profile} hasPhoto={Boolean(profile?.photo_path)} />

      <p className="text-xs text-label">
        Looking for the profile URL for a print run?{' '}
        <Link href="/dashboard" className="underline underline-offset-4">
          It is on the overview page
        </Link>
        .
      </p>
    </div>
  );
}
