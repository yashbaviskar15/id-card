#!/usr/bin/env node
/**
 * Generates the static social preview using the shared public/logo.png asset.
 * Run with: node scripts/generate-og-image.mjs
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'public', 'og');
const OUTPUT = join(OUT_DIR, 'private-identity.jpg');
const LOGO_PNG = await readFile(join(ROOT, 'public', 'logo.png'));

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#f6f7f9"/>
  <rect x="40" y="40" width="1120" height="550" rx="30" fill="#ffffff" stroke="#e2e8f0" stroke-width="2"/>
  <circle cx="1018" cy="315" r="188" fill="#f6f7f9"/>
  <circle cx="1018" cy="315" r="142" fill="none" stroke="#e2e8f0" stroke-width="2"/>
  <circle cx="1018" cy="315" r="96" fill="none" stroke="#e2e8f0" stroke-width="2"/>
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
const logoPng = await sharp(LOGO_PNG).resize(96, 96).png().toBuffer();
const image = await sharp(Buffer.from(svg))
  .composite([{ input: logoPng, left: 104, top: 100 }])
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
