import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const manifest = JSON.parse(
  readFileSync(new URL('../../public/manifest.webmanifest', import.meta.url), 'utf8'),
) as {
  name: string;
  short_name: string;
  display: string;
  orientation: string;
  icons: Array<{ src: string; purpose: string }>;
};

describe('installed app branding', () => {
  it('uses compact dedicated app icons without changing browser favicon assets', () => {
    expect(manifest).toMatchObject({
      name: 'Private Identity',
      short_name: 'Private Identity',
      display: 'standalone',
      orientation: 'any',
    });
    expect(manifest.icons.map((icon) => icon.src)).toEqual([
      '/icons/icon-32.png',
      '/icons/pwa-icon-192.png',
      '/icons/pwa-icon-512.png',
      '/icons/pwa-maskable-512.png',
    ]);
    expect(manifest.icons[0]?.purpose).toBe('any');
    expect(manifest.icons[3]?.purpose).toBe('maskable');
  });
});
