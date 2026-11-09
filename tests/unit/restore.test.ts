import { zipSync, strToU8 } from 'fflate';
import { beforeAll, describe, expect, it } from 'vitest';

/**
 * The restore side shares the envelope with the export side, so these tests pin
 * the round-trip and the ZIP parsing that `POST /api/backup/restore` relies on.
 * They only exercise pure functions — no database and no passphrase is logged.
 */
let encryptBackup: (zip: Uint8Array, passphrase: string) => Buffer;
let decryptBackup: (bundle: Uint8Array, passphrase: string) => Buffer;
let BackupDecryptError: new () => Error;
let parseBackupZip: (zip: Uint8Array) => {
  bundle: { documents: unknown[]; fields: unknown[] };
  documentFiles: Map<string, Uint8Array>;
  summary: { exported_at: string | null; has_profile: boolean; fields: number; documents: number; documents_with_files: number };
};
let BackupParseError: new (message?: string) => Error;

const DOCUMENT_ID = '22222222-2222-4222-8222-222222222222';

function sampleZip(): Uint8Array {
  const bundle = {
    exported_at: '2026-01-02T03:04:05.000Z',
    profile: { full_name: 'Ada Lovelace' },
    fields: [
      {
        id: '11111111-1111-4111-8111-111111111111',
        kind: 'note',
        label: 'Note',
        value: 'hello',
        is_sensitive: false,
        is_public: false,
        sort: 0,
      },
    ],
    categories: [],
    documents: [{ id: DOCUMENT_ID, name: 'passport.pdf', mime: 'application/pdf', size: 3, is_shared: false }],
  };
  return zipSync({
    'backup.json': strToU8(JSON.stringify(bundle)),
    [`documents/${DOCUMENT_ID}-passport.pdf`]: strToU8('abc'),
  });
}

beforeAll(async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://unit-test.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'unit-test-anon-key-value-long-enough';
  process.env.NEXT_PUBLIC_SITE_URL = 'https://unit-test.example';
  const backup = await import('@/lib/export/backup');
  encryptBackup = backup.encryptBackup;
  decryptBackup = backup.decryptBackup;
  BackupDecryptError = backup.BackupDecryptError;
  const restore = await import('@/lib/export/restore');
  parseBackupZip = restore.parseBackupZip;
  BackupParseError = restore.BackupParseError;
});

describe('decryptBackup (single source of truth for the envelope)', () => {
  it('round-trips a ZIP payload with its passphrase', () => {
    const zip = sampleZip();
    const passphrase = 'correct horse battery staple';
    const encrypted = encryptBackup(zip, passphrase);
    expect(decryptBackup(encrypted, passphrase)).toEqual(Buffer.from(zip));
  });

  it('refuses a wrong passphrase with one generic error', () => {
    const encrypted = encryptBackup(sampleZip(), 'the correct passphrase');
    expect(() => decryptBackup(encrypted, 'a different passphrase')).toThrow(BackupDecryptError);
  });

  it('refuses a file that is not an .idbackup envelope', () => {
    expect(() => decryptBackup(Buffer.from('not a backup at all, definitely long enough'), 'whatever')).toThrow(
      BackupDecryptError,
    );
  });
});

describe('parseBackupZip', () => {
  it('reads the bundle and matches document files to their metadata', () => {
    const parsed = parseBackupZip(sampleZip());
    expect(parsed.summary).toEqual({
      exported_at: '2026-01-02T03:04:05.000Z',
      has_profile: true,
      fields: 1,
      documents: 1,
      documents_with_files: 1,
    });
    expect(parsed.documentFiles.get(DOCUMENT_ID)).toBeDefined();
  });

  it('rejects an archive without a data file', () => {
    const zip = zipSync({ 'manifest.json': strToU8('{}') });
    expect(() => parseBackupZip(zip)).toThrow(BackupParseError);
  });

  it('rejects a data file with an unexpected shape', () => {
    const zip = zipSync({ 'backup.json': strToU8(JSON.stringify({ fields: [{ nope: true }] })) });
    expect(() => parseBackupZip(zip)).toThrow(BackupParseError);
  });
});
