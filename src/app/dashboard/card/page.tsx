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
    <div className="min-w-0 space-y-5 sm:space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Card &amp; QR</h1>
        <p className="mt-1 max-w-prose text-sm text-label">
          The card and its QR code are generated from what you save here. The QR encodes only your
          permanent link — editing anything below never changes it.
        </p>
      </div>

      {card ? (
        <>
          <section className="grid min-w-0 gap-5 lg:grid-cols-2 lg:gap-8">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-ink/20" />
                <h2 className="text-[10px] font-bold tracking-[0.25em] text-label uppercase">Front</h2>
              </div>
              <div className="min-w-0 overflow-hidden rounded-2xl border border-hairline bg-white p-1 shadow-[0_20px_50px_rgba(17,24,39,0.08)] transition-transform md:hover:scale-[1.01] md:rounded-[32px]">
                <ResponsiveCard face="front" data={card} />
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-ink/20" />
                <h2 className="text-[10px] font-bold tracking-[0.25em] text-label uppercase">Back</h2>
              </div>
              <div className="min-w-0 overflow-hidden rounded-2xl border border-hairline bg-white p-1 shadow-[0_20px_50px_rgba(17,24,39,0.08)] transition-transform md:hover:scale-[1.01] md:rounded-[32px]">
                <ResponsiveCard face="back" data={card} />
              </div>
            </div>
          </section>

          <section className="min-w-0 rounded-2xl border border-hairline bg-white p-4 shadow-sm sm:rounded-3xl sm:p-8">
            <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0 max-w-md">
                <h2 className="text-lg font-black text-ink">Permanent link</h2>
                <div className="mt-3 min-w-0 break-all rounded-xl border border-hairline bg-[#f8f9fa] p-3 font-mono text-xs text-ink sm:rounded-2xl sm:p-4 sm:text-sm">
                  {qrPayload(card.slug)}
                </div>
                <p className="mt-3 text-xs font-medium text-label">
                  Rendered on demand from this exact URL. No QR image is ever stored.
                </p>
              </div>

              <div className="min-w-0 flex-1 space-y-6 sm:space-y-8">
                <div>
                  <h3 className="text-sm font-bold text-ink uppercase tracking-wider">Download the QR</h3>
                  <ul className="mt-4 flex flex-wrap gap-2">
                    {DOWNLOADS.map((item) => (
                      <li key={item.href}>
                        <a
                          href={item.href}
                          className="inline-block rounded-full border-2 border-hairline px-5 py-2 text-sm font-bold text-ink transition-all hover:border-ink hover:bg-ink hover:text-white active:scale-95"
                        >
                          {item.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-ink uppercase tracking-wider">Export the card</h3>
                  <ul className="mt-4 flex flex-wrap gap-3">
                    {EXPORTS.map((item) => (
                      <li key={item.href}>
                        <a
                          href={item.href}
                          className="inline-block rounded-full border-2 border-hairline px-5 py-2 text-sm font-bold text-ink transition-all hover:border-ink hover:bg-ink hover:text-white active:scale-95"
                        >
                          {item.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-4 text-[10px] font-bold text-label uppercase tracking-widest">
                    ID-1 size, 85.60 × 53.98 mm · 300 DPI
                  </p>
                </div>
              </div>
            </div>
          </section>
        </>
      ) : (
        <section className="rounded-3xl border border-hairline bg-white p-8 shadow-sm">
          <h2 className="text-xl font-black text-ink">Your card does not exist yet</h2>
          <p className="mt-3 max-w-prose text-sm font-medium leading-relaxed text-label">
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
