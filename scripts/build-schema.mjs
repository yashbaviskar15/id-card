#!/usr/bin/env node
/**
 * Concatenates supabase/migrations/*.sql (lexical order) into
 * supabase/schema.sql so a fresh project can be provisioned with one file.
 *
 * migrations/ stays the single source of truth; this only snapshots it.
 * Run: node scripts/build-schema.mjs
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const migrationsDir = path.join(root, 'supabase', 'migrations');
const outFile = path.join(root, 'supabase', 'schema.sql');

const files = (await readdir(migrationsDir))
  .filter((f) => f.endsWith('.sql'))
  .sort();

const parts = [
  '-- ===========================================================================',
  '-- supabase/schema.sql — GENERATED FILE, DO NOT EDIT BY HAND.',
  '-- Built from supabase/migrations/*.sql by scripts/build-schema.mjs.',
  '-- Apply with:  psql "$SUPABASE_DB_URL" -f supabase/schema.sql',
  '-- ===========================================================================',
  '',
];

for (const file of files) {
  const sql = await readFile(path.join(migrationsDir, file), 'utf8');
  parts.push(`-- >>> ${file} >>>`, sql.trim(), '');
}

await writeFile(outFile, parts.join('\n'), 'utf8');
console.log(`[build-schema] wrote ${path.relative(root, outFile)} from ${files.length} migration(s): ${files.join(', ')}`);
