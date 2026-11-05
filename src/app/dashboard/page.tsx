import Link from 'next/link';
import { requireOwner } from '@/lib/auth/session';
import { getProfile, loadCardData } from '@/lib/card/load';
import { IdCard } from '@/components/card/id-card';
import { qrPayload } from '@/lib/qr/payload';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Overview' };

export default async function DashboardOverviewPage() {
  const owner = await requireOwner();
  const profile = await getProfile(owner.id);
  const card = profile ? await loadCardData(owner.id) : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Overview</h1>
        <p className="mt-1 text-sm text-label">
          One permanent QR code. Everything else is a one-time code you hand out.
        </p>
      </div>

      {!profile || !card ? (
        <section className="rounded-xl border border-hairline bg-white p-6">
          <h2 className="text-base font-bold text-ink">Set up your card</h2>
          <p className="mt-2 max-w-prose text-sm text-label">
            Your card does not exist yet. The moment you save it, one permanent profile link and QR
            code are created — and they will never change again.
          </p>
          <Link
            href="/dashboard/card"
            className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            Create my card
          </Link>
        </section>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className="rounded-xl border border-hairline bg-white p-6">
            <h2 className="text-base font-bold text-ink">Card preview</h2>
            <div className="mt-4">
              <IdCard face="front" data={card} scale={0.62} />
            </div>
            <Link
              href="/dashboard/card"
              className="mt-5 inline-block rounded-md border border-hairline px-4 py-2 text-sm font-semibold text-ink hover:bg-muted"
            >
              Edit card
            </Link>
          </section>

          <section className="space-y-6">
            <div className="rounded-xl border border-hairline bg-white p-6">
              <h2 className="text-base font-bold text-ink">Permanent link</h2>
              <p className="mt-2 text-sm break-all text-ink">{qrPayload(card.slug)}</p>
              <p className="mt-3 text-xs text-label">
                This address and its QR code are fixed for the lifetime of the app.
              </p>
            </div>

            <div className="rounded-xl border border-hairline bg-white p-6">
              <h2 className="text-base font-bold text-ink">Profile status</h2>
              <p className="mt-2 text-sm text-ink">
                {profile.is_active
                  ? 'Active — a visitor who has a code can open it.'
                  : 'Disabled — every code is refused until you switch it back on.'}
              </p>
              <p className="mt-3 text-xs text-label">
                {profile.show_photo ? 'Photo is shareable with a full-profile code. ' : 'Photo is never shared. '}
                {profile.show_dob ? 'Date of birth is shareable. ' : 'Date of birth is never shared. '}
                {profile.show_address ? 'Address is shareable.' : 'Address is never shared.'}
              </p>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
