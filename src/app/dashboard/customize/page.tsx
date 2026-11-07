import Link from 'next/link';
import { ArrowRight, Eye, KeyRound, LockKeyhole, ShieldCheck } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { requireOwner } from '@/lib/auth/session';
import { getProfile } from '@/lib/card/load';
import { createUserClient } from '@/lib/db/user';
import { VisitorStudio } from './visitor-studio';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Customize visitor page' };

export default async function CustomizePage() {
  const owner = await requireOwner('/dashboard/customize');
  const [profile, supabase] = await Promise.all([
    getProfile(owner.id),
    createUserClient(),
  ]);

  const [fieldsResult, documentsResult] = await Promise.all([
    supabase
      .from('fields')
      .select('kind, label, value, is_public, is_sensitive')
      .eq('owner_id', owner.id),
    supabase
      .from('documents')
      .select('is_shared')
      .eq('owner_id', owner.id),
  ]);

  const shareableItems = (fieldsResult.data ?? []).filter(
    (field) => field.is_public && !field.is_sensitive
      && ['email', 'phone', 'social_link'].includes(field.kind),
  ).length;
  const previewContacts = (fieldsResult.data ?? [])
    .filter((field) => field.is_public && !field.is_sensitive
      && ['email', 'phone', 'social_link'].includes(field.kind)
      && typeof field.value === 'string')
    .map((field) => ({
      kind: field.kind as 'email' | 'phone' | 'social_link',
      label: field.label ?? '',
      value: field.value ?? '',
    }));
  const sharedDocuments = (documentsResult.data ?? []).filter((document) => document.is_shared).length;

  return (
    <div className="min-w-0 space-y-6 lg:space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Your public presentation</p>
          <h1 className="page-title mt-1">Profile Studio</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-label">
            Shape the visitor page with a few considered choices. Your access rules and private data
            stay protected separately.
          </p>
        </div>
        {profile ? (
          <Button
            render={<Link href={`/p/${profile.slug}`} target="_blank" rel="noreferrer noopener" />}
            variant="outline"
            className="min-h-10 gap-2"
          >
            <Eye className="h-4 w-4" aria-hidden="true" />
            Open visitor page
          </Button>
        ) : null}
      </header>

      {profile ? (
        <VisitorStudio
          initial={{
            fullName: profile.full_name,
            theme: profile.visitor_theme,
            layout: profile.visitor_layout,
            intro: profile.visitor_intro,
            contacts: previewContacts,
            fullDetails: {
              photo: profile.show_photo,
              dob: profile.show_dob,
              address: profile.show_address,
            },
            sharedDocuments,
          }}
        />
      ) : (
        <section className="surface shadow-card p-6 sm:p-8">
          <span className="eyebrow">First, create your identity</span>
          <h2 className="mt-2 text-lg font-semibold text-ink">Your visitor page starts with your card</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-label">
            Save your name and profile details once. Then you can customize the visitor experience here.
          </p>
          <Button render={<Link href="/dashboard/card" />} className="mt-5 gap-2">
            Set up my card
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </section>
      )}

      {fieldsResult.error || documentsResult.error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>
            Some sharing counts or preview items could not be loaded. Your sharing permissions remain unchanged.
          </AlertDescription>
        </Alert>
      ) : null}

      <section aria-labelledby="sharing-heading">
        <div className="mb-3">
          <h2 id="sharing-heading" className="text-base font-semibold text-ink">Visitor sharing controls</h2>
          <p className="mt-1 text-sm text-label">Presentation is separate from permission. Review what a visitor is allowed to receive.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <ControlLink
            href="/dashboard/info"
            icon={Eye}
            title="Contact & social"
            value={`${shareableItems} shareable ${shareableItems === 1 ? 'item' : 'items'}`}
            detail="Choose which safe fields appear."
          />
          <ControlLink
            href="/dashboard/card"
            icon={LockKeyhole}
            title="Private details"
            value={`${[profile?.show_photo, profile?.show_dob, profile?.show_address].filter(Boolean).length} of 3 enabled`}
            detail="Full-profile codes only."
          />
          <ControlLink
            href="/dashboard/vault"
            icon={ShieldCheck}
            title="Shared documents"
            value={`${sharedDocuments} marked shared`}
            detail="Each access code opts in separately."
          />
          <ControlLink
            href="/dashboard/access"
            icon={KeyRound}
            title="Access codes"
            value="Scope and expiry"
            detail="Choose what each guest can view."
          />
        </div>
      </section>

      <p className="text-xs leading-5 text-label">
        Visitor changes appear in active sessions automatically. A visual theme never grants access to
        private fields, documents, or profile details.
      </p>
    </div>
  );
}

function ControlLink({
  href,
  icon: Icon,
  title,
  value,
  detail,
}: {
  href: string;
  icon: typeof Eye;
  title: string;
  value: string;
  detail: string;
}) {
  return (
    <Link
      href={href}
      className="surface shadow-card group min-w-0 p-4 transition-colors hover:border-ink/30 focus-visible:outline-offset-2"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-ink">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <ArrowRight className="h-4 w-4 text-label transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </div>
      <h3 className="mt-3 text-sm font-semibold text-ink">{title}</h3>
      <p className="mt-1 text-xs font-medium text-ink">{value}</p>
      <p className="mt-1 text-xs leading-5 text-label">{detail}</p>
    </Link>
  );
}
