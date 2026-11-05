#!/usr/bin/env node
/**
 * Environment validation gate.
 *
 *   node scripts/check-env.mjs --scope=client   # build gate (runs as `prebuild`, fails the build)
 *   node scripts/check-env.mjs                  # full check (client + server)
 *
 * Values already present in process.env always win over .env files, so the same
 * script behaves correctly locally (.env.local) and on a host such as Vercel.
 * This file must never print a secret value — only names and reasons.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const manifest = JSON.parse(readFileSync(join(ROOT, 'env.manifest.json'), 'utf8'));

const scopeArg = process.argv.find((a) => a.startsWith('--scope='));
const scope = scopeArg ? scopeArg.split('=')[1] : 'all';
if (!['client', 'server', 'all'].includes(scope)) {
  console.error(`[check-env] unknown --scope=${scope} (expected client|server|all)`);
  process.exit(1);
}

// --- load .env files without overriding real environment variables ----------
const ENV_FILES = ['.env', '.env.local', '.env.development', '.env.production'];
const fromFile = new Set();
for (const file of ENV_FILES) {
  const path = join(ROOT, file);
  if (!existsSync(path)) continue;
  try {
    process.loadEnvFile(path);
    fromFile.add(file);
  } catch {
    // A malformed .env file is a hard error below via the missing-variable report.
  }
}

const problems = [];
const missing = [];

function check(entry) {
  const raw = process.env[entry.name];
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value) {
    if (entry.required) missing.push(entry.name);
    return;
  }
  if (entry.minLength && value.length < entry.minLength) {
    problems.push(`${entry.name} is shorter than ${entry.minLength} characters`);
    return;
  }
  if (entry.kind === 'url') {
    try {
      const url = new URL(value);
      if (entry.https && url.protocol !== 'https:') problems.push(`${entry.name} must use https://`);
      if (url.username || url.password) problems.push(`${entry.name} must not embed credentials`);
    } catch {
      problems.push(`${entry.name} is not a valid absolute URL`);
    }
  }
  if (entry.kind === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    problems.push(`${entry.name} is not a valid email address`);
  }
  if (entry.kind === 'int' && !/^\d+$/.test(value)) {
    problems.push(`${entry.name} must be a positive integer`);
  }
  if (entry.noTrailingSlash && value.endsWith('/')) {
    problems.push(`${entry.name} must not end with "/"`);
  }
}

const groups = scope === 'client' ? ['client'] : scope === 'server' ? ['server'] : ['client', 'server'];
for (const group of groups) for (const entry of manifest[group]) check(entry);

// The site URL is the anchor of the single permanent QR code: it is never optional.
if (groups.includes('client') && !process.env.NEXT_PUBLIC_SITE_URL?.trim()) {
  problems.push('NEXT_PUBLIC_SITE_URL is missing — the permanent QR code cannot be built without it');
}

if (missing.length || problems.length) {
  console.error('[check-env] environment validation failed');
  if (fromFile.size) console.error(`[check-env] loaded env files: ${[...fromFile].join(', ')}`);
  for (const name of missing) console.error(`  missing required variable: ${name}`);
  for (const p of problems) console.error(`  ${p}`);
  console.error('[check-env] see .env.example and SETUP.md');
  process.exit(1);
}

console.log(`[check-env] ok (scope=${scope}${fromFile.size ? `, files: ${[...fromFile].join(', ')}` : ''})`);
