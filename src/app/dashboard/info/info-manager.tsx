'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUpDown, Eye, EyeOff, Plus, Search, Shield, ShieldOff, Trash2, X } from 'lucide-react';
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
  social_link: 'Social link',
  address: 'Address',
  family_contact: 'Family contact',
  emergency_contact: 'Emergency contact',
  important_date: 'Important date',
  note: 'Note',
  account_record: 'Account',
  custom: 'Custom',
};

const KINDS = Object.keys(KIND_LABELS) as FieldKind[];
type SortMode = 'manual' | 'label-asc' | 'label-desc' | 'type';

function canShare(kind: FieldKind) {
  return kind === 'email' || kind === 'phone' || kind === 'social_link';
}

export function InfoManager({ initialFields }: { initialFields: InformationField[] }) {
  const [fields, setFields] = useState(initialFields);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<InformationField | null>(null);
  const [selectedKind, setSelectedKind] = useState<FieldKind>('custom');
  const [query, setQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('manual');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => setFields(initialFields), [initialFields]);

  const visibleFields = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    const result = fields.filter((field) => (
      !needle
      || field.label.toLocaleLowerCase().includes(needle)
      || KIND_LABELS[field.kind].toLocaleLowerCase().includes(needle)
      || field.value.toLocaleLowerCase().includes(needle)
    ));

    return result.sort((left, right) => {
      if (sortMode === 'label-asc') return left.label.localeCompare(right.label);
      if (sortMode === 'label-desc') return right.label.localeCompare(left.label);
      if (sortMode === 'type') {
        return KIND_LABELS[left.kind].localeCompare(KIND_LABELS[right.kind]) || left.sort - right.sort;
      }
      return left.sort - right.sort || left.label.localeCompare(right.label);
    });
  }, [fields, query, sortMode]);
  const pageCount = Math.max(1, Math.ceil(visibleFields.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageFields = visibleFields.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const firstVisible = visibleFields.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const lastVisible = Math.min(currentPage * pageSize, visibleFields.length);

  useEffect(() => {
    setPage(1);
  }, [query, sortMode, pageSize]);

  function beginAdd(kind: FieldKind = 'custom') {
    setEditing(null);
    setSelectedKind(kind);
    setError(null);
    setFormOpen(true);
  }

  function beginEdit(field: InformationField) {
    setEditing(field);
    setSelectedKind(field.kind);
    setError(null);
    setFormOpen(true);
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

  return (
    <div className="min-w-0 space-y-6">
      <header className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="page-title">Information manager</h1>
          <p className="mt-1 max-w-prose text-sm text-label">
            Organize your details and choose exactly what visitors can see.
          </p>
        </div>
        <Button type="button" className="h-10 w-full gap-2 px-4 font-medium sm:w-auto" onClick={() => beginAdd()}>
          <Plus className="h-4 w-4" />
          Add information
        </Button>
      </header>

      {error ? (
        <Alert variant="destructive" role="alert">
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
          className="surface shadow-card grid min-w-0 gap-4 p-5 sm:grid-cols-2 sm:p-6"
        >
          <div className="space-y-1.5">
            <Label htmlFor="field-kind">Information type</Label>
            <select
              id="field-kind"
              name="kind"
              value={selectedKind}
              disabled={Boolean(editing)}
              onChange={(event) => setSelectedKind(event.target.value as FieldKind)}
              className="h-11 w-full rounded-lg border border-hairline bg-white px-3 text-sm text-ink"
            >
              {KINDS.map((kind) => <option key={kind} value={kind}>{KIND_LABELS[kind]}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="field-label">{selectedKind === 'social_link' ? 'Platform or link name' : 'Label'}</Label>
            <Input
              id="field-label"
              name="label"
              required
              maxLength={80}
              defaultValue={editing?.label ?? ''}
              placeholder={selectedKind === 'social_link' ? 'Instagram, Discord, or another site…' : 'e.g. Personal email'}
              className="h-11"
            />
          </div>
          <div className="min-w-0 space-y-1.5 sm:col-span-2">
            <Label htmlFor="field-value">{selectedKind === 'social_link' ? 'Profile URL' : 'Value'}</Label>
            <Input
              id="field-value"
              name="value"
              type={selectedKind === 'social_link' ? 'url' : 'text'}
              required={!editing}
              maxLength={2000}
              placeholder={editing ? 'Leave blank to keep the current value' : selectedKind === 'social_link' ? 'https://…' : 'Enter a value'}
              className="h-11 min-w-0"
            />
            {selectedKind === 'social_link' ? (
              <p className="text-xs leading-5 text-label">Use the full HTTPS profile or invite URL. Visitors can open it in a new tab.</p>
            ) : null}
          </div>
          {!editing ? (
            <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:flex-wrap sm:gap-6">
              <label className="flex min-h-11 items-center gap-2 text-sm text-label">
                <input type="checkbox" name="is_sensitive" value="true" className="h-4 w-4 accent-ink" />
                Store encrypted as sensitive
              </label>
              {canShare(selectedKind) ? (
                <label className="flex min-h-11 items-center gap-2 text-sm text-label">
                  <input type="checkbox" name="is_public" value="true" className="h-4 w-4 accent-ink" />
                  Share with visitors who have an active access code
                </label>
              ) : null}
            </div>
          ) : null}
          <div className="flex flex-col-reverse gap-2 sm:col-span-2 sm:flex-row">
            <Button type="submit" disabled={pending} className="h-11">
              {pending ? 'Saving…' : editing ? 'Save changes' : 'Add information'}
            </Button>
            <Button type="button" variant="outline" className="h-11" onClick={() => setFormOpen(false)}>Cancel</Button>
          </div>
        </form>
      ) : null}

      <section className="surface shadow-card min-w-0 overflow-hidden" aria-label="Saved information">
        <div className="flex flex-col gap-3 border-b border-hairline p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <h2 className="text-base font-semibold text-ink">Saved information</h2>
            <p className="mt-1 text-sm text-label" aria-live="polite">
              {visibleFields.length} of {fields.length} {fields.length === 1 ? 'item' : 'items'}
            </p>
          </div>
          <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(12rem,1fr)_11rem]">
            <div className="relative min-w-0">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-label" aria-hidden="true" />
              <Input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search your information"
                aria-label="Search saved information"
                className="h-11 min-w-0 pl-9 pr-9"
              />
              {query ? (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setQuery('')}
                  className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-label hover:bg-muted hover:text-ink"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
            <label className="relative">
              <span className="sr-only">Sort information</span>
              <select
                value={sortMode}
                onChange={(event) => setSortMode(event.target.value as SortMode)}
                className="h-11 w-full appearance-none rounded-lg border border-hairline bg-white pl-3 pr-9 text-sm text-ink"
              >
                <option value="manual">Custom order</option>
                <option value="label-asc">Name A to Z</option>
                <option value="label-desc">Name Z to A</option>
                <option value="type">Type</option>
              </select>
              <ArrowUpDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-label" aria-hidden="true" />
            </label>
          </div>
        </div>

        {visibleFields.length > 0 ? (
          <div role="table" aria-label="Saved personal information">
            <div
              role="row"
              className="hidden grid-cols-[minmax(9rem,1fr)_minmax(10rem,1.5fr)_minmax(7rem,0.7fr)_auto] gap-4 bg-muted/60 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-label md:grid"
            >
              <span role="columnheader">Information</span>
              <span role="columnheader">Value</span>
              <span role="columnheader">Visibility</span>
              <span role="columnheader" className="text-right">Actions</span>
            </div>
            <div className="divide-y divide-subtle-line">
              {pageFields.map((field) => (
                <div
                  key={field.id}
                  role="row"
                  className="grid min-w-0 gap-3 p-4 transition-colors hover:bg-muted/20 md:grid-cols-[minmax(9rem,1fr)_minmax(10rem,1.5fr)_minmax(7rem,0.7fr)_auto] md:items-center md:gap-4 md:px-5"
                >
                  <div role="cell" className="min-w-0">
                    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-label md:hidden">Information</span>
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                      <span className="max-w-full truncate text-sm font-semibold text-ink">{field.label}</span>
                      {field.is_sensitive ? (
                        <Badge variant="outline" className="h-5 gap-1 px-1.5 text-[10px]">
                          <Shield className="h-3 w-3" /> Sensitive
                        </Badge>
                      ) : null}
                    </div>
                    <span className="mt-1 block text-xs text-label">{KIND_LABELS[field.kind]}</span>
                  </div>
                  <div role="cell" className="min-w-0">
                    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-label md:hidden">Value</span>
                    <span className="block break-all text-sm font-medium text-ink md:truncate">
                      {field.is_sensitive ? '••••••••••••' : field.value}
                    </span>
                  </div>
                  <div role="cell" className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-label md:hidden">Visibility</span>
                    {field.is_public ? (
                      <Badge variant="outline" className="h-6 gap-1 px-2 text-[11px]">
                        <Eye className="h-3 w-3" /> Visitor
                      </Badge>
                    ) : (
                      <span className="text-xs text-label">Private</span>
                    )}
                  </div>
                  <div role="cell" className="flex flex-wrap items-center justify-end gap-1 border-t border-subtle-line pt-2 md:border-0 md:pt-0">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10"
                      aria-label={`${field.is_sensitive ? 'Stop protecting' : 'Protect'} ${field.label}`}
                      disabled={pending}
                      onClick={() => updateFlag(field, 'is_sensitive', !field.is_sensitive)}
                    >
                      {field.is_sensitive ? <ShieldOff className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                    </Button>
                    {canShare(field.kind) ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10"
                        aria-label={`${field.is_public ? 'Hide' : 'Share'} ${field.label} with visitors`}
                        disabled={pending || field.is_sensitive}
                        onClick={() => updateFlag(field, 'is_public', !field.is_public)}
                      >
                        {field.is_public ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    ) : null}
                    <Button type="button" variant="outline" size="sm" className="h-10" disabled={pending} onClick={() => beginEdit(field)}>
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 text-destructive"
                      aria-label={`Delete ${field.label}`}
                      disabled={pending}
                      onClick={() => removeField(field)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="px-5 py-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-label">
              {query ? <Search className="h-5 w-5" aria-hidden="true" /> : <Plus className="h-5 w-5" aria-hidden="true" />}
            </div>
            <h3 className="mt-4 text-sm font-semibold text-ink">{query ? 'No matching information' : 'Start building your profile'}</h3>
            <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-label">
              {query ? 'Try another name, value, or information type.' : 'Add contact details, important information, and social profiles. Nothing is shared until you choose to share it.'}
            </p>
            {query ? (
              <Button type="button" variant="outline" className="mt-4" onClick={() => setQuery('')}>Clear search</Button>
            ) : (
              <Button type="button" className="mt-4 gap-2" onClick={() => beginAdd()}>
                <Plus className="h-4 w-4" /> Add your first item
              </Button>
            )}
          </div>
        )}
        {visibleFields.length > 0 ? (
          <nav
            aria-label="Saved information pages"
            className="flex flex-col gap-3 border-t border-hairline px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5"
          >
            <p className="text-sm text-label" aria-live="polite">
              Showing {firstVisible}-{lastVisible} of {visibleFields.length}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-sm text-label">
                Rows
                <select
                  value={pageSize}
                  onChange={(event) => setPageSize(Number(event.target.value))}
                  className="h-10 rounded-lg border border-hairline bg-white px-2 text-sm text-ink"
                  aria-label="Rows per page"
                >
                  {[10, 25, 50].map((size) => <option key={size} value={size}>{size}</option>)}
                </select>
              </label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
              >
                Previous
              </Button>
              <span className="min-w-20 text-center text-sm text-label" aria-current="page">
                Page {currentPage} of {pageCount}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={currentPage >= pageCount}
                onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
              >
                Next
              </Button>
            </div>
          </nav>
        ) : null}
      </section>
    </div>
  );
}
