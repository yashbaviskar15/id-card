#!/usr/bin/env node
/**
 * Generates the PWA raster icons from one inline SVG so the app ships without
 * any external asset. Run with:  node scripts/generate-icons.mjs
 *
 * Output: public/icons/{icon-192,icon-512,maskable-512,apple-touch-icon}.png
 */
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'public', 'icons');

const INK = '#111827';
const LINE = '#DDE1E7';
const MUTED = '#F3F4F6';

/**
 * A rounded identity-card glyph. `maskable` keeps all content inside the safe
 * zone (80% centre) and fills the whole canvas so an OS mask never clips it.
 */
function iconSvg(size, { maskable = false } = {}) {
  const bgRadius = maskable ? 0 : Math.round(size * 0.22);
  const pad = maskable ? size * 0.2 : size * 0.14;
  const card = size - pad * 2;
  const cardX = pad;
  const cardY = pad;
  const cardR = Math.round(card * 0.14);

  const inner = card * 0.16;
  const photo = card * 0.34;
  const lineX = cardX + inner + photo + card * 0.06;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${bgRadius}" fill="${INK}"/>
  <rect x="${cardX}" y="${cardY}" width="${card}" height="${card}" rx="${cardR}" fill="#FFFFFF"/>
  <rect x="${cardX + inner}" y="${cardY + inner}" width="${photo}" height="${photo}" rx="${Math.round(photo * 0.18)}" fill="${MUTED}" stroke="${LINE}" stroke-width="${Math.max(1, card * 0.012)}"/>
  <circle cx="${cardX + inner + photo / 2}" cy="${cardY + inner + photo * 0.42}" r="${photo * 0.14}" fill="${LINE}"/>
  <path d="M ${cardX + inner + photo * 0.22} ${cardY + inner + photo * 0.82} h ${photo * 0.56}" stroke="${LINE}" stroke-width="${Math.max(1, card * 0.02)}" stroke-linecap="round"/>
  <rect x="${lineX}" y="${cardY + inner + card * 0.02}" width="${card * 0.34}" height="${Math.max(2, card * 0.05)}" rx="${card * 0.025}" fill="${INK}"/>
  <rect x="${lineX}" y="${cardY + inner + card * 0.14}" width="${card * 0.28}" height="${Math.max(2, card * 0.035)}" rx="${card * 0.017}" fill="${LINE}"/>
  <rect x="${lineX}" y="${cardY + inner + card * 0.24}" width="${card * 0.3}" height="${Math.max(2, card * 0.035)}" rx="${card * 0.017}" fill="${LINE}"/>
  <g fill="${INK}">
    <rect x="${cardX + inner}" y="${cardY + card - inner - card * 0.22}" width="${card * 0.22}" height="${card * 0.22}" rx="${card * 0.03}"/>
  </g>
  <rect x="${cardX + inner + card * 0.05}" y="${cardY + card - inner - card * 0.17}" width="${card * 0.12}" height="${card * 0.12}" rx="${card * 0.02}" fill="#FFFFFF"/>
</svg>`;
}

async function render(name, size, opts) {
  const svg = Buffer.from(iconSvg(size, opts));
  const png = await sharp(svg).png().toBuffer();
  const target = join(OUT_DIR, name);
  await sharp(png).toFile(target);
  console.log(`[icons] wrote ${name} (${size}x${size})`);
}

await mkdir(OUT_DIR, { recursive: true });
await render('icon-192.png', 192, {});
await render('icon-512.png', 512, {});
await render('maskable-512.png', 512, { maskable: true });
await render('apple-touch-icon.png', 180, {});
console.log('[icons] done');
