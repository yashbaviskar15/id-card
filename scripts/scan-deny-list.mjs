#!/usr/bin/env node
/**
 * Repo-wide forbidden-content scan.
 *
 *   group 1 -> the terms listed in tests/fixtures/banned-terms.txt
 *   group 2 -> the terms listed in tests/fixtures/placeholder-terms.txt
 *
 * The two fixture files and a small set of generated/vendored paths are the only
 * allowed locations. Anything else is a finding and exits non-zero.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = process.cwd();
const FIXTURES = ['tests/fixtures/banned-terms.txt', 'tests/fixtures/placeholder-terms.txt'];

const SKIP_DIRS = new Set([
  'node_modules', '.git', '.next', 'coverage', 'test-results', 'playwright-report',
  'blob-report', '.vercel', '.playwright', '.vitest', 'out', 'build', 'tmp', 'dist',
]);
const SKIP_FILES = new Set(['package-lock.json', 'next-env.d.ts', 'tsconfig.tsbuildinfo']);
const ALLOWED_FILES = new Set(FIXTURES.map((p) => p.split('/').join(sep)));
const MAX_BYTES = 2 * 1024 * 1024;

function parseFixture(file) {
  const rules = [];
  const lines = readFileSync(join(ROOT, file), 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (trimmed.startsWith('plain:')) {
      const phrase = trimmed.slice('plain:'.length).trim();
      if (!phrase) continue;
      rules.push({ source: escapeRegExp(phrase), label: phrase });
    } else if (trimmed.startsWith('re:')) {
      const pattern = trimmed.slice('re:'.length).trim();
      if (!pattern) continue;
      rules.push({ source: pattern, label: pattern });
    }
  }
  return rules;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    const rel = relative(ROOT, full);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(full, out);
      continue;
    }
    if (!entry.isFile()) continue;
    if (SKIP_FILES.has(entry.name)) continue;
    if (ALLOWED_FILES.has(rel)) continue;
    if (statSync(full).size > MAX_BYTES) continue;
    out.push(rel);
  }
  return out;
}

function isBinary(buffer) {
  const sample = buffer.subarray(0, 8000);
  return sample.includes(0);
}

const groups = [
  { name: FIXTURES[0], rules: parseFixture(FIXTURES[0]) },
  { name: FIXTURES[1], rules: parseFixture(FIXTURES[1]) },
].map((g) => ({
  ...g,
  matchers: g.rules.map((r) => ({ label: r.label, re: new RegExp(r.source, 'giu') })),
}));

const findings = [];
const files = walk(ROOT);
for (const rel of files) {
  const buffer = readFileSync(join(ROOT, rel));
  if (isBinary(buffer)) continue;
  const text = buffer.toString('utf8');
  const lines = text.split(/\r?\n/);
  for (const group of groups) {
    for (const matcher of group.matchers) {
      matcher.re.lastIndex = 0;
      let match;
      while ((match = matcher.re.exec(text)) !== null) {
        const line = text.slice(0, match.index).split('\n').length;
        findings.push({
          group: group.name,
          file: rel.split(sep).join('/'),
          line,
          term: matcher.label,
          context: (lines[line - 1] ?? '').trim().slice(0, 160),
        });
        if (match.index === matcher.re.lastIndex) matcher.re.lastIndex += 1;
      }
    }
  }
}

console.log(`[scan-deny-list] scanned ${files.length} files`);
for (const group of groups) {
  const hits = findings.filter((f) => f.group === group.name);
  console.log(`  ${group.name}: ${hits.length} finding(s)`);
}

if (findings.length) {
  console.error('\n[scan-deny-list] FAILED — forbidden content found:');
  for (const f of findings.slice(0, 200)) {
    console.error(`  ${f.file}:${f.line} [${f.group}] "${f.term}"\n      ${f.context}`);
  }
  if (findings.length > 200) console.error(`  ... and ${findings.length - 200} more`);
  console.error(`\nAllowed locations: ${FIXTURES.join(', ')}`);
  process.exit(1);
}

console.log('[scan-deny-list] ok — no forbidden content outside the deny-list fixtures');
