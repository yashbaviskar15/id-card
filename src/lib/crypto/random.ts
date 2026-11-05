import 'server-only';
import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

/**
 * Random value generation. Everything here is CSPRNG-backed (node:crypto) —
 * Math.random is never used for anything security relevant.
 */

/** RFC 4648 base32, lowercase: a-z and 2-7 (32 symbols). */
const BASE32 = 'abcdefghijklmnopqrstuvwxyz234567';

function toBase32(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32[(value << (5 - bits)) & 31];
  return output;
}

/**
 * The permanent public slug: 16 base32 characters = 80 bits, generated once at
 * first profile creation. It is never derived from the name, email or any other
 * personal data, and a database trigger rejects every later change.
 */
export function generateSlug(): string {
  return toBase32(randomBytes(10));
}

/** 8-digit access code (10^8 space), zero padded. */
export function generateAccessCode(): string {
  return randomInt(0, 100_000_000).toString().padStart(8, '0');
}

/** Share-link token: 32 random bytes, base64url. Only its hash is stored. */
export function generateShareToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Human-typed recovery code for two-factor: 10 characters, grouped. */
export function generateRecoveryCode(): string {
  const raw = toBase32(randomBytes(8)).toUpperCase().slice(0, 10);
  return `${raw.slice(0, 5)}-${raw.slice(5)}`;
}

/** Random, URL-safe file name component (never trusts a user supplied name). */
export function generateStorageId(): string {
  return randomBytes(16).toString('hex');
}

/** Constant-time comparison for equal-length hex/base64 digests. */
export function timingSafeEqualString(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  // Compare on a padded, fixed length so the duration does not reveal the
  // position of the first difference or the length of the candidate.
  const length = Math.max(bufA.length, bufB.length, 32);
  const padA = Buffer.alloc(length);
  const padB = Buffer.alloc(length);
  bufA.copy(padA);
  bufB.copy(padB);
  const equal = timingSafeEqual(padA, padB);
  return equal && bufA.length === bufB.length;
}

export function hmacHex(secret: string, message: string): string {
  return createHmac('sha256', secret).update(message, 'utf8').digest('hex');
}
