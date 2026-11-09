import 'server-only';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { zipSync, strToU8 } from 'fflate';
import { createUserClient } from '@/lib/db/user';
import { decryptField, fieldAad, isEncryptedEnvelope } from '@/lib/crypto/fields';
import { DOCUMENTS_BUCKET } from '@/lib/storage';

export interface BackupData {
  exported_at: string;
  profile: Record<string, unknown> | null;
  fields: Array<Record<string, unknown>>;
  categories: Array<Record<string, unknown>>;
  documents: Array<Record<string, unknown>>;
}

export class BackupDataError extends Error {
  constructor() {
    super('Backup data could not be loaded.');
    this.name = 'BackupDataError';
  }
}

/**
 * `.idbackup` envelope layout, shared by export and import so the two can never
 * drift apart. Changing any of these values breaks every existing backup file,
 * so the amount of data a backup carries may change but the container may not.
 */
export const BACKUP_MAGIC = 'IDB1';
export const BACKUP_SALT_BYTES = 16;
export const BACKUP_NONCE_BYTES = 12;
export const BACKUP_TAG_BYTES = 16;
export const BACKUP_KEY_BYTES = 32;
const BACKUP_HEADER_BYTES =
  BACKUP_MAGIC.length + BACKUP_SALT_BYTES + BACKUP_NONCE_BYTES + BACKUP_TAG_BYTES;

export class BackupDecryptError extends Error {
  constructor() {
    super('The backup file could not be decrypted. Check the passphrase and the file.');
    this.name = 'BackupDecryptError';
  }
}

export async function loadBackupData(ownerId: string): Promise<BackupData> {
  const supabase = await createUserClient();
  const [profileResult, fieldResult, categoryResult, documentResult] = await Promise.all([
    supabase.from('profiles').select('*').eq('owner_id', ownerId).maybeSingle(),
    supabase.from('fields').select('*').eq('owner_id', ownerId).order('sort', { ascending: true }),
    supabase.from('categories').select('*').eq('owner_id', ownerId).order('sort', { ascending: true }),
    supabase.from('documents').select('*').eq('owner_id', ownerId).order('created_at', { ascending: true }),
  ]);

  if (profileResult.error || fieldResult.error || categoryResult.error || documentResult.error) {
    throw new BackupDataError();
  }

  const fields = (fieldResult.data ?? []).map((field) => {
    let value = field.value;
    if (field.is_sensitive && field.value_encrypted && isEncryptedEnvelope(field.value_encrypted)) {
      value = decryptField(
        field.value_encrypted,
        fieldAad(ownerId, field.id, 'value_encrypted'),
      );
    }
    return {
      id: field.id,
      kind: field.kind,
      label: field.label,
      value,
      is_sensitive: field.is_sensitive,
      is_public: field.is_public,
      sort: field.sort,
      created_at: field.created_at,
      updated_at: field.updated_at,
    };
  });

  return {
    exported_at: new Date().toISOString(),
    profile: profileResult.data,
    fields,
    categories: categoryResult.data ?? [],
    documents: documentResult.data ?? [],
  };
}

function safeFilename(value: string): string {
  return value.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 200) || 'document';
}

export async function buildBackupZip(ownerId: string, includeData: boolean): Promise<Uint8Array> {
  const backup = await loadBackupData(ownerId);
  const files: Record<string, Uint8Array> = {};
  if (includeData) files['backup.json'] = strToU8(JSON.stringify(backup, null, 2));

  const supabase = await createUserClient();
  for (const document of backup.documents) {
    const path = String(document.storage_path);
    const { data, error } = await supabase.storage.from(DOCUMENTS_BUCKET).download(path);
    if (error || !data) throw new BackupDataError();
    const fileBytes = new Uint8Array(await data.arrayBuffer());
    files[`documents/${String(document.id)}-${safeFilename(String(document.name))}`] = fileBytes;
  }

  files['manifest.json'] = strToU8(JSON.stringify({
    exported_at: backup.exported_at,
    includes_personal_data: includeData,
    document_count: backup.documents.length,
  }, null, 2));
  return zipSync(files, { level: 6 });
}

export function encryptBackup(zip: Uint8Array, passphrase: string): Buffer {
  const salt = randomBytes(BACKUP_SALT_BYTES);
  const nonce = randomBytes(BACKUP_NONCE_BYTES);
  const key = scryptSync(passphrase, salt, BACKUP_KEY_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  const ciphertext = Buffer.concat([cipher.update(zip), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([Buffer.from(BACKUP_MAGIC), salt, nonce, tag, ciphertext]);
}

/**
 * Reverse of `encryptBackup` — the single source of truth for the `.idbackup`
 * envelope. The layout is fixed (and the unit tests pin it):
 *
 *   magic(4) | salt(16) | nonce(12) | gcm-tag(16) | ciphertext(rest)
 *
 * A wrong passphrase, a truncated file or a tampered byte all fail the GCM tag
 * check and surface as one `BackupDecryptError`, so no partial plaintext ever
 * escapes and the caller cannot tell "wrong key" from "damaged file".
 */
export function decryptBackup(bundle: Uint8Array, passphrase: string): Buffer {
  const buffer = Buffer.from(bundle);
  if (buffer.length <= BACKUP_HEADER_BYTES) throw new BackupDecryptError();
  if (buffer.subarray(0, BACKUP_MAGIC.length).toString('latin1') !== BACKUP_MAGIC) {
    throw new BackupDecryptError();
  }

  const magicEnd = BACKUP_MAGIC.length;
  const salt = buffer.subarray(magicEnd, magicEnd + BACKUP_SALT_BYTES);
  const nonceStart = magicEnd + BACKUP_SALT_BYTES;
  const nonce = buffer.subarray(nonceStart, nonceStart + BACKUP_NONCE_BYTES);
  const tagStart = nonceStart + BACKUP_NONCE_BYTES;
  const tag = buffer.subarray(tagStart, tagStart + BACKUP_TAG_BYTES);
  const ciphertext = buffer.subarray(tagStart + BACKUP_TAG_BYTES);

  try {
    const key = scryptSync(passphrase, salt, BACKUP_KEY_BYTES);
    const decipher = createDecipheriv('aes-256-gcm', key, nonce);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    throw new BackupDecryptError();
  }
}
