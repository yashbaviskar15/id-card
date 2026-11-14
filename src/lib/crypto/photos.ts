import 'server-only';
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';
import { keyring, type Keyring } from '@/lib/crypto/fields';

/**
 * Application-level encryption for private photo bytes.
 *
 * The bytes are encrypted before they reach Storage (AES-256-GCM) so the bucket
 * holds nothing but ciphertext: an operator with raw bucket access, or a leaked
 * signed URL, still cannot read a photo. Decryption happens only inside
 * grant-checked, password-checked server routes.
 *
 * The encryption key is *derived* from the existing field keyring with HKDF and
 * a fixed, distinct info string, so photo bytes never share a key with the
 * encrypted database fields while no extra secret has to be provisioned. The
 * envelope carries the field key id so a key rotation is transparent.
 *
 * Binary envelope:
 *   "PIVP" | version(1) | keyIdLen(1) | keyId | nonce(12) | tag(16) | ciphertext
 */

const MAGIC = Buffer.from('PIVP', 'ascii');
const VERSION = 1;
const NONCE_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;
const HKDF_INFO_PREFIX = 'private-identity:photo-bytes:v1:';

const derivedCache = new Map<string, Buffer>();

/** HKDF-SHA256 subkey for one field keyring key id, domain-separated from fields. */
function photoKey(keyId: string, ring: Keyring): Buffer {
  const cached = derivedCache.get(keyId);
  if (cached) return cached;
  const master = ring.keys[keyId];
  if (!master) throw new Error(`No encryption key available for key id "${keyId}"`);
  const derived = Buffer.from(
    hkdfSync('sha256', master, Buffer.from('piv-photo-salt'), `${HKDF_INFO_PREFIX}${keyId}`, KEY_BYTES),
  );
  derivedCache.set(keyId, derived);
  return derived;
}

/**
 * AAD binds the ciphertext to one owner and one photo row, so a blob cannot be
 * moved between rows (or owners) and still decrypt.
 */
export function photoAad(ownerId: string, photoId: string): string {
  return `photo:v1:${ownerId}:${photoId}`;
}

export function encryptPhotoBytes(plain: Buffer, aad: string, keyringOverride?: Keyring): Buffer {
  const ring = keyringOverride ?? keyring();
  const keyId = ring.active;
  const key = photoKey(keyId, ring);
  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  cipher.setAAD(Buffer.from(aad, 'utf8'));
  const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  const keyIdBuf = Buffer.from(keyId, 'utf8');
  if (keyIdBuf.length > 255) throw new Error('Encryption key id is too long');
  return Buffer.concat([MAGIC, Buffer.from([VERSION, keyIdBuf.length]), keyIdBuf, nonce, tag, ciphertext]);
}

export function decryptPhotoBytes(envelope: Buffer, aad: string, keyringOverride?: Keyring): Buffer {
  if (envelope.length < MAGIC.length + 2 + NONCE_BYTES + TAG_BYTES) {
    throw new Error('Encrypted photo is truncated');
  }
  if (!envelope.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new Error('Unsupported encrypted photo envelope');
  }
  let offset = MAGIC.length;
  const version = envelope[offset];
  offset += 1;
  if (version !== VERSION) throw new Error('Unsupported encrypted photo version');
  const keyIdLen = envelope[offset];
  offset += 1;
  if (envelope.length < offset + keyIdLen + NONCE_BYTES + TAG_BYTES) {
    throw new Error('Encrypted photo is truncated');
  }
  const keyId = envelope.subarray(offset, offset + keyIdLen).toString('utf8');
  offset += keyIdLen;
  const nonce = envelope.subarray(offset, offset + NONCE_BYTES);
  offset += NONCE_BYTES;
  const tag = envelope.subarray(offset, offset + TAG_BYTES);
  offset += TAG_BYTES;
  const ciphertext = envelope.subarray(offset);

  const ring = keyringOverride ?? keyring();
  const key = photoKey(keyId, ring);
  const decipher = createDecipheriv('aes-256-gcm', key, nonce);
  decipher.setAAD(Buffer.from(aad, 'utf8'));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}
