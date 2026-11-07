'use client';

import { useActionState, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { initialFormState } from '@/app/(auth)/form-state';
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
    <div className="flex items-start gap-3 rounded-2xl border border-hairline p-4 transition-colors hover:bg-[#f8f9fa]">
      <input
        id={id}
        name={name}
        type="checkbox"
        defaultChecked={defaultChecked}
        className="mt-1 h-4 w-4 rounded border-hairline text-ink focus:ring-ink"
      />
      <div>
        <Label htmlFor={id} className="cursor-pointer font-bold text-ink">
          {label}
        </Label>
        <p className="mt-1 text-xs font-medium text-label">{hint}</p>
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
  const [saveState, save, saving] = useActionState(saveProfileAction, initialFormState);
  const [photoState, upload, uploading] = useActionState(uploadPhotoAction, initialFormState);
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null);

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
    <div className="min-w-0 space-y-5 sm:space-y-8">
      <form action={save} className="min-w-0 space-y-6 rounded-2xl border border-hairline bg-white p-4 shadow-sm sm:space-y-8 sm:rounded-3xl sm:p-8" noValidate>
        <div className="grid min-w-0 gap-5 sm:grid-cols-2 sm:gap-8">
          <div className="min-w-0 space-y-2.5">
            <Label htmlFor="full_name" className="text-xs font-bold uppercase tracking-widest text-label">Full name</Label>
            <Input
              id="full_name"
              name="full_name"
              defaultValue={profile?.full_name ?? ''}
              maxLength={200}
              required
              autoComplete="name"
              className="h-12 rounded-xl border-hairline focus:border-ink focus:ring-ink"
            />
            <FieldError messages={saveState.fieldErrors?.full_name} />
          </div>

          <div className="min-w-0 space-y-2.5">
            <Label htmlFor="dob" className="text-xs font-bold uppercase tracking-widest text-label">Date of birth</Label>
            <Input 
              id="dob" 
              name="dob" 
              type="date" 
              defaultValue={profile?.dob ?? ''} 
              className="h-12 rounded-xl border-hairline focus:border-ink focus:ring-ink"
            />
            <FieldError messages={saveState.fieldErrors?.dob} />
          </div>
        </div>

        <div className="min-w-0 space-y-2.5">
          <Label htmlFor="address" className="text-xs font-bold uppercase tracking-widest text-label">Address</Label>
          <Textarea 
            id="address" 
            name="address" 
            rows={3} 
            defaultValue={profile?.address ?? ''} 
            maxLength={500} 
            className="rounded-xl border-hairline focus:border-ink focus:ring-ink min-h-[100px]"
          />
          <FieldError messages={saveState.fieldErrors?.address} />
        </div>

        <fieldset className="space-y-4">
          <legend className="text-sm font-black text-ink">Visibility Settings</legend>
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
          <Alert variant="destructive" className="rounded-2xl border-2">
            <AlertDescription className="font-bold">{saveState.error}</AlertDescription>
          </Alert>
        ) : null}
        {saveState.ok && saveState.message ? (
          <Alert className="rounded-2xl border-2 border-ink bg-ink text-white">
            <AlertDescription className="font-bold">{saveState.message}</AlertDescription>
          </Alert>
        ) : null}

        <Button type="submit" className="h-12 w-full rounded-xl px-6 font-bold shadow-lg shadow-ink/10 transition-all active:scale-95 sm:h-14 sm:w-auto sm:rounded-2xl sm:px-10 sm:text-lg sm:font-black" disabled={saving}>
          {saving ? 'Saving…' : profile ? 'Save card' : 'Create my card'}
        </Button>
      </form>

      {profile ? (
        <div className="grid min-w-0 gap-4 sm:grid-cols-2 sm:gap-8">
          <form action={upload} className="min-w-0 space-y-5 rounded-2xl border border-hairline bg-white p-4 shadow-sm sm:space-y-6 sm:rounded-3xl sm:p-8">
            <div className="space-y-2.5">
              <Label htmlFor="photo" className="text-xs font-bold uppercase tracking-widest text-label">Card photo</Label>
              <div className="relative group">
                <Input
                  id="photo" 
                  name="photo" 
                  type="file" 
                  accept="image/png,image/jpeg,image/webp,image/heic,image/heif,image/tiff"
                  onChange={(event) => setSelectedPhoto(event.target.files?.[0] ?? null)}
                  className="h-14 rounded-2xl border-hairline file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-black file:bg-ink file:text-white file:cursor-pointer transition-all hover:border-ink"
                />
              </div>
              {selectedPhoto ? (
              <div className="flex items-center gap-3 rounded-xl border border-hairline bg-muted/30 p-3">
                {selectedPhotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selectedPhotoUrl}
                    alt="Selected photo preview"
                    className="h-20 w-16 shrink-0 rounded-lg border border-hairline bg-white object-contain"
                  />
                ) : (
                  <span className="flex h-20 w-16 shrink-0 items-center justify-center rounded-lg border border-hairline bg-white text-xs font-semibold text-label">Image</span>
                )}
                <p className="min-w-0 break-words text-sm font-medium text-label">
                  {selectedPhotoUrl ? 'Full photo preview, without cropping.' : 'This image will be optimized and shown after upload.'}
                </p>
              </div>
            ) : null}
              <p className="text-[10px] font-bold text-label uppercase tracking-widest">
                PNG, JPEG, WebP, HEIC, TIFF · Max 8 MB. Auto-rotated and optimized for display.
              </p>
            </div>

            {photoState.error ? (
              <Alert variant="destructive" className="rounded-2xl border-2">
                <AlertDescription className="font-bold">{photoState.error}</AlertDescription>
              </Alert>
            ) : null}
            {photoState.ok && photoState.message ? (
              <Alert className="rounded-2xl border-2 border-ink bg-ink text-white">
                <AlertDescription className="font-bold">{photoState.message}</AlertDescription>
              </Alert>
            ) : null}

            <Button type="submit" variant="outline" className="h-12 w-full rounded-xl border-2 border-ink font-black transition-all active:scale-95" disabled={uploading}>
              {uploading ? 'Uploading…' : 'Upload photo'}
            </Button>
          </form>

          {hasPhoto ? (
            <form action={removePhotoAction} className="flex min-w-0 flex-col justify-between gap-5 rounded-2xl border border-hairline bg-white p-4 shadow-sm sm:rounded-3xl sm:p-8">
              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-black text-ink">Current photo</h3>
                  <p className="mt-1 text-sm font-medium text-label">The complete image is shown without cropping.</p>
                </div>
                {photoUrl ? (
                  <div className="flex min-h-44 items-center justify-center overflow-hidden rounded-xl border border-hairline bg-muted/30 p-2">
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
              <Button type="submit" variant="outline" className="mt-6 h-12 w-full rounded-xl border-2 border-destructive text-destructive font-black transition-all hover:bg-destructive hover:text-white active:scale-95">
                Remove photo
              </Button>
            </form>
          ) : (
             <div className="flex items-center justify-center rounded-2xl border-2 border-dashed border-hairline bg-[#f8f9fa] p-6 sm:rounded-3xl sm:p-8">
               <p className="text-sm font-bold text-label/40 uppercase tracking-widest">No photo uploaded</p>
             </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
