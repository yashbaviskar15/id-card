import { z } from 'zod';

/**
 * Client-safe environment. Only NEXT_PUBLIC_* values are read here, so this
 * module is safe to import from both server and client components.
 *
 * Build gate: scripts/check-env.mjs (npm `prebuild`) fails the build when
 * NEXT_PUBLIC_SITE_URL is missing or malformed. The QR code is derived from this
 * exact value and must never change afterwards.
 */
const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  NEXT_PUBLIC_SITE_URL: z
    .url()
    .refine((v) => v.startsWith('https://'), 'NEXT_PUBLIC_SITE_URL must use https://')
    .refine((v) => !v.endsWith('/'), 'NEXT_PUBLIC_SITE_URL must not end with "/"'),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1).optional(),
});

export type ClientEnv = z.infer<typeof clientSchema>;

function readClientEnv(): ClientEnv {
  const parsed = clientSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || undefined,
  });
  if (!parsed.success) {
    const detail = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid client environment: ${detail}`);
  }
  return parsed.data;
}

export const clientEnv: ClientEnv = readClientEnv();

/** Absolute origin of the single permanent QR code, e.g. https://id.example.com */
export const siteUrl = clientEnv.NEXT_PUBLIC_SITE_URL;

export const turnstileEnabled = Boolean(clientEnv.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
