'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { initialFormState, type FormState } from '@/app/(auth)/form-state';
import { runOrQueue } from '@/lib/offline/run';
import { useOffline } from '@/components/offline/offline-provider';
import { OnlineRequiredNotice } from '@/components/offline/online-notice';
import type { ProfileRow } from '@/lib/types';
import { removePhotoAction, saveProfileAction, uploadPhotoAction } from './actions';

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="mt-1 text-xs text-destructive">{messages[0]}</p>;
}

function Toggle({
  id,
  name,
  label,
  hint,
  defaultChecked,
}: {
  id: string;
  name: string;
  label: string;
  hint: string;
  defaultChecked: boolean;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-hairline p-3.5 transition-colors hover:bg-muted/40">
      <input
        id={id}
        name={name}
        type="checkbox"
        defaultChecked={defaultChecked}
        className="mt-1 h-4 w-4 rounded border-hairline text-ink focus:ring-ink"
      />
      <div>
        <Label htmlFor={id} className="cursor-pointer font-medium text-ink">
          {label}
        </Label>
        <p className="mt-0.5 text-xs text-label">{hint}</p>
      </div>
    </div>
  );
}

export function CardForm({
  profile,
  hasPhoto,
  photoUrl,
}: {
  profile: ProfileRow | null;
  hasPhoto: boolean;
  photoUrl: string | null;
}) {
  const router = useRouter();
  const [saveState, setSaveState] = useState<FormState>(initialFormState);
  const [saving, setSaving] = useState(false);
  const { online } = useOffline();
  const [photoState, upload, uploading] = useActionState(uploadPhotoAction, initialFormState);
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null);

  async function handleSave(formData: FormData) {
    setSaveState({ ok: false });
    setSaving(true);
    const payload: Record<string, string> = {};
    for (const [key, value] of formData.entries()) {
      if (typeof value === 'string') payload[key] = value;
    }
    try {
      const outcome = await runOrQueue({
        kind: 'profile.save',
        label: 'Card',
        payload,
        run: () => saveProfileAction(initialFormState, formData),
      });
      if (!outcome.result.ok) {
        setSaveState({ ok: false, error: outcome.result.error ?? 'Could not save the profile.' });
        return;
      }
      if (outcome.queued) {
        setSaveState({
          ok: true,
          message: 'Saved on this device. The card will sync when you are back online.',
        });
        return;
      }
      setSaveState(outcome.result as FormState);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (photoState.ok) router.refresh();
  }, [photoState, router]);

  useEffect(() => {
    if (!selectedPhoto || !/\.(jpe?g|png|webp)$/i.test(selectedPhoto.name)) {
      setSelectedPhotoUrl(null);
      return;
    }
    const url = URL.createObjectURL(selectedPhoto);
    setSelectedPhotoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedPhoto]);

  return (
    <div className="min-w-0 space-y-6 lg:space-y-8">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void handleSave(new FormData(event.currentTarget));
        }}
        className="surface shadow-card min-w-0 space-y-6 p-5 sm:space-y-7 sm:p-7"
        noValidate
      >
        <div className="grid min-w-0 gap-5 sm:grid-cols-2 sm:gap-6">
          <div className="min-w-0 space-y-2">
            <Label htmlFor="full_name" className="font-medium text-ink">Full name</Label>
            <Input
              id="full_name"
              name="full_name"
              defaultValue={profile?.full_name ?? ''}
              maxLength={200}
              required
              autoComplete="name"
              className="h-11 border-hairline focus:border-ink focus:ring-ink"
            />
            <FieldError messages={saveState.fieldErrors?.full_name} />
          </div>

          <div className="min-w-0 space-y-2">
            <Label htmlFor="dob" className="font-medium text-ink">Date of birth</Label>
            <Input 
              id="dob" 
              name="dob" 
              type="date" 
              defaultValue={profile?.dob ?? ''} 
              className="h-11 border-hairline focus:border-ink focus:ring-ink"
            />
            <FieldError messages={saveState.fieldErrors?.dob} />
          </div>
        </div>

        <div className="min-w-0 space-y-2">
          <Label htmlFor="address" className="font-medium text-ink">Address</Label>
          <Textarea 
            id="address" 
            name="address" 
            rows={3} 
            defaultValue={profile?.address ?? ''} 
            maxLength={500} 
            className="min-h-[96px] border-hairline focus:border-ink focus:ring-ink"
          />
          <FieldError messages={saveState.fieldErrors?.address} />
        </div>

        <fieldset className="space-y-4">
          <legend className="eyebrow">Visibility settings</legend>
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
            <Toggle
              id="show_photo"
              name="show_photo"
              label="Share the photo"
              hint="Only with a full-profile code."
              defaultChecked={profile?.show_photo ?? false}
            />
            <Toggle
              id="show_dob"
              name="show_dob"
              label="Share the date of birth"
              hint="Only with a full-profile code."
              defaultChecked={profile?.show_dob ?? false}
            />
            <Toggle
              id="show_address"
              name="show_address"
              label="Share the address"
              hint="Only with a full-profile code."
              defaultChecked={profile?.show_address ?? false}
            />
            <Toggle
              id="is_active"
              name="is_active"
              label="Profile is active"
              hint="Instantly refuse every code."
              defaultChecked={profile?.is_active ?? true}
            />
          </div>
        </fieldset>

        {saveState.error ? (
          <Alert variant="destructive">
            <AlertDescription>{saveState.error}</AlertDescription>
          </Alert>
        ) : null}
        {saveState.ok && saveState.message ? (
          <Alert>
            <AlertDescription>{saveState.message}</AlertDescription>
          </Alert>
        ) : null}

        <Button type="submit" className="h-10 w-full px-5 font-medium sm:w-auto" disabled={saving}>
          {saving ? 'Saving…' : profile ? 'Save card' : 'Create my card'}
        </Button>
      </form>

      {profile ? (
        <div className="grid min-w-0 gap-6 sm:grid-cols-2 lg:gap-8">
          <form action={upload} className="surface shadow-card min-w-0 space-y-5 p-5 sm:p-7">
            <div className="space-y-2">
              <p className="eyebrow">Card photo</p>
              <div className="flex min-h-14 min-w-0 items-center gap-3 rounded-lg border border-hairline bg-white px-3 transition-colors focus-within:border-ink focus-within:ring-2 focus-within:ring-ink/10">
                <Input
                  id="photo"
                  name="photo"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/heic,image/heif,image/tiff"
                  onChange={(event) => setSelectedPhoto(event.target.files?.[0] ?? null)}
                  aria-describedby="photo-help"
                  className="peer sr-only"
                />
                <Label
                  htmlFor="photo"
                  className="inline-flex min-h-10 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-ink px-4 text-sm font-semibold text-white transition-colors hover:bg-ink/85 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink"
                >
                  Choose photo
                </Label>
                <span className="min-w-0 truncate text-sm text-label" aria-live="polite">
                  {selectedPhoto?.name ?? 'No file chosen'}
                </span>
              </div>
              {selectedPhoto ? (
              <div className="flex items-center gap-3 rounded-lg border border-hairline bg-muted/30 p-3">
                {selectedPhotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selectedPhotoUrl}
                    alt="Selected photo preview"
                    className="h-20 w-16 shrink-0 rounded-lg border border-hairline bg-white object-contain"
                  />
                ) : (
                  <span className="flex h-20 w-16 shrink-0 items-center justify-center rounded-lg border border-hairline bg-white text-xs font-medium text-label">Image</span>
                )}
                <p className="min-w-0 break-words text-sm text-label">
                  {selectedPhotoUrl ? 'Full photo preview, without cropping.' : 'This image will be optimized and shown after upload.'}
                </p>
              </div>
            ) : null}
              <p id="photo-help" className="text-xs leading-5 text-label">
                PNG, JPEG, WebP, HEIC, TIFF · Max 8 MB. Auto-rotated and optimized for display.
              </p>
            </div>

            {photoState.error ? (
              <Alert variant="destructive">
                <AlertDescription>{photoState.error}</AlertDescription>
              </Alert>
            ) : null}
            {photoState.ok && photoState.message ? (
              <Alert>
                <AlertDescription>{photoState.message}</AlertDescription>
              </Alert>
            ) : null}

            <Button type="submit" variant="outline" className="h-10 w-full font-medium" disabled={uploading || !online}>
              {uploading ? 'Uploading…' : 'Upload photo'}
            </Button>
            <OnlineRequiredNotice>
              Photo upload needs an internet connection. Your other card details still save offline.
            </OnlineRequiredNotice>
          </form>

          {hasPhoto ? (
            <form action={removePhotoAction} className="surface shadow-card flex min-w-0 flex-col justify-between gap-5 p-5 sm:p-7">
              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-ink">Current photo</h3>
                  <p className="mt-1 text-sm text-label">The complete image is shown without cropping.</p>
                </div>
                {photoUrl ? (
                  <div className="flex min-h-44 items-center justify-center overflow-hidden rounded-lg border border-hairline bg-muted/30 p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photoUrl}
                      alt="Current card photo"
                      className="max-h-56 w-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ) : null}
              </div>
              <Button type="submit" variant="outline" className="h-10 w-full font-medium text-destructive hover:bg-destructive hover:text-white" disabled={!online}>
                Remove photo
              </Button>
              <OnlineRequiredNotice>
                Removing a photo needs an internet connection.
              </OnlineRequiredNotice>
            </form>
          ) : (
             <div className="flex items-center justify-center rounded-xl border border-dashed border-hairline bg-muted/20 p-6 sm:p-7">
               <p className="text-sm text-label">No photo uploaded</p>
             </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
