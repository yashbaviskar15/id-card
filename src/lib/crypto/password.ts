import 'server-only';
import { hash, verify } from '@node-rs/argon2';

/**
 * Argon2id identifier as used by @node-rs/argon2. Inlined because the package
 * exposes it as a `const enum`, which is illegal to import under
 * `isolatedModules`. See node_modules/@node-rs/argon2/index.d.ts.
 */
const ARGON2ID = 2;

/**
 * Password hashing for share links (the owner's own login password is managed by
 * Supabase Auth). Argon2id with the OWASP-recommended parameters.
 */
const OPTIONS = {
  algorithm: ARGON2ID,
  memoryCost: 19_456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export async function verifyPassword(storedHash: string, password: string): Promise<boolean> {
  try {
    return await verify(storedHash, password, OPTIONS);
  } catch {
    return false;
  }
}
