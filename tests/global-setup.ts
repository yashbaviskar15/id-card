import { existsSync } from 'node:fs';

/**
 * Loads .env.local / .env once for the whole test run and reports which
 * integration environment variables are available, so tests that need a real
 * Supabase project can skip with an explicit reason instead of failing.
 */
export default function globalSetup() {
  for (const file of ['.env.local', '.env']) {
    if (existsSync(file)) {
      try {
        process.loadEnvFile(file);
      } catch {
        /* handled by scripts/check-env.mjs */
      }
    }
  }

  const required = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_DB_URL'];
  const missing = required.filter((name) => !process.env[name]?.trim());
  if (missing.length) {
    console.warn(
      `\n[test] integration environment incomplete — missing: ${missing.join(', ')}\n` +
        '[test] integration/DB suites will report as SKIPPED (not verified).\n',
    );
  }
}
