import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { normalizeProfilePhoto } from '@/lib/files/normalize-photo';

describe('profile photo normalization', () => {
  it('converts TIFF uploads to a resized browser-friendly JPEG', async () => {
    const tiff = await sharp({
      create: { width: 2400, height: 1200, channels: 3, background: '#31506f' },
    }).tiff().toBuffer();

    const normalized = await normalizeProfilePhoto(tiff);
    const metadata = await sharp(normalized).metadata();

    expect(metadata.format).toBe('jpeg');
    expect(metadata.width).toBeLessThanOrEqual(1600);
    expect(metadata.height).toBeLessThanOrEqual(2000);
  });
});
