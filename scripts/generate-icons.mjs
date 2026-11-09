#!/usr/bin/env node
/**
 * Generates the PWA raster icons from one inline SVG so the app ships without
 * any external asset. Run with:  node scripts/generate-icons.mjs
 *
 * Output: public/icons/{icon-192,icon-512,maskable-512,apple-touch-icon}.png
 *         public/favicon.ico
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'public', 'icons');

const LOGO_PATH = 'M15 9.5h10.4c8.3 0 13.1 4.1 13.1 11.4 0 7.2-4.8 11.5-13.1 11.5H22v7.5H15V9.5Zm7 6.8v9.4h3.5c4 0 6.1-1.4 6.1-4.7 0-3.2-2.1-4.7-6.1-4.7H22Z';

/**
 * White P on black, matching the supplied brand image. The glyph sits in the
 * centre safe area so adaptive OS masks do not clip it.
 */
function iconSvg(size) {
  const radius = Math.round(size * 0.18);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${radius}" fill="#000000"/>
  <g transform="scale(${size / 48})"><path d="${LOGO_PATH}" fill="#FFFFFF" fill-rule="evenodd" clip-rule="evenodd"/></g>
</svg>`;
}

async function render(name, size) {
  const svg = Buffer.from(iconSvg(size));
  const png = await sharp(svg).png().toBuffer();
  const target = join(OUT_DIR, name);
  await sharp(png).toFile(target);
  console.log(`[icons] wrote ${name} (${size}x${size})`);
}

await mkdir(OUT_DIR, { recursive: true });
await render('icon-192.png', 192);
await render('icon-512.png', 512);
await render('maskable-512.png', 512);
await render('apple-touch-icon.png', 180);

const faviconPng = await sharp(Buffer.from(iconSvg(256))).png().toBuffer();
const favicon = Buffer.alloc(22 + faviconPng.length);
favicon.writeUInt16LE(0, 0);
favicon.writeUInt16LE(1, 2);
favicon.writeUInt16LE(1, 4);
favicon[6] = 0;
favicon[7] = 0;
favicon[8] = 0;
favicon[9] = 0;
favicon.writeUInt16LE(1, 10);
favicon.writeUInt16LE(32, 12);
favicon.writeUInt32LE(faviconPng.length, 14);
favicon.writeUInt32LE(22, 18);
faviconPng.copy(favicon, 22);
await writeFile(join(ROOT, 'public', 'favicon.ico'), favicon);
console.log('[icons] wrote public/favicon.ico (256x256)');
console.log('[icons] done');
