'use client';

import { useActionState, useState } from 'react';
import { ArrowLeft, IdCard, Images, LockKeyhole, ShieldCheck } from 'lucide-react';
import { BrandMark } from '@/components/brand/brand-mark';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { initialFormState } from '@/app/(auth)/form-state';
import { submitAccessCodeAction, submitPhotoAlbumAccessAction } from './actions';

type Mode = 'choose' | 'profile' | 'photos';

/**
 * The only thing an unopened profile ever serves: a choice between the two
 * things the owner can share from one link — the contact profile and the
 * private photo album. Nothing about the owner is rendered here, so no name,
 * photo or detail can reach the HTML or the RSC payload before a code (and, for
 * the album, the owner's password) is verified.
 */
export function LockScreen({ slug }: { slug: string }) {
  const [mode, setMode] = useState<Mode>('choose');

  return (
    <main className="bg-page flex min-h-dvh items-center justify-center px-4 py-10 sm:px-6">
      <div className="w-full max-w-md">
        <header className="mb-6 flex items-center justify-center gap-3">
          <BrandMark />
          <div className="text-left">
            <p className="text-sm font-semibold text-ink">Private Identity</p>
            <p className="text-xs text-label">Secure contact sharing</p>
          </div>
        </header>

        <section className="surface shadow-card p-6 sm:p-8">
          {mode === 'choose' ? (
            <ChoiceStep onChoose={setMode} />
          ) : (
            <UnlockStep slug={slug} mode={mode} onBack={() => setMode('choose')} />
          )}
        </section>
        <p className="mt-5 text-center text-xs leading-5 text-label">
          Shared details stay private and are available only for the active session.
        </p>
      </div>
    </main>
  );
}

function ChoiceStep({ onChoose }: { onChoose: (mode: Exclude<Mode, 'choose'>) => void }) {
  return (
    <>
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-ink">
        <LockKeyhole className="h-5 w-5" aria-hidden="true" />
      </div>
      <div className="mt-5 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-muted/60 px-3 py-1 text-xs font-medium text-label">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          Private access
        </span>
        <h1 className="mt-3 text-xl font-semibold tracking-tight text-ink sm:text-2xl">What would you like to open?</h1>
        <p className="mt-2 text-sm leading-6 text-label">
          Choose what the owner has shared with you. The profile opens with a one-time code; private photos need that
          code and the owner&apos;s album password.
        </p>
      </div>

      <div className="mt-7 grid gap-3">
        <button
          type="button"
          onClick={() => onChoose('profile')}
          className="group flex items-center gap-4 rounded-2xl border border-hairline bg-white p-4 text-left transition-colors hover:border-ink/30 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted text-ink">
            <IdCard className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-ink">View profile</span>
            <span className="mt-0.5 block text-xs text-label">Open the shared contact details with a one-time code.</span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => onChoose('photos')}
          className="group flex items-center gap-4 rounded-2xl border border-hairline bg-white p-4 text-left transition-colors hover:border-ink/30 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted text-ink">
            <Images className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-ink">Private photos</span>
            <span className="mt-0.5 block text-xs text-label">
              Encrypted album. Requires the code and the owner&apos;s album password. View only.
            </span>
          </span>
        </button>
      </div>
    </>
  );
}

function UnlockStep({
  slug,
  mode,
  onBack,
}: {
  slug: string;
  mode: Exclude<Mode, 'choose'>;
  onBack: () => void;
}) {
  const [submitted, setSubmitted] = useState(false);
  const [profileState, submitProfile, profilePending] = useActionState(submitAccessCodeAction, initialFormState);
  const [albumState, submitAlbum, albumPending] = useActionState(submitPhotoAlbumAccessAction, initialFormState);
  const isPhotos = mode === 'photos';

  const state = isPhotos ? albumState : profileState;
  const pending = isPhotos ? albumPending : profilePending;

  return (
    <>
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-label transition-colors hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        Back
      </button>

      <div className="mt-4 flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-ink">
          {isPhotos ? <Images className="h-5 w-5" aria-hidden="true" /> : <IdCard className="h-5 w-5" aria-hidden="true" />}
        </span>
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-ink">
            {isPhotos ? 'Open private photos' : 'Unlock this profile'}
          </h1>
          <p className="text-xs text-label">
            {isPhotos ? 'Enter the code and the album password.' : 'Enter the one-time access code.'}
          </p>
        </div>
      </div>

      <form
        action={isPhotos ? submitAlbum : submitProfile}
        className="mt-6 space-y-4"
        noValidate
        onSubmit={() => setSubmitted(true)}
      >
        <input type="hidden" name="slug" value={slug} />

        <div className="space-y-1.5">
          <label htmlFor="code" className="text-xs font-semibold uppercase tracking-[0.09em] text-label">
            8-digit access code
          </label>
          <input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={12}
            required
            autoFocus
            placeholder="0000 0000"
            aria-invalid={Boolean(state.error && submitted) || undefined}
            onChange={() => setSubmitted(false)}
            className="tnum h-14 w-full rounded-xl border border-hairline bg-white text-center text-2xl font-semibold tracking-[0.24em] text-ink placeholder:text-label/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
          />
        </div>

        {isPhotos ? (
          <div className="space-y-1.5">
            <label htmlFor="password" className="text-xs font-semibold uppercase tracking-[0.09em] text-label">
              Album password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={200}
              placeholder="Owner's album password"
              aria-invalid={Boolean(state.error && submitted) || undefined}
              onChange={() => setSubmitted(false)}
              className="h-12 w-full rounded-xl border border-hairline bg-white px-4 text-sm text-ink placeholder:text-label/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
            />
          </div>
        ) : null}

        {state.error && submitted ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}

        <Button type="submit" className="h-11 w-full font-medium" disabled={pending}>
          {pending ? 'Verifying…' : isPhotos ? 'Open photos' : 'Unlock profile'}
        </Button>
      </form>

      <p className="mt-4 text-center text-xs leading-5 text-label">
        {isPhotos
          ? 'Photos are shown view-only and are never downloadable.'
          : 'This code can be used once and expires after a few minutes.'}
      </p>
    </>
  );
}
