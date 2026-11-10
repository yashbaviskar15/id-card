#!/usr/bin/env node
/**
 * Generates PWA raster icons from the shared public/logo.png artwork.
 * Run with: node scripts/generate-icons.mjs
 *
 * Output: public/icons/{icon-32,icon-192,icon-512,maskable-512,apple-touch-icon}.png
 *         public/icons/pwa-{icon-192,icon-512,maskable-512,apple-touch-icon}.png
 *         public/favicon.ico
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'public', 'icons');
const LOGO_PNG = await readFile(join(ROOT, 'public', 'logo.png'));
const P_GLYPH = { left: 171, top: 139, width: 183, height: 237 };

async function renderIcon(size, { maskable = false } = {}) {
  const radius = maskable ? 0 : Math.round(size * 0.22);
  const glyphWidth = Math.round(size * (maskable ? 0.46 : 0.54));
  const glyphHeight = Math.round(glyphWidth * P_GLYPH.height / P_GLYPH.width);
  const background = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" rx="${radius}" fill="#000"/></svg>`,
  );
  const glyph = await sharp(LOGO_PNG)
    .extract(P_GLYPH)
    .resize(glyphWidth, glyphHeight)
    .png()
    .toBuffer();
  return sharp(background)
    .composite([{
      input: glyph,
      left: Math.round((size - glyphWidth) / 2),
      top: Math.round((size - glyphHeight) / 2),
    }])
    .png()
    .toBuffer();
}

async function render(name, size, options) {
  const png = await renderIcon(size, options);
  const target = join(OUT_DIR, name);
  await writeFile(target, png);
  console.log(`[icons] wrote ${name} (${size}x${size})`);
}

async function renderPwa(name, size, options) {
  await render(name, size, options);
}

await mkdir(OUT_DIR, { recursive: true });
await render('icon-32.png', 32);
await render('icon-192.png', 192);
await render('icon-512.png', 512);
await render('maskable-512.png', 512, { maskable: true });
await render('apple-touch-icon.png', 180);
await renderPwa('pwa-icon-192.png', 192);
await renderPwa('pwa-icon-512.png', 512);
await renderPwa('pwa-maskable-512.png', 512, { maskable: true });
await renderPwa('pwa-apple-touch-icon.png', 180);

const faviconPng = await renderIcon(256);
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
