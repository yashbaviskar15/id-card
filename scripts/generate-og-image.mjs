#!/usr/bin/env node
/**
 * Generates the static social preview image from vector artwork and the exact
 * P-mark path used by BrandMark. Run with: node scripts/generate-og-image.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'public', 'og');
const OUTPUT = join(OUT_DIR, 'private-identity.jpg');
const LOGO_PATH =
  'M15 9.5h10.4c8.3 0 13.1 4.1 13.1 11.4 0 7.2-4.8 11.5-13.1 11.5H22v7.5H15V9.5Zm7 6.8v9.4h3.5c4 0 6.1-1.4 6.1-4.7 0-3.2-2.1-4.7-6.1-4.7H22Z';

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#f6f7f9"/>
  <rect x="40" y="40" width="1120" height="550" rx="30" fill="#ffffff" stroke="#e2e8f0" stroke-width="2"/>
  <circle cx="1018" cy="315" r="188" fill="#f6f7f9"/>
  <circle cx="1018" cy="315" r="142" fill="none" stroke="#e2e8f0" stroke-width="2"/>
  <circle cx="1018" cy="315" r="96" fill="none" stroke="#e2e8f0" stroke-width="2"/>
  <g transform="translate(104 100) scale(2)">
    <rect width="48" height="48" rx="9" fill="#000000"/>
    <path d="${LOGO_PATH}" fill="#ffffff" fill-rule="evenodd" clip-rule="evenodd"/>
  </g>
  <text x="224" y="145" fill="#111827" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="700">Private Identity</text>
  <text x="224" y="180" fill="#5b6472" font-family="Arial, Helvetica, sans-serif" font-size="18">PRIVATE BY DESIGN</text>
  <rect x="104" y="222" width="54" height="4" rx="2" fill="#111827"/>
  <text x="104" y="303" fill="#111827" font-family="Arial, Helvetica, sans-serif" font-size="58" font-weight="700" letter-spacing="-1.5">Your identity.</text>
  <text x="104" y="371" fill="#111827" font-family="Arial, Helvetica, sans-serif" font-size="58" font-weight="700" letter-spacing="-1.5">Shared securely.</text>
  <text x="106" y="427" fill="#5b6472" font-family="Arial, Helvetica, sans-serif" font-size="24">Private identity cards and secure file sharing.</text>
  <g transform="translate(901 226)">
    <rect width="234" height="178" rx="24" fill="#ffffff" stroke="#e2e8f0" stroke-width="2"/>
    <rect x="22" y="22" width="42" height="42" rx="12" fill="#111827"/>
    <path d="M43 34v16m-8-8h16" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>
    <text x="80" y="41" fill="#111827" font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="700">PRIVATE VAULT</text>
    <text x="22" y="98" fill="#111827" font-family="Arial, Helvetica, sans-serif" font-size="19" font-weight="700">One secure place</text>
    <text x="22" y="127" fill="#5b6472" font-family="Arial, Helvetica, sans-serif" font-size="15">for your identity and</text>
    <text x="22" y="150" fill="#5b6472" font-family="Arial, Helvetica, sans-serif" font-size="15">private documents.</text>
  </g>
</svg>`;

await mkdir(OUT_DIR, { recursive: true });
const image = await sharp(Buffer.from(svg))
  .jpeg({ quality: 84, mozjpeg: true, chromaSubsampling: '4:2:0' })
  .toBuffer();

if (image.byteLength >= 300_000) {
  throw new Error(`OG image is ${image.byteLength} bytes; maximum is 300000.`);
}

const info = await sharp(image).metadata();
if (info.width !== 1200 || info.height !== 630 || info.format !== 'jpeg') {
  throw new Error('OG image must be a 1200x630 JPEG.');
}

await writeFile(OUTPUT, image);
console.log(`[og] wrote public/og/private-identity.jpg (${image.byteLength} bytes)`);
