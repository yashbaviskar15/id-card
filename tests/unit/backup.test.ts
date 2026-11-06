import { createDecipheriv, scryptSync } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';

let encryptBackup: (zip: Uint8Array, passphrase: string) => Buffer;

beforeAll(async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://unit-test.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'unit-test-anon-key-value-long-enough';
  process.env.NEXT_PUBLIC_SITE_URL = 'https://unit-test.example';
  ({ encryptBackup } = await import('@/lib/export/backup'));
});

describe('encrypted backup envelope', () => {
  it('round-trips the ZIP payload using its passphrase', () => {
    const original = Buffer.from('zip archive test payload');
    const passphrase = 'correct horse battery staple';
    const encrypted = encryptBackup(original, passphrase);

    expect(encrypted.subarray(0, 4).toString()).toBe('IDB1');
    const salt = encrypted.subarray(4, 20);
    const nonce = encrypted.subarray(20, 32);
    const tag = encrypted.subarray(32, 48);
    const key = scryptSync(passphrase, salt, 32);
    const decipher = createDecipheriv('aes-256-gcm', key, nonce);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted.subarray(48)), decipher.final()]);

    expect(decrypted).toEqual(original);
  });

  it('rejects a different passphrase', () => {
    const encrypted = encryptBackup(Buffer.from('private data'), 'the correct passphrase');
    const salt = encrypted.subarray(4, 20);
    const nonce = encrypted.subarray(20, 32);
    const tag = encrypted.subarray(32, 48);
    const key = scryptSync('a different passphrase', salt, 32);
    const decipher = createDecipheriv('aes-256-gcm', key, nonce);
    decipher.setAuthTag(tag);

    expect(() => {
      decipher.update(encrypted.subarray(48));
      decipher.final();
    }).toThrow();
  });
});
