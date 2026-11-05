import 'server-only';
import { z } from 'zod';

/**
 * Server-only environment. Never import this from a client component: the
 * `server-only` import makes such a build fail, which is exactly what we want.
 */
const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  SUPABASE_DB_URL: z.string().min(1).optional(),
  OWNER_EMAIL: z.email(),
  OWNER_EMAIL_ALIASES: z.string().optional(),
  ACCESS_CODE_SECRET: z.string().min(32),
  SESSION_COOKIE_SECRET: z.string().min(32),
  IP_HASH_SECRET: z.string().min(32),
  FIELD_ENCRYPTION_KEYS: z.string().min(20),
  FIELD_ENCRYPTION_ACTIVE_KEY: z.string().min(1),
  TURNSTILE_SECRET_KEY: z.string().min(1).optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  ALERT_FROM_EMAIL: z.email().optional(),
  ALERT_TO_EMAIL: z.email().optional(),
  MAX_UPLOAD_MB: z.coerce.number().int().positive().default(50),
  SHARE_LINK_TTL_MINUTES: z.coerce.number().int().positive().default(1440),
  OWNER_SESSION_IDLE_MINUTES: z.coerce.number().int().positive().default(30),
  OWNER_SESSION_ABSOLUTE_DAYS: z.coerce.number().int().positive().default(7),
  ACCESS_SESSION_MINUTES: z.coerce.number().int().positive().default(15),
});

export type ServerEnv = z.infer<typeof serverSchema>;

/**
 * A variable that is listed but left blank (exactly what .env.example produces
 * when an optional value is not filled in) arrives as an empty string, not as
 * undefined — and `''` fails `.min(1).optional()`. Every blank value is therefore
 * normalised to "unset" before validation, so an unconfigured optional feature
 * degrades gracefully instead of taking the whole app down at runtime.
 */
function withBlanksAsUnset(source: NodeJS.ProcessEnv): Record<string, unknown> {
  const normalised: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    normalised[key] = value === undefined || value.trim() === '' ? undefined : value;
  }
  return normalised;
}

let cached: ServerEnv | null = null;

export function serverEnv(): ServerEnv {
  if (!cached) {
    const parsed = serverSchema.safeParse(withBlanksAsUnset(process.env));
    if (!parsed.success) {
      const detail = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
      throw new Error(`Invalid server environment: ${detail}. See SETUP.md for instructions.`);
    }
    cached = parsed.data;
  }
  return cached;
}

export function ownerEmailAllowList(): string[] {
  const env = serverEnv();
  const aliases = (env.OWNER_EMAIL_ALIASES ?? '')
    .split(',')
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
  return Array.from(new Set([env.OWNER_EMAIL.toLowerCase(), ...aliases]));
}

export function isOwnerEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ownerEmailAllowList().includes(email.trim().toLowerCase());
}
