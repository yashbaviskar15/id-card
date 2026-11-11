import { z } from 'zod';
import type { AccessScope } from '@/lib/types';

/**
 * Quick-access presets: named combinations of scope / validity / documents that
 * the owner can hand out in one click. Stored as JSON on owner_settings and
 * validated on both write and read so a malformed value can never be trusted.
 */
export const MAX_QUICK_PRESETS = 12;

export const quickPresetSchema = z.object({
  id: z.string().min(1).max(40),
  label: z.string().trim().min(1).max(40),
  scope: z.enum(['contact', 'full']),
  validity_minutes: z.coerce.number().int().min(1).max(30),
  include_documents: z.coerce.boolean().default(false),
});

export type QuickPreset = z.infer<typeof quickPresetSchema>;

export const quickPresetsSchema = z.array(quickPresetSchema).max(MAX_QUICK_PRESETS);

/** Shown (and usable) before the owner has saved any of their own. */
export const DEFAULT_QUICK_PRESETS: QuickPreset[] = [
  { id: 'default-contact-5', label: 'Contact · 5 min', scope: 'contact', validity_minutes: 5, include_documents: false },
  { id: 'default-full-15', label: 'Full · 15 min', scope: 'full', validity_minutes: 15, include_documents: false },
];

/** Tolerant parse of a stored jsonb value; anything unexpected becomes []. */
export function parseQuickPresets(value: unknown): QuickPreset[] {
  const parsed = quickPresetsSchema.safeParse(value);
  return parsed.success ? parsed.data : [];
}

/** Presets to offer: the owner's own, or the built-in defaults when none exist. */
export function effectiveQuickPresets(stored: unknown): QuickPreset[] {
  const own = parseQuickPresets(stored);
  return own.length > 0 ? own : DEFAULT_QUICK_PRESETS;
}

export interface GrantDraft {
  scope: AccessScope;
  validityMinutes: number;
  includeDocuments: boolean;
}

/**
 * Defaults the form should start from: the last code the owner handed out
 * ("last settings"), falling back to their configured privacy defaults.
 */
export function lastUsedDefaults(input: {
  lastScope: string | null;
  lastValidityMinutes: number | null;
  lastIncludeDocuments: boolean;
  fallbackScope: AccessScope;
  fallbackValidity: number;
}): GrantDraft {
  return {
    scope: input.lastScope === 'full' || input.lastScope === 'contact' ? input.lastScope : input.fallbackScope,
    validityMinutes: input.lastValidityMinutes ?? input.fallbackValidity,
    includeDocuments: input.lastIncludeDocuments,
  };
}
