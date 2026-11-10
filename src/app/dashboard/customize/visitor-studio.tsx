'use client';

import { useActionState, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Check, Eye, ExternalLink, FileText, LayoutTemplate, Mail, Palette, Phone, Type } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { initialFormState } from '@/app/(auth)/form-state';
import type { VisitorLayout, VisitorTheme } from '@/lib/types';
import { saveVisitorPresentationAction } from './actions';

const THEMES: {
  id: VisitorTheme;
  label: string;
  note: string;
  header: string;
  swatch: string;
}[] = [
  { id: 'ink', label: 'Ink', note: 'Quiet and classic', header: 'bg-ink', swatch: 'bg-ink' },
  { id: 'ocean', label: 'Ocean', note: 'Calm blue', header: 'bg-sky-800', swatch: 'bg-sky-700' },
  { id: 'forest', label: 'Forest', note: 'Muted green', header: 'bg-emerald-800', swatch: 'bg-emerald-700' },
];

const LAYOUTS: { id: VisitorLayout; label: string; note: string }[] = [
  { id: 'standard', label: 'Balanced', note: 'A spacious two-column page' },
  { id: 'compact', label: 'Compact', note: 'A narrower, single-column page' },
];

export function VisitorStudio({
  initial,
}: {
  initial: {
    fullName: string;
    theme: VisitorTheme;
    layout: VisitorLayout;
    intro: string;
    contacts: { kind: 'email' | 'phone' | 'social_link'; label: string; value: string }[];
    fullDetails: { photo: boolean; dob: boolean; address: boolean };
    sharedDocuments: number;
  };
}) {
  const [state, action, pending] = useActionState(saveVisitorPresentationAction, initialFormState);
  const [theme, setTheme] = useState(initial.theme);
  const [layout, setLayout] = useState(initial.layout);
  const [intro, setIntro] = useState(initial.intro);
  const [previewScope, setPreviewScope] = useState<'contact' | 'full'>('contact');

  useEffect(() => {
    setTheme(initial.theme);
    setLayout(initial.layout);
    setIntro(initial.intro);
  }, [initial]);

  const selectedTheme = THEMES.find((option) => option.id === theme) ?? THEMES[0];
  const compact = layout === 'compact';
  const showFullDetails = previewScope === 'full'
    ? Object.values(initial.fullDetails).some(Boolean)
    : false;

  return (
    <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(24rem,0.95fr)] xl:gap-7">
      <form action={action} className="surface shadow-card min-w-0 space-y-7 p-5 sm:p-7">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-ink">
            <Palette className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-ink">Visitor page design</h2>
            <p className="mt-1 text-sm leading-5 text-label">Small, accessible choices. No custom code or external assets.</p>
          </div>
        </div>

        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-ink">Choose a colour</legend>
          <div className="grid gap-2 sm:grid-cols-3" aria-label="Visitor page colour">
            {THEMES.map((option) => {
              const selected = theme === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setTheme(option.id)}
                  className={`flex min-h-16 items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                    selected ? 'border-ink bg-muted/60 ring-1 ring-ink' : 'border-hairline hover:bg-muted/30'
                  }`}
                >
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${option.swatch} text-white`}>
                    {selected ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-ink">{option.label}</span>
                    <span className="block text-xs text-label">{option.note}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <input type="hidden" name="visitor_theme" value={theme} />
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-ink">Page layout</legend>
          <div className="grid gap-2 sm:grid-cols-2" aria-label="Visitor page layout">
            {LAYOUTS.map((option) => {
              const selected = layout === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setLayout(option.id)}
                  className={`flex min-h-16 items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                    selected ? 'border-ink bg-muted/60 ring-1 ring-ink' : 'border-hairline hover:bg-muted/30'
                  }`}
                >
                  <LayoutTemplate className="h-5 w-5 shrink-0 text-label" aria-hidden="true" />
                  <span>
                    <span className="block text-sm font-semibold text-ink">{option.label}</span>
                    <span className="block text-xs text-label">{option.note}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <input type="hidden" name="visitor_layout" value={layout} />
        </fieldset>

        <div className="space-y-2">
          <div className="flex items-end justify-between gap-3">
            <Label htmlFor="visitor-intro" className="flex items-center gap-2 font-semibold text-ink">
              <Type className="h-4 w-4" aria-hidden="true" />
              Short introduction
            </Label>
            <span className="text-xs tabular-nums text-label">{intro.length}/180</span>
          </div>
          <Textarea
            id="visitor-intro"
            name="visitor_intro"
            value={intro}
            maxLength={180}
            rows={3}
            onChange={(event) => setIntro(event.target.value)}
            placeholder="A short note visitors should know about you…"
            aria-describedby="visitor-intro-hint"
            className="min-h-24 resize-y"
          />
          <p id="visitor-intro-hint" className="text-xs leading-5 text-label">
            Plain text only. Keep sensitive details out; this appears to every visitor with an active code.
          </p>
          {state.fieldErrors?.visitor_intro?.[0] ? (
            <p className="text-xs text-destructive">{state.fieldErrors.visitor_intro[0]}</p>
          ) : null}
        </div>

        {state.error ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}
        {state.ok && state.message ? (
          <Alert role="status">
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-col-reverse gap-2 border-t border-subtle-line pt-5 sm:flex-row sm:items-center">
          <Button type="submit" disabled={pending} className="h-11 gap-2 px-5">
            {pending ? 'Saving…' : 'Save visitor page'}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11"
            onClick={() => {
              setTheme(initial.theme);
              setLayout(initial.layout);
              setIntro(initial.intro);
            }}
            disabled={pending}
          >
            Reset changes
          </Button>
        </div>
      </form>

      <section className="min-w-0 space-y-3 xl:sticky xl:top-6" aria-label="Live visitor page preview">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="eyebrow">Live preview</p>
            <h2 className="mt-1 text-base font-semibold text-ink">What a visitor sees</h2>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-white px-2.5 py-1 text-xs text-label">
            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            Preview
          </span>
        </div>
        <div className="flex flex-wrap gap-2" aria-label="Preview access scope">
          {(['contact', 'full'] as const).map((scope) => (
            <Button
              key={scope}
              type="button"
              size="sm"
              variant={previewScope === scope ? 'default' : 'outline'}
              aria-pressed={previewScope === scope}
              onClick={() => setPreviewScope(scope)}
            >
              {scope === 'contact' ? 'Contact code' : 'Full-profile code'}
            </Button>
          ))}
        </div>

        <div className={`pin-light surface shadow-card mx-auto w-full overflow-hidden transition-all ${compact ? 'max-w-xl' : 'max-w-3xl'}`}>
          <div className={`flex items-center justify-between gap-2 px-4 py-3 text-white sm:px-5 ${selectedTheme.header}`}>
            <span className="text-sm font-medium">Private identity</span>
            <span className="rounded-full border border-white/25 bg-white/10 px-2.5 py-1 text-[11px]">Temporary access</span>
          </div>
          <div className={`flex items-center gap-4 ${compact ? 'p-4' : 'p-6 sm:p-8'}`}>
            <div className={`flex shrink-0 items-center justify-center rounded-xl border border-hairline bg-muted text-xl font-semibold text-label ${compact ? 'h-14 w-14' : 'h-20 w-20'}`}>
              {initial.fullName.trim().slice(0, 1).toUpperCase() || 'Y'}
            </div>
            <div className="min-w-0">
              <p className="eyebrow">Shared with you</p>
              <h3 className="mt-1 truncate text-xl font-semibold tracking-tight text-ink">{initial.fullName}</h3>
              <p className="mt-1 text-xs text-label">Session ends in 9:54</p>
            </div>
          </div>
          {intro.trim() ? (
            <p className={`mx-4 mb-4 rounded-lg border border-hairline bg-muted/30 text-sm leading-6 text-label ${compact ? 'p-3' : 'mx-6 mb-6 p-4 sm:mx-8'}`}>
              {intro}
            </p>
          ) : null}
          <div className={`grid gap-3 border-t border-subtle-line bg-page ${compact ? 'grid-cols-1 p-4' : 'sm:grid-cols-2 p-4 sm:p-6'}`}>
            <div className="min-w-0 rounded-xl border border-hairline bg-white p-4">
              <p className="text-sm font-semibold text-ink">Contact information</p>
              {initial.contacts.length > 0 ? (
                <ul className="mt-3 space-y-3">
                  {initial.contacts.map((contact, index) => {
                    const Icon = contact.kind === 'email' ? Mail : contact.kind === 'phone' ? Phone : ExternalLink;
                    return (
                      <li key={`${contact.kind}-${index}`} className="flex min-w-0 items-start gap-2">
                        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-label" aria-hidden="true" />
                        <span className="min-w-0">
                          <span className="block text-[11px] text-label">{contact.label || contact.kind}</span>
                          <span className="block break-all text-xs font-medium text-ink">{contact.value}</span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-2 text-xs leading-5 text-label">No contact or social items are marked to share.</p>
              )}
            </div>
            {showFullDetails ? (
              <div className="rounded-xl border border-hairline bg-white p-4">
                <p className="text-sm font-semibold text-ink">Additional information</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {initial.fullDetails.photo ? <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-label">Photo</span> : null}
                  {initial.fullDetails.dob ? <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-label">Date of birth</span> : null}
                  {initial.fullDetails.address ? <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-label">Address</span> : null}
                </div>
                <p className="mt-3 text-xs text-label">Only shown for a full-profile code when each switch is enabled.</p>
              </div>
            ) : null}
            {initial.sharedDocuments > 0 ? (
              <div className="rounded-xl border border-hairline bg-white p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <FileText className="h-4 w-4" aria-hidden="true" />
                  Shared documents
                </p>
                <p className="mt-2 text-xs text-label">
                  {initial.sharedDocuments} {initial.sharedDocuments === 1 ? 'file' : 'files'} marked shared; each code must also opt in.
                </p>
              </div>
            ) : null}
          </div>
        </div>
        <p className="text-xs leading-5 text-label">
          Preview uses only non-sensitive fields you already marked public. Full-only data is never shown in contact-code mode.
        </p>
        <Link href="/dashboard/info" className="inline-flex items-center gap-1 text-xs font-medium text-ink underline underline-offset-4">
          Manage the information shown
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </section>
    </div>
  );
}
