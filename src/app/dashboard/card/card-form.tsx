'use client';

import { useActionState } from 'react';
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
    <div className="flex items-start gap-3 rounded-lg border border-hairline p-3">
      <input
        id={id}
        name={name}
        type="checkbox"
        defaultChecked={defaultChecked}
        className="mt-0.5 h-4 w-4 accent-[#111827]"
      />
      <div>
        <Label htmlFor={id} className="cursor-pointer">
          {label}
        </Label>
        <p className="mt-0.5 text-xs text-label">{hint}</p>
      </div>
    </div>
  );
}

export function CardForm({ profile, hasPhoto }: { profile: ProfileRow | null; hasPhoto: boolean }) {
  const [saveState, save, saving] = useActionState(saveProfileAction, initialFormState);
  const [photoState, upload, uploading] = useActionState(uploadPhotoAction, initialFormState);

  return (
    <div className="space-y-6">
      <form action={save} className="space-y-5 rounded-xl border border-hairline bg-white p-6" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="full_name">Full name</Label>
          <Input
            id="full_name"
            name="full_name"
            defaultValue={profile?.full_name ?? ''}
            maxLength={200}
            required
            autoComplete="name"
          />
          <FieldError messages={saveState.fieldErrors?.full_name} />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="dob">Date of birth</Label>
            <Input id="dob" name="dob" type="date" defaultValue={profile?.dob ?? ''} />
            <FieldError messages={saveState.fieldErrors?.dob} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="address">Address</Label>
            <Textarea id="address" name="address" rows={3} defaultValue={profile?.address ?? ''} maxLength={500} />
            <FieldError messages={saveState.fieldErrors?.address} />
          </div>
        </div>

        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-ink">What a full-profile code may show</legend>
          <Toggle
            id="show_photo"
            name="show_photo"
            label="Share the photo"
            hint="Only with a full-profile code. Never with a contact-only code."
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
        </fieldset>

        <Toggle
          id="is_active"
          name="is_active"
          label="Profile is active"
          hint="Turn this off to refuse every code instantly. The QR code is not affected."
          defaultChecked={profile?.is_active ?? true}
        />

        {saveState.error ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{saveState.error}</AlertDescription>
          </Alert>
        ) : null}
        {saveState.ok && saveState.message ? (
          <Alert role="status">
            <AlertDescription>{saveState.message}</AlertDescription>
          </Alert>
        ) : null}

        <Button type="submit" className="h-11" disabled={saving}>
          {saving ? 'Saving…' : profile ? 'Save card' : 'Create my card'}
        </Button>
      </form>

      {profile ? (
        <form action={upload} className="space-y-4 rounded-xl border border-hairline bg-white p-6">
          <div className="space-y-1.5">
            <Label htmlFor="photo">Card photo</Label>
            <Input id="photo" name="photo" type="file" accept="image/png,image/jpeg,image/webp,image/heic,image/tiff" />
            <p className="text-xs text-label">
              PNG, JPEG, WebP, HEIC or TIFF, up to 8 MB. Stored privately; only ever shown through a
              signed link.
            </p>
          </div>

          {photoState.error ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{photoState.error}</AlertDescription>
            </Alert>
          ) : null}
          {photoState.ok && photoState.message ? (
            <Alert role="status">
              <AlertDescription>{photoState.message}</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Button type="submit" variant="outline" className="h-11" disabled={uploading}>
              {uploading ? 'Uploading…' : 'Upload photo'}
            </Button>
          </div>
        </form>
      ) : null}

      {profile && hasPhoto ? (
        <form action={removePhotoAction} className="rounded-xl border border-hairline bg-white p-6">
          <p className="text-sm text-label">Remove the current photo from the card.</p>
          <Button type="submit" variant="outline" className="mt-3 h-11">
            Remove photo
          </Button>
        </form>
      ) : null}
    </div>
  );
}
