#!/usr/bin/env node
/**
 * Palette scan: the identity card and dashboard must stay plain white / ink / grey.
 * Fails on any warm metallic colour.
 *
 *   1. literal check against tests/fixtures/palette-banned.txt
 *   2. every #rgb / #rrggbb literal is converted to HSL and rejected when it sits
 *      in the warm-yellow band (hue 35..60, saturation > 12%, lightness 20..88%)
 *   3. oklch()/hsl() literals with a hue in the same band and chroma/saturation
 *      above the same threshold are rejected
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = process.cwd();
const BANNED_FIXTURE = 'tests/fixtures/palette-banned.txt';
const BANNED_LITERALS = readFileSync(join(ROOT, BANNED_FIXTURE), 'utf8')
  .split(/\r?\n/)
  .map((line) => line.trim().toLowerCase())
  .filter((line) => line && !line.startsWith('#'))
  .map((hex) => `#${hex}`);

const SKIP_DIRS = new Set([
  'node_modules', '.git', '.next', 'coverage', 'test-results', 'playwright-report',
  'blob-report', '.vercel', '.playwright', '.vitest', 'out', 'build', 'tmp', 'dist', 'fonts',
]);
const SKIP_FILES = new Set(['package-lock.json']);
const ALLOWED = new Set([BANNED_FIXTURE]);
const MAX_BYTES = 2 * 1024 * 1024;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(full, out);
      continue;
    }
    if (!entry.isFile()) continue;
    const rel = relative(ROOT, full);
    if (SKIP_FILES.has(entry.name) || ALLOWED.has(rel.split(sep).join('/'))) continue;
    if (statSync(full).size > MAX_BYTES) continue;
    out.push(rel);
  }
  return out;
}

function hexToHsl(hex) {
  const value = hex.length === 4
    ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
    : hex;
  const r = parseInt(value.slice(1, 3), 16) / 255;
  const g = parseInt(value.slice(3, 5), 16) / 255;
  const b = parseInt(value.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return { h, s, l };
}

const isWarmGold = ({ h, s, l }) => h >= 35 && h <= 60 && s > 0.12 && l > 0.2 && l < 0.88;

const findings = [];
const files = walk(ROOT);
let hexCount = 0;

for (const rel of files) {
  const buffer = readFileSync(join(ROOT, rel));
  if (buffer.subarray(0, 8000).includes(0)) continue;
  const text = buffer.toString('utf8');
  const normalized = rel.split(sep).join('/');

  for (const literal of BANNED_LITERALS) {
    if (text.toLowerCase().includes(literal)) {
      findings.push({ file: normalized, value: literal, reason: 'banned palette literal' });
    }
  }

  const hexRe = /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/g;
  let match;
  while ((match = hexRe.exec(text)) !== null) {
    hexCount += 1;
    const hsl = hexToHsl(match[0]);
    if (isWarmGold(hsl)) {
      findings.push({
        file: normalized,
        value: match[0],
        reason: `warm/gold colour (hue ${hsl.h.toFixed(0)}, sat ${(hsl.s * 100).toFixed(0)}%, light ${(hsl.l * 100).toFixed(0)}%)`,
      });
    }
  }

  const fnRe = /\b(?:oklch|hsl)\(\s*([\d.]+)(?:deg)?[\s,]+([\d.]+%?)[\s,]+([\d.]+%?)/g;
  while ((match = fnRe.exec(text)) !== null) {
    const hue = Number(match[2].replace('%', ''));
    const chroma = match[3].endsWith('%') ? Number(match[3].replace('%', '')) / 100 : Number(match[3]);
    if (hue >= 35 && hue <= 60 && chroma > 0.12) {
      findings.push({
        file: normalized,
        value: match[0].trim(),
        reason: 'warm/gold colour function literal',
      });
    }
  }
}

console.log(`[scan-colors] scanned ${files.length} files, ${hexCount} hex literals`);
if (findings.length) {
  console.error('\n[scan-colors] FAILED — gold/metallic palette usage found:');
  for (const f of findings) console.error(`  ${f.file}: ${f.value} — ${f.reason}`);
  process.exit(1);
}
console.log('[scan-colors] ok — palette is white/ink/grey only');
