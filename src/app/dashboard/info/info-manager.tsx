'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Plus, Shield, ShieldOff, Trash2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { deleteFieldAction, addFieldAction, updateFieldAction } from './actions';
import type { FieldKind } from '@/lib/types';

export interface InformationField {
  id: string;
  kind: FieldKind;
  label: string;
  value: string;
  is_sensitive: boolean;
  is_public: boolean;
  sort: number;
}

const KIND_LABELS: Record<FieldKind, string> = {
  email: 'Email',
  phone: 'Phone',
  address: 'Address',
  family_contact: 'Family Contact',
  emergency_contact: 'Emergency',
  important_date: 'Date',
  note: 'Note',
  account_record: 'Account',
  custom: 'Custom',
};

const KINDS = Object.keys(KIND_LABELS) as FieldKind[];

export function InfoManager({ initialFields }: { initialFields: InformationField[] }) {
  const [fields, setFields] = useState(initialFields);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<InformationField | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => setFields(initialFields), [initialFields]);

  function beginAdd(kind: FieldKind = 'custom') {
    setEditing(null);
    setError(null);
    setFormOpen(true);
    requestAnimationFrame(() => {
      const kindInput = document.getElementById('field-kind') as HTMLSelectElement | null;
      if (kindInput) kindInput.value = kind;
    });
  }

  function submitField(formData: FormData) {
    setError(null);
    if (editing && !String(formData.get('value') ?? '').trim()) formData.delete('value');
    startTransition(async () => {
      const result = editing
        ? await updateFieldAction(editing.id, formData)
        : await addFieldAction(formData);
      if (!result.ok) {
        setError(result.error ?? 'Could not save this information.');
        return;
      }
      setFormOpen(false);
      setEditing(null);
      router.refresh();
    });
  }

  function updateFlag(field: InformationField, name: 'is_sensitive' | 'is_public', value: boolean) {
    const formData = new FormData();
    formData.set(name, String(value));
    startTransition(async () => {
      const result = await updateFieldAction(field.id, formData);
      if (!result.ok) setError(result.error ?? 'Could not update this information.');
      else router.refresh();
    });
  }

  function removeField(field: InformationField) {
    if (!window.confirm(`Delete "${field.label}"? This cannot be undone.`)) return;
    startTransition(async () => {
      const result = await deleteFieldAction(field.id);
      if (!result.ok) setError(result.error ?? 'Could not delete this information.');
      else router.refresh();
    });
  }

  const grouped = new Map<FieldKind, InformationField[]>();
  for (const field of fields) {
    const current = grouped.get(field.kind) ?? [];
    current.push(field);
    grouped.set(field.kind, current);
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-ink">Information Manager</h1>
          <p className="mt-1 text-sm text-label">Manage your personal data and privacy settings.</p>
        </div>
        <Button type="button" className="h-9 gap-2" onClick={() => beginAdd()}>
          <Plus className="h-4 w-4" />
          Add field
        </Button>
      </header>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {formOpen ? (
        <form
          key={editing?.id ?? 'new'}
          onSubmit={(event) => {
            event.preventDefault();
            submitField(new FormData(event.currentTarget));
          }}
          className="grid gap-4 rounded-xl border border-hairline bg-white p-5 sm:grid-cols-2"
        >
          <div className="space-y-1.5">
            <Label htmlFor="field-kind">Type</Label>
            <select
              id="field-kind"
              name="kind"
              defaultValue={editing?.kind ?? 'custom'}
              disabled={Boolean(editing)}
              className="h-9 w-full rounded-md border border-hairline bg-white px-3 text-sm"
            >
              {KINDS.map((kind) => <option key={kind} value={kind}>{KIND_LABELS[kind]}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="field-label">Label</Label>
            <Input id="field-label" name="label" required maxLength={80} defaultValue={editing?.label ?? ''} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="field-value">Value</Label>
            <Input
              id="field-value"
              name="value"
              required={!editing}
              maxLength={2000}
              placeholder={editing ? 'Leave blank to keep the current value' : 'Enter a value'}
            />
          </div>
          {!editing ? (
            <div className="flex flex-wrap gap-5 sm:col-span-2">
              <label className="flex items-center gap-2 text-sm text-label">
                <input type="checkbox" name="is_sensitive" value="true" />
                Store as sensitive (encrypted)
              </label>
              <label className="flex items-center gap-2 text-sm text-label">
                <input type="checkbox" name="is_public" value="true" />
                Share with visitors (email or phone only)
              </label>
            </div>
          ) : null}
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" disabled={pending}>{pending ? 'Saving…' : editing ? 'Save changes' : 'Add information'}</Button>
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
          </div>
        </form>
      ) : null}

      <div className="space-y-8">
        {KINDS.map((kind) => {
          const items = grouped.get(kind) ?? [];
          if (items.length === 0 && kind !== 'email' && kind !== 'phone') return null;
          return (
            <section key={kind} className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-sm font-bold uppercase tracking-wider text-label">{KIND_LABELS[kind]}</h2>
                {items.length === 0 ? (
                  <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => beginAdd(kind)}>
                    <Plus className="h-3 w-3" /> Add
                  </Button>
                ) : null}
              </div>
              <div className="overflow-hidden divide-y divide-subtle-line rounded-xl border border-hairline bg-white">
                {items.length > 0 ? items.map((field) => (
                  <div key={field.id} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold text-label">{field.label}</span>
                        {field.is_sensitive ? <Badge variant="outline" className="h-4 gap-0.5 px-1 text-[10px]"><Shield className="h-2.5 w-2.5" /> Sensitive</Badge> : null}
                        {field.is_public ? <Badge variant="outline" className="h-4 gap-0.5 px-1 text-[10px]"><Eye className="h-2.5 w-2.5" /> Public</Badge> : null}
                      </div>
                      <div className="mt-0.5 truncate font-medium text-ink">{field.is_sensitive ? '••••••••••••' : field.value}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label={`${field.is_sensitive ? 'Stop protecting' : 'Protect'} ${field.label}`} disabled={pending} onClick={() => updateFlag(field, 'is_sensitive', !field.is_sensitive)}>
                        {field.is_sensitive ? <ShieldOff className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                      </Button>
                      {kind === 'email' || kind === 'phone' ? (
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label={`${field.is_public ? 'Hide' : 'Share'} ${field.label}`} disabled={pending} onClick={() => updateFlag(field, 'is_public', !field.is_public)}>
                          {field.is_public ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      ) : null}
                      <Button type="button" variant="ghost" size="sm" className="h-8" disabled={pending} onClick={() => { setEditing(field); setFormOpen(true); setError(null); }}>
                        Edit
                      </Button>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" aria-label={`Delete ${field.label}`} disabled={pending} onClick={() => removeField(field)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )) : (
                  <div className="px-4 py-6 text-center text-sm text-label">No {KIND_LABELS[kind].toLowerCase()} added yet.</div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
