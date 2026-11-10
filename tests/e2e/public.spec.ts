import { expect, test } from '@playwright/test';
import sharp from 'sharp';

function metaContent(html: string, attribute: 'name' | 'property', key: string) {
  const tag = html.match(
    new RegExp(`<meta\\b(?=[^>]*\\b${attribute}="${key}")[^>]*>`, 'i'),
  )?.[0];
  return tag?.match(/\bcontent="([^"]*)"/i)?.[1];
}

function linkHref(html: string, rel: string) {
  const tag = html.match(new RegExp(`<link\\b(?=[^>]*\\brel="${rel}")[^>]*>`, 'i'))?.[0];
  return tag?.match(/\bhref="([^"]*)"/i)?.[1];
}

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

  test('share preview metadata is in SSR HTML and its public assets are reachable', async ({ page }) => {
    const response = await page.goto('/s/bad');
    expect(response?.status()).toBe(200);
    const html = await response!.text();

    expect(html).toMatch(/<title>[^<]+<\/title>/i);
    expect(metaContent(html, 'name', 'description')).toBeTruthy();
    expect(metaContent(html, 'property', 'og:title')).toBe('Secure file sharing');
    expect(metaContent(html, 'property', 'og:description')).toContain('private file');
    expect(metaContent(html, 'property', 'og:type')).toBe('website');
    expect(metaContent(html, 'property', 'og:site_name')).toBe('Private Identity');
    expect(metaContent(html, 'property', 'og:locale')).toBe('en_US');
    expect(metaContent(html, 'property', 'og:image:width')).toBe('1200');
    expect(metaContent(html, 'property', 'og:image:height')).toBe('630');
    expect(metaContent(html, 'property', 'og:image:alt')).toBeTruthy();
    expect(metaContent(html, 'name', 'twitter:card')).toBe('summary_large_image');
    expect(metaContent(html, 'name', 'twitter:title')).toBe('Secure file sharing');
    expect(metaContent(html, 'name', 'twitter:description')).toContain('private file');

    const ogUrl = metaContent(html, 'property', 'og:url');
    const ogImage = metaContent(html, 'property', 'og:image');
    const twitterImage = metaContent(html, 'name', 'twitter:image');
    const canonical = linkHref(html, 'canonical');
    const icon = linkHref(html, 'icon');
    const appleIcon = linkHref(html, 'apple-touch-icon');
    const manifest = linkHref(html, 'manifest');
    const absoluteUrls = [ogUrl, ogImage, twitterImage, canonical, icon, appleIcon, manifest];

    for (const value of absoluteUrls) {
      expect(value).toBeTruthy();
      expect(new URL(value!).protocol).toBe('https:');
    }
    expect(new URL(ogUrl!).pathname).toBe('/s/bad');
    expect(new URL(canonical!).pathname).toBe('/s/bad');

    const origin = new URL(page.url()).origin;
    for (const value of absoluteUrls) {
      const resourceUrl = new URL(new URL(value!).pathname, origin);
      const resource = await page.request.get(resourceUrl.toString());
      expect(resource.status(), `${resourceUrl.pathname} should be public`).toBe(200);
    }

    const imageResponse = await page.request.get(
      new URL(new URL(ogImage!).pathname, origin).toString(),
    );
    const imageBytes = await imageResponse.body();
    const imageInfo = await sharp(imageBytes).metadata();
    expect(imageInfo).toMatchObject({ format: 'jpeg', width: 1200, height: 630 });
    expect(imageBytes.byteLength).toBeLessThan(300_000);

    const robotsResponse = await page.request.get(new URL('/robots.txt', origin).toString());
    expect(robotsResponse.status()).toBe(200);
    expect(await robotsResponse.text()).toContain('Allow: /');
  });

  test('other public pages emit absolute server-rendered metadata without private slugs', async ({
    page,
  }) => {
    for (const path of ['/', '/login', '/forgot', '/p/private-person-slug']) {
      const response = await page.goto(path);
      expect(response?.status(), `${path} should render`).toBe(200);
      const html = await response!.text();
      const canonical = linkHref(html, 'canonical');
      const ogUrl = metaContent(html, 'property', 'og:url');
      const image = metaContent(html, 'property', 'og:image');

      expect(html).toMatch(/<title>[^<]+<\/title>/i);
      expect(metaContent(html, 'name', 'description')).toBeTruthy();
      expect(metaContent(html, 'property', 'og:title')).toBeTruthy();
      expect(metaContent(html, 'property', 'og:description')).toBeTruthy();
      expect(new URL(image!).protocol).toBe('https:');
      expect(new URL(image!).pathname).toBe(
        path.startsWith('/p/') ? '/logo.png' : '/og/private-identity.jpg',
      );
      expect(metaContent(html, 'name', 'twitter:card')).toBe('summary_large_image');
      expect(metaContent(html, 'name', 'twitter:title')).toBeTruthy();
      expect(metaContent(html, 'name', 'twitter:description')).toBeTruthy();
      expect(new URL(metaContent(html, 'name', 'twitter:image')!).protocol).toBe('https:');
      expect(new URL(canonical!).protocol).toBe('https:');
      expect(new URL(ogUrl!).protocol).toBe('https:');
      expect(new URL(canonical!).pathname).toBe(path);
      expect(new URL(ogUrl!).pathname).toBe(path);

      if (path.startsWith('/p/')) {
        expect(metaContent(html, 'name', 'description')).toBe('Securely shared contact');
        expect(metaContent(html, 'property', 'og:title')).toBe('Private Identity');
        expect(metaContent(html, 'property', 'og:description')).toBe('Securely shared contact');
        expect(new URL(image!).pathname).toBe('/logo.png');
        expect(new URL(metaContent(html, 'name', 'twitter:image')!).pathname).toBe('/logo.png');
        expect(metaContent(html, 'property', 'og:title')).not.toContain('private-person-slug');
        expect(metaContent(html, 'property', 'og:description')).not.toContain('private-person-slug');
      }
    }
  });

  test('login layout has no horizontal overflow from phone to desktop widths', async ({ page }) => {
    for (const width of [320, 375, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/login');
      const dimensions = await page.evaluate(() => ({
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
      }));
      expect(dimensions.documentWidth, `overflow at ${width}px`).toBeLessThanOrEqual(
        dimensions.viewportWidth,
      );
    }
  });

  test('public profile route has no horizontal overflow at requested widths', async ({ page }) => {
    for (const width of [320, 390, 768, 1280, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/p/not-a-real-slug');
      const dimensions = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(dimensions.scrollWidth, `document scrollWidth at ${width}px`).toBe(dimensions.clientWidth);
    }
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
