import 'server-only';
import { createCipheriv, randomBytes, scryptSync } from 'node:crypto';
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
  const salt = randomBytes(16);
  const nonce = randomBytes(12);
  const key = scryptSync(passphrase, salt, 32);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  const ciphertext = Buffer.concat([cipher.update(zip), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([Buffer.from('IDB1'), salt, nonce, tag, ciphertext]);
}
