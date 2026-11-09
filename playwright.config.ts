import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end smoke tests.
 *
 * These specs are deliberately DB-free: they exercise the public entry points
 * that must behave correctly with no data at all — the login screen, the
 * profile lock screen, the share "not available" state and the dashboard
 * redirect. Anything that needs a real Supabase project is marked `test.skip`
 * with a reason, so the suite never pretends to verify what it cannot.
 *
 * baseURL comes from E2E_BASE_URL (or PLAYWRIGHT_BASE_URL) and defaults to the
 * local dev/production port. The production server is started best-effort: it
 * expects a prior `npm run build`, which this suite intentionally does not run.
 * Set E2E_NO_WEB_SERVER=1 to point the tests at a server you started yourself.
 */
const baseURL =
  process.env.E2E_BASE_URL || process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: process.env.E2E_NO_WEB_SERVER
    ? undefined
    : {
        command: process.env.E2E_WEB_SERVER_COMMAND ?? 'npm run start',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        stdout: 'pipe',
        stderr: 'pipe',
      },
});
