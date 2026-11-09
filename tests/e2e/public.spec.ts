import { expect, test } from '@playwright/test';

/**
 * Real, DB-free smoke tests for the unauthenticated surfaces. Each assertion is
 * something that must hold with an empty database and no Supabase project.
 */
test.describe('public unauthenticated surfaces', () => {
  test('login page renders the sign-in form wired to the server action', async ({ page }) => {
    await page.goto('/login');

    const form = page.locator('form');
    await expect(form).toBeVisible();
    await expect(page.getByLabel('Email address')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
    await expect(page.getByText('You are offline')).toHaveCount(0);

    // The form must POST through a Next.js server action rather than a plain
    // client-side handler: the framework either emits an `action` attribute or
    // injects a hidden `$ACTION_*` reference input.
    const actionAttr = await form.getAttribute('action');
    const actionRefs = await form.locator('input[name^="$ACTION"]').count();
    expect(Boolean(actionAttr) || actionRefs > 0).toBe(true);

    // The sign-in page must never leak a profile.
    await expect(page.locator('img[alt^="Profile photo of"]')).toHaveCount(0);
  });

  test('profile lock screen shows only the code prompt and no profile data', async ({ page }) => {
    // A slug that cannot match the stored shape still renders the exact same
    // lock screen, so this proves the leak-free state without any database.
    await page.goto('/p/not-a-real-slug');

    await expect(page.locator('#code')).toBeVisible();
    // The one and only heading is the prompt — no owner name anywhere.
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('h1')).toHaveText('Unlock this profile');

    // None of the granted-profile view's markers reach the HTML or RSC payload.
    await expect(page.locator('img[alt^="Profile photo of"]')).toHaveCount(0);
    const html = await page.content();
    expect(html).not.toContain('Profile photo of');
  });

  test('share link with a bad token shows the generic not-available state', async ({ page }) => {
    // Too short to be a valid share token, so it takes the single path that
    // every expired, revoked or exhausted link also takes.
    await page.goto('/s/bad');

    await expect(page.getByRole('heading', { name: 'This link is not available' })).toBeVisible();
    await expect(
      page.getByText('It may have expired, been revoked or reached its download limit.'),
    ).toBeVisible();
  });

  test('dashboard redirects to login when unauthenticated', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForURL(/\/login/);

    const url = new URL(page.url());
    expect(url.pathname).toBe('/login');
    expect(url.searchParams.get('next')).toBe('/dashboard');
  });
});

test.describe('flows that need a live Supabase project', () => {
  test.skip('signing in with real credentials lands on the dashboard', () => {
    // Requires a provisioned Supabase project, the OWNER_EMAIL account and its
    // password. Skipped on purpose: this suite must not fabricate a backend.
  });

  test.skip('an unlocked profile renders the owner details after a valid code', () => {
    // Requires a stored profile, a freshly issued access code and the resulting
    // grant cookie — none of which exist without a database.
  });

  test.skip('a password-protected share link opens with the right password', () => {
    // Requires a live share link row and its password hash in Supabase.
  });
});
