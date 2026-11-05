import 'server-only';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { serverEnv } from '@/lib/env.server';

/**
 * Application-level encryption for sensitive fields (identity numbers, account
 * numbers, anything flagged `is_sensitive`).
 *
 * AES-256-GCM, a fresh 12-byte nonce per record, and an AAD that binds the
 * ciphertext to its exact location so a value cannot be swapped between rows.
 *
 * Envelope format (stored as text):
 *   v1.<keyId>.<nonce base64url>.<ciphertext base64url>.<auth tag base64url>
 *
 * The keyring lives only in the server environment (FIELD_ENCRYPTION_KEYS) and
 * is never bundled for the browser. Rotation: add a new key, switch
 * FIELD_ENCRYPTION_ACTIVE_KEY, then run `npm run keys:rotate` to re-encrypt
 * records still written with the old key id (see SETUP.md).
 */

export const ENVELOPE_VERSION = 'v1';
const NONCE_BYTES = 12;
const KEY_BYTES = 32;

export interface Keyring {
  active: string;
  keys: Record<string, Buffer>;
}

let cachedKeyring: Keyring | null = null;

export function keyring(): Keyring {
  if (cachedKeyring) return cachedKeyring;
  const env = serverEnv();

  let parsed: unknown;
  try {
    parsed = JSON.parse(env.FIELD_ENCRYPTION_KEYS);
  } catch {
    throw new Error('FIELD_ENCRYPTION_KEYS must be a JSON object of keyId -> base64 key');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('FIELD_ENCRYPTION_KEYS must be a JSON object of keyId -> base64 key');
  }

  const keys: Record<string, Buffer> = {};
  for (const [keyId, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof value !== 'string') throw new Error(`FIELD_ENCRYPTION_KEYS["${keyId}"] must be a string`);
    const key = Buffer.from(value, 'base64');
    if (key.length !== KEY_BYTES) {
      throw new Error(`FIELD_ENCRYPTION_KEYS["${keyId}"] must decode to ${KEY_BYTES} bytes`);
    }
    keys[keyId] = key;
  }

  const active = env.FIELD_ENCRYPTION_ACTIVE_KEY;
  if (!keys[active]) {
    throw new Error('FIELD_ENCRYPTION_ACTIVE_KEY does not match any key in FIELD_ENCRYPTION_KEYS');
  }

  cachedKeyring = { active, keys };
  return cachedKeyring;
}

function aadBuffer(aad: string): Buffer {
  return Buffer.from(aad, 'utf8');
}

export function encryptField(plaintext: string, aad: string, keyringOverride?: Keyring): string {
  const ring = keyringOverride ?? keyring();
  const keyId = ring.active;
  const key = ring.keys[keyId];
  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  cipher.setAAD(aadBuffer(aad));
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    ENVELOPE_VERSION,
    keyId,
    nonce.toString('base64url'),
    ciphertext.toString('base64url'),
    tag.toString('base64url'),
  ].join('.');
}

export function decryptField(envelope: string, aad: string, keyringOverride?: Keyring): string {
  const parts = envelope.split('.');
  if (parts.length !== 5 || parts[0] !== ENVELOPE_VERSION) {
    throw new Error('Unsupported ciphertext envelope');
  }
  const [, keyId, nonceB64, ciphertextB64, tagB64] = parts;
  const ring = keyringOverride ?? keyring();
  const key = ring.keys[keyId];
  if (!key) throw new Error(`No encryption key available for key id "${keyId}"`);

  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(nonceB64, 'base64url'));
  decipher.setAAD(aadBuffer(aad));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

export function isEncryptedEnvelope(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(`${ENVELOPE_VERSION}.`);
}

export function envelopeKeyId(envelope: string): string | null {
  const parts = envelope.split('.');
  return parts.length === 5 && parts[0] === ENVELOPE_VERSION ? parts[1] : null;
}

/**
 * AAD binding: the ciphertext is only valid for this owner, this row and this
 * column. Moving it to another row makes decryption fail.
 */
export function fieldAad(ownerId: string, entityId: string, column: string): string {
  return `${ownerId}:${entityId}:${column}`;
}

/* ------------------------------------------------------------------ */
/* Masked display                                                      */
/* ------------------------------------------------------------------ */

export const MASK_CHAR = '\u2022';

/** Default display form of a sensitive value: last 4 characters only. */
export function maskValue(value: string | null | undefined, visible = 4): string {
  if (!value) return '';
  const clean = value.replace(/\s+/g, '');
  if (clean.length <= visible) return MASK_CHAR.repeat(clean.length);
  return `${MASK_CHAR.repeat(Math.min(clean.length - visible, 8))}${clean.slice(-visible)}`;
}

export function lastFour(value: string | null | undefined): string {
  if (!value) return '';
  return value.replace(/\s+/g, '').slice(-4);
}
