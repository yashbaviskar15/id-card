#!/usr/bin/env node
/**
 * Generates PWA raster icons from the shared public/logo.svg artwork.
 * Run with: node scripts/generate-icons.mjs
 *
 * Output: public/icons/{icon-32,icon-192,icon-512,maskable-512,apple-touch-icon}.png
 *         public/favicon.ico
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'public', 'icons');
const LOGO_SVG = await readFile(join(ROOT, 'public', 'logo.svg'));

async function render(name, size) {
  const png = await sharp(LOGO_SVG).resize(size, size).png().toBuffer();
  const target = join(OUT_DIR, name);
  await writeFile(target, png);
  console.log(`[icons] wrote ${name} (${size}x${size})`);
}

await mkdir(OUT_DIR, { recursive: true });
await render('icon-32.png', 32);
await render('icon-192.png', 192);
await render('icon-512.png', 512);
await render('maskable-512.png', 512);
await render('apple-touch-icon.png', 180);

const faviconPng = await sharp(LOGO_SVG).resize(256, 256).png().toBuffer();
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
