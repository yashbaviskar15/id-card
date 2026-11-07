import 'server-only';
import sharp from 'sharp';

/** Normalize accepted image formats for consistent browser display and lower transfer size. */
export async function normalizeProfilePhoto(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer, { limitInputPixels: 32_000_000 })
    .rotate()
    .resize({ width: 1600, height: 2000, fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 86, mozjpeg: true })
    .toBuffer();
}
