#!/usr/bin/env node
/**
 * rotate-keys.mjs — re-encrypts `fields.value_encrypted` rows written under an
 * older key id into the active key. Idempotent and resumable.
 *
 * It never touches `profiles.slug`, so the QR payload is unaffected (invariant 8.7).
 *
 * Usage:
 *   node scripts/rotate-keys.mjs --dry-run
 *   node scripts/rotate-keys.mjs
 *
 * Requires: SUPABASE_DB_URL, FIELD_ENCRYPTION_KEYS (JSON {keyId: base64-32B}),
 *           FIELD_ENCRYPTION_ACTIVE_KEY.
 * See docs/key-rotation.md.
 */
import { createDecipheriv, createCipheriv, randomBytes } from 'node:crypto';
import pg from 'pg';

const ENVELOPE_VERSION = 'v1';
const dryRun = process.argv.includes('--dry-run');

// --- inline env (mirrors src/lib/env.server.ts; scripts cannot import TS) -----
process.loadEnvFile?.('.env.local');
process.loadEnvFile?.('.env');

const dbUrl = process.env.SUPABASE_DB_URL;
const activeKeyId = process.env.FIELD_ENCRYPTION_ACTIVE_KEY;
let keyring;
try {
  keyring = JSON.parse(process.env.FIELD_ENCRYPTION_KEYS ?? '{}');
} catch {
  console.error('[rotate-keys] FIELD_ENCRYPTION_KEYS is not valid JSON');
  process.exit(1);
}

if (!dbUrl) {
  console.error('[rotate-keys] SUPABASE_DB_URL is required');
  process.exit(1);
}
if (!activeKeyId || !keyring[activeKeyId]) {
  console.error('[rotate-keys] FIELD_ENCRYPTION_ACTIVE_KEY must name a key present in FIELD_ENCRYPTION_KEYS');
  process.exit(1);
}

function keys() {
  const out = {};
  for (const [id, b64] of Object.entries(keyring)) {
    const buf = Buffer.from(b64, 'base64');
    if (buf.length !== 32) throw new Error(`key ${id} must be 32 bytes (base64)`);
    out[id] = buf;
  }
  return out;
}

function decode(envelope) {
  const [version, keyId, nonceB64, ctB64, tagB64] = envelope.split('.');
  if (version !== ENVELOPE_VERSION) throw new Error(`unsupported envelope version ${version}`);
  return {
    keyId,
    nonce: Buffer.from(nonceB64, 'base64url'),
    ct: Buffer.from(ctB64, 'base64url'),
    tag: Buffer.from(tagB64, 'base64url'),
  };
}

function decrypt(envelope, aad, keymap) {
  const { keyId, nonce, ct, tag } = decode(envelope);
  const key = keymap[keyId];
  if (!key) throw new Error(`no key in keyring for id ${keyId}`);
  const d = createDecipheriv('aes-256-gcm', key, nonce);
  d.setAAD(Buffer.from(aad, 'utf8'));
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]).toString('utf8');
}

function encrypt(plaintext, aad, keymap) {
  const key = keymap[activeKeyId];
  const nonce = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key, nonce);
  c.setAAD(Buffer.from(aad, 'utf8'));
  const ct = Buffer.concat([c.update(plaintext, 'utf8'), c.final()]);
  const tag = c.getAuthTag();
  return [
    ENVELOPE_VERSION,
    activeKeyId,
    nonce.toString('base64url'),
    ct.toString('base64url'),
    tag.toString('base64url'),
  ].join('.');
}

const keymap = keys();
const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
await client.connect();

let rotated = 0;
let skipped = 0;

try {
  const { rows } = await client.query(
    `select id, owner_id, value_encrypted
       from public.fields
      where value_encrypted is not null
      order by created_at asc`,
  );

  for (const row of rows) {
    const aad = `${row.owner_id}:${row.id}:value`;
    const currentKeyId = decode(row.value_encrypted).keyId;
    if (currentKeyId === activeKeyId) {
      skipped += 1;
      continue;
    }
    const plaintext = decrypt(row.value_encrypted, aad, keymap);
    const reencrypted = encrypt(plaintext, aad, keymap);
    if (dryRun) {
      console.log(`[rotate-keys] would rotate field ${row.id} (${currentKeyId} -> ${activeKeyId})`);
    } else {
      await client.query('update public.fields set value_encrypted = $1 where id = $2', [
        reencrypted,
        row.id,
      ]);
    }
    rotated += 1;
  }

  console.log(
    `[rotate-keys] ${dryRun ? 'DRY RUN — ' : ''}rotated ${rotated}, already current ${skipped}, total ${rows.length}`,
  );
} finally {
  await client.end();
}
