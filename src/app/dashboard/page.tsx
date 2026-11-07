import Link from 'next/link';
import { requireOwner } from '@/lib/auth/session';
import { getProfile, loadCardData } from '@/lib/card/load';
import { ResponsiveCard } from '@/components/card/responsive-card';
import { qrPayload } from '@/lib/qr/payload';
import { Button } from '@/components/ui/button';
import { ArrowRight, QrCode, ShieldCheck, Radio } from 'lucide-react';
import { cn } from 'cn';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Overview' };

export default async function DashboardOverviewPage() {
  const owner = await requireOwner();
  const profile = await getProfile(owner.id);
  const card = profile ? await loadCardData(owner.id, profile) : null;

  return (
    <div className="min-w-0 space-y-6 lg:space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="page-title">Overview</h1>
          <p className="mt-1 text-sm text-label">
            Your digital identity, secure vault and access permissions in one place.
          </p>
        </div>
        {profile ? (
          <Button
            render={<Link href="/dashboard/customize" />}
            variant="outline"
            className="h-10 gap-2"
          >
            Customize visitor page
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        ) : null}
      </header>

      {!profile || !card ? (
        <section className="surface shadow-card p-6 sm:p-8">
          <span className="eyebrow">Getting started</span>
          <h2 className="mt-2 text-lg font-semibold tracking-tight text-ink">Create your identity card</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-label">
            Setting up your card generates a permanent QR code and a unique profile link. Both stay
            yours forever — they never change, even when you edit your details.
          </p>
          <Button
            render={<Link href="/dashboard/card" />}
            className="mt-6 h-10 gap-2 px-4 font-medium"
          >
            Create my card
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </section>
      ) : (
        <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-8">
          <section className="min-w-0 space-y-6">
            <div className="surface shadow-card p-4 sm:p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <h2 className="eyebrow">Your card</h2>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-label">
                    <Radio className="h-3 w-3" aria-hidden="true" />
                    Front
                  </span>
                </div>
                <Link
                  href="/dashboard/card"
                  className="text-xs font-medium text-label underline-offset-4 hover:text-ink hover:underline"
                >
                  Edit
                </Link>
              </div>

              <div className="flex min-w-0 justify-center rounded-xl border border-page-border bg-page p-3 sm:p-6">
                <div className="w-full max-w-3xl min-w-0">
                  <ResponsiveCard face="front" data={card} />
                </div>
              </div>
            </div>

            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
              <Link
                href="/dashboard/vault"
                className="surface shadow-card group flex flex-col p-5 transition-colors hover:border-ink/25"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-ink">
                  <ShieldCheck className="h-4.5 w-4.5" aria-hidden="true" />
                </span>
                <h3 className="mt-3 text-sm font-semibold text-ink">Document vault</h3>
                <p className="mt-1 flex-1 text-sm leading-6 text-label">
                  Store private documents and choose which ones a visitor may open.
                </p>
                <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-ink group-hover:gap-2">
                  Open vault
                  <ArrowRight className="h-3.5 w-3.5 transition-all" aria-hidden="true" />
                </span>
              </Link>

              <Link
                href="/dashboard/access"
                className="surface shadow-card group flex flex-col p-5 transition-colors hover:border-ink/25"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-ink">
                  <QrCode className="h-4.5 w-4.5" aria-hidden="true" />
                </span>
                <h3 className="mt-3 text-sm font-semibold text-ink">Access control</h3>
                <p className="mt-1 flex-1 text-sm leading-6 text-label">
                  Issue a one-time code that lets someone see your profile for a few minutes.
                </p>
                <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-ink group-hover:gap-2">
                  Manage access
                  <ArrowRight className="h-3.5 w-3.5 transition-all" aria-hidden="true" />
                </span>
              </Link>
            </div>
          </section>

          <aside className="min-w-0 space-y-6">
            <div className="surface shadow-card p-5">
              <h2 className="eyebrow">Permanent link</h2>
              <div className="mt-3 rounded-lg border border-page-border bg-page p-3 font-mono text-xs break-all text-ink">
                {qrPayload(card.slug)}
              </div>
              <p className="mt-3 text-xs leading-5 text-label">
                This address and its QR code are fixed forever. Editing your card never changes them.
              </p>
              <Button
                render={<Link href="/dashboard/card" />}
                variant="outline"
                className="mt-4 w-full justify-center gap-2 font-medium"
              >
                <QrCode className="h-4 w-4" aria-hidden="true" />
                Get QR code
              </Button>
            </div>

            <div className="surface shadow-card p-5">
              <div className="flex items-center justify-between">
                <h2 className="eyebrow">Privacy status</h2>
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium',
                    profile.is_active
                      ? 'bg-muted text-ink'
                      : 'bg-destructive/10 text-destructive',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'h-1.5 w-1.5 rounded-full',
                      profile.is_active ? 'bg-ink' : 'bg-destructive',
                    )}
                  />
                  {profile.is_active ? 'Active' : 'Disabled'}
                </span>
              </div>
              <dl className="mt-4 space-y-2.5 text-sm">
                <PrivacyRow label="Profile photo" shared={profile.show_photo} />
                <PrivacyRow label="Date of birth" shared={profile.show_dob} />
                <PrivacyRow label="Home address" shared={profile.show_address} />
              </dl>
              <Link
                href="/dashboard/card"
                className="mt-5 inline-flex text-xs font-medium text-label underline-offset-4 hover:text-ink hover:underline"
              >
                Manage privacy settings
              </Link>
            </div>

            <div className="surface shadow-card flex items-start gap-3 p-5">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-ink">
                <Radio className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-ink">Live updates</h2>
                <p className="mt-1 text-xs leading-5 text-label">
                  Changes you save here appear on an open visitor page within a second — no refresh
                  needed.
                </p>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

function PrivacyRow({ label, shared }: { label: string; shared: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-label">{label}</dt>
      <dd className={cn('font-medium', shared ? 'text-ink' : 'text-label')}>
        {shared ? 'Shared' : 'Hidden'}
      </dd>
    </div>
  );
}
