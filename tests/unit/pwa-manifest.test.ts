import { readFileSync } from 'node:fs';
import sharp from 'sharp';
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
  it('uses versioned full-bleed app icons without changing browser favicon assets', () => {
    expect(manifest).toMatchObject({
      name: 'Private Identity',
      short_name: 'Private Identity',
      display: 'standalone',
      orientation: 'any',
    });
    expect(manifest.icons.map((icon) => icon.src)).toEqual([
      '/icons/icon-32.png?v=3',
      '/icons/pwa-icon-192.png?v=3',
      '/icons/pwa-icon-512.png?v=3',
      '/icons/pwa-maskable-512.png?v=3',
    ]);
    expect(manifest.icons[0]?.purpose).toBe('any');
    expect(manifest.icons[3]?.purpose).toBe('maskable');
  });

  it('renders a rounded full-bleed shortcut icon with a large P mark', async () => {
    const icon = readFileSync(new URL('../../public/icons/icon-192.png', import.meta.url));
    const { data, info } = await sharp(icon)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const pixelAt = (x: number, y: number) => {
      const offset = (y * info.width + x) * info.channels;
      return Array.from(data.subarray(offset, offset + 4));
    };

    expect(pixelAt(0, 0)[3]).toBe(0);
    expect(pixelAt(4, 96)).toEqual([0, 0, 0, 255]);
    expect(pixelAt(58, 58)).toEqual([255, 255, 255, 255]);
  });
});
