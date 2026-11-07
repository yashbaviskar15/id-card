import { z } from 'zod';
import { SLUG_PATTERN } from '@/lib/slug';

/* ------------------------------- primitives ------------------------------- */

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ message: 'Enter a valid email address.' }));

export const slugSchema = z.string().regex(SLUG_PATTERN, 'Invalid profile link.');

export const accessCodeSchema = z.string().regex(/^\d{8}$/, 'Enter the 8-digit code.');

export const scopeSchema = z.enum(['contact', 'full']);

export const validityMinutesSchema = z.coerce
  .number()
  .int()
  .min(1, 'Minimum 1 minute.')
  .max(30, 'Maximum 30 minutes.');

/** Unchecked checkboxes are simply absent from the form data, so this is false. */
export const includeDocumentsSchema = z.coerce.boolean();

/* ------------------------------ password policy --------------------------- */

/**
 * A short local deny-list of the most common passwords. The authoritative check
 * is Supabase's leaked-password protection; this is the in-form guard so the
 * user gets immediate feedback.
 */
const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password123', 'passw0rd', '123456789012', '1234567890123',
  'qwertyuiop12', 'qwerty123456', 'letmein12345', 'iloveyou1234', 'admin1234567',
  'welcome12345', 'monkey123456', 'dragon123456', 'football1234', 'baseball1234',
  'sunshine1234', 'princess1234', 'trustno11234', 'changeme1234', '1qaz2wsx3edc',
  'aaaaaaaaaaaa', 'qwertyuiopas', 'asdfghjklzxc', 'zxcvbnmasdfg', 'passwordpassword',
]);

const REPEATED = /^(.)\1+$/;
const SEQUENTIAL = /^(?:0123456789|1234567890|abcdefghij|qwertyuiop)/i;

export interface PasswordAssessment {
  score: 0 | 1 | 2 | 3 | 4;
  label: 'Very weak' | 'Weak' | 'Fair' | 'Strong' | 'Very strong';
  acceptable: boolean;
  problems: string[];
}

export function assessPassword(password: string): PasswordAssessment {
  const problems: string[] = [];
  const lower = password.toLowerCase();

  if (password.length < 12) problems.push('Use at least 12 characters.');
  if (COMMON_PASSWORDS.has(lower)) problems.push('This is one of the most common passwords.');
  if (REPEATED.test(password)) problems.push('Avoid repeating a single character.');
  if (SEQUENTIAL.test(password)) problems.push('Avoid simple sequences.');

  const classes =
    Number(/[a-z]/.test(password)) +
    Number(/[A-Z]/.test(password)) +
    Number(/\d/.test(password)) +
    Number(/[^A-Za-z0-9]/.test(password));

  let score = 0;
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;
  if (classes >= 3) score += 1;
  if (classes === 4 && password.length >= 14) score += 1;
  if (problems.length > 0) score = 0;
  const clamped = Math.min(4, score) as 0 | 1 | 2 | 3 | 4;
  const labels: PasswordAssessment['label'][] = ['Very weak', 'Weak', 'Fair', 'Strong', 'Very strong'];

  return {
    score: clamped,
    label: labels[clamped],
    acceptable: problems.length === 0,
    problems,
  };
}

export const passwordSchema = z
  .string()
  .min(12, 'Use at least 12 characters.')
  .max(200, 'That password is too long.')
  .superRefine((value, ctx) => {
    const assessment = assessPassword(value);
    for (const problem of assessment.problems) {
      ctx.addIssue({ code: 'custom', message: problem });
    }
  });

/* ------------------------------- dashboard -------------------------------- */

export const profileUpdateSchema = z.object({
  full_name: z.string().trim().min(1, 'Name is required.').max(200),
  dob: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD.')
    .optional()
    .or(z.literal('')),
  address: z.string().trim().max(500).optional().or(z.literal('')),
  show_dob: z.coerce.boolean(),
  show_address: z.coerce.boolean(),
  show_photo: z.coerce.boolean(),
  is_active: z.coerce.boolean(),
});

export const fieldInputSchema = z.object({
  kind: z.enum([
    'email', 'phone', 'social_link', 'address', 'family_contact', 'emergency_contact',
    'important_date', 'note', 'account_record', 'custom',
  ]),
  label: z.string().trim().max(80).optional().or(z.literal('')),
  value: z.string().trim().max(2000).optional().or(z.literal('')),
  is_public: z.coerce.boolean().default(false),
  is_sensitive: z.coerce.boolean().default(false),
  sort: z.coerce.number().int().default(0),
});

export const categoryInputSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.').max(60),
});

export const shareLinkInputSchema = z.object({
  document_id: z.uuid(),
  expires_in_minutes: z.coerce.number().int().min(5).max(60 * 24 * 30),
  password: z.string().max(200).optional().or(z.literal('')),
  max_downloads: z.coerce.number().int().min(1).max(1000).optional(),
});

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
export type FieldInput = z.infer<typeof fieldInputSchema>;
