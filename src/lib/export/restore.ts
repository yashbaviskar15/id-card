import 'server-only';
import { unzipSync, strFromU8 } from 'fflate';
import { z } from 'zod';
import { createUserClient } from '@/lib/db/user';
import { encryptField, fieldAad, maskValue } from '@/lib/crypto/fields';
import { DOCUMENTS_BUCKET } from '@/lib/storage';
import { generateSlug } from '@/lib/crypto/random';
import { validateUpload, storagePathFor } from '@/lib/files/validate';
import { log } from '@/lib/log';
import type { FieldKind } from '@/lib/types';

/**
 * Restore side of the `.idbackup` bundle. `parseBackupZip` reads what the export
 * wrote (see src/lib/export/backup.ts) and `restoreBackup` writes it back with
 * the owner-scoped client, so Row Level Security still decides what is allowed.
 *
 * What is restored, honestly:
 *   - the profile's non-immutable columns. `slug` is NEVER written — an existing
 *     profile keeps its slug, and a missing profile gets a brand-new one.
 *   - information fields, with sensitive values re-encrypted under the CURRENT
 *     keyring (the bundle stores them decrypted, so they must be sealed again).
 *   - documents: the file bytes are re-validated against the upload allow-list,
 *     re-uploaded under the owner's storage folder, then the metadata row is
 *     written. `category_id` is dropped because the seeded category ids in this
 *     account are not the ids recorded in the bundle.
 */

const FIELD_KINDS = [
  'email', 'phone', 'social_link', 'address', 'family_contact', 'emergency_contact',
  'important_date', 'note', 'account_record', 'custom',
] as const satisfies readonly FieldKind[];

const backupProfileSchema = z.object({
  full_name: z.string().trim().min(1).max(200).optional(),
  dob: z.string().max(40).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  photo_path: z.string().max(1024).nullable().optional(),
  show_dob: z.boolean().optional(),
  show_address: z.boolean().optional(),
  show_photo: z.boolean().optional(),
  visitor_theme: z.enum(['ink', 'ocean', 'forest']).optional(),
  visitor_layout: z.enum(['standard', 'compact']).optional(),
  visitor_intro: z.string().max(180).optional(),
  is_active: z.boolean().optional(),
});

const backupFieldSchema = z.object({
  id: z.uuid(),
  kind: z.enum(FIELD_KINDS),
  label: z.string().max(80).nullable().optional(),
  value: z.string().max(2000).nullable().optional(),
  is_sensitive: z.boolean().default(false),
  is_public: z.boolean().default(false),
  sort: z.coerce.number().int().default(0),
});

const backupDocumentSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1).max(300),
  storage_path: z.string().max(1024).optional(),
  mime: z.string().min(1).max(200),
  size: z.coerce.number().int().nonnegative(),
  sha256: z.string().max(128).nullable().optional(),
  is_shared: z.boolean().default(false),
  category_id: z.uuid().nullable().optional(),
});

const backupBundleSchema = z.object({
  exported_at: z.string().optional(),
  profile: backupProfileSchema.nullable().optional().default(null),
  fields: z.array(backupFieldSchema).max(10_000).default([]),
  categories: z.array(z.unknown()).max(10_000).default([]),
  documents: z.array(backupDocumentSchema).max(10_000).default([]),
});

export type BackupBundle = z.infer<typeof backupBundleSchema>;

export interface BackupSummary {
  exported_at: string | null;
  has_profile: boolean;
  fields: number;
  documents: number;
  documents_with_files: number;
}

export interface ParsedBackup {
  bundle: BackupBundle;
  documentFiles: Map<string, Uint8Array>;
  summary: BackupSummary;
}

export interface RestoreSummary {
  profile: 'created' | 'updated' | 'unchanged' | 'skipped';
  fields_restored: number;
  fields_failed: number;
  documents_restored: number;
  documents_skipped: number;
  documents_rejected: number;
  documents_failed: number;
}

export class BackupParseError extends Error {
  constructor(message = 'This does not look like a Private Identity backup file.') {
    super(message);
    this.name = 'BackupParseError';
  }
}

function publicKindAllowed(kind: FieldKind): boolean {
  return kind === 'email' || kind === 'phone' || kind === 'social_link';
}

function safeDate(value: string | null | undefined): string | null {
  if (!value) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

/** Unzips a decrypted bundle and validates it. Pure: it never touches the DB. */
export function parseBackupZip(zip: Uint8Array): ParsedBackup {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(zip);
  } catch {
    throw new BackupParseError('The backup archive could not be opened.');
  }

  const backupEntry = files['backup.json'];
  if (!backupEntry) throw new BackupParseError('The backup archive has no data file.');

  let raw: unknown;
  try {
    raw = JSON.parse(strFromU8(backupEntry));
  } catch {
    throw new BackupParseError('The backup data file is not valid JSON.');
  }

  const parsed = backupBundleSchema.safeParse(raw);
  if (!parsed.success) throw new BackupParseError('The backup data has an unexpected shape.');
  const bundle = parsed.data;

  // Entry names are `documents/<id>-<name>`; match on the document id prefix.
  const documentFiles = new Map<string, Uint8Array>();
  for (const [name, bytes] of Object.entries(files)) {
    if (!name.startsWith('documents/')) continue;
    const rest = name.slice('documents/'.length);
    const match = bundle.documents.find((doc) => rest === doc.id || rest.startsWith(`${doc.id}-`));
    if (match && !documentFiles.has(match.id)) documentFiles.set(match.id, bytes);
  }

  return {
    bundle,
    documentFiles,
    summary: {
      exported_at: bundle.exported_at ?? null,
      has_profile: Boolean(bundle.profile?.full_name),
      fields: bundle.fields.length,
      documents: bundle.documents.length,
      documents_with_files: documentFiles.size,
    },
  };
}

/** Writes a parsed bundle back for one owner. Never touches `slug`. */
export async function restoreBackup(ownerId: string, parsed: ParsedBackup): Promise<RestoreSummary> {
  const supabase = await createUserClient();
  const summary: RestoreSummary = {
    profile: 'unchanged',
    fields_restored: 0,
    fields_failed: 0,
    documents_restored: 0,
    documents_skipped: 0,
    documents_rejected: 0,
    documents_failed: 0,
  };

  const profile = parsed.bundle.profile;
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('owner_id', ownerId)
    .maybeSingle<{ id: string }>();

  if (profile?.full_name) {
    const values = {
      full_name: profile.full_name,
      dob: safeDate(profile.dob),
      address: profile.address ?? null,
      photo_path: profile.photo_path ?? null,
      show_dob: profile.show_dob ?? false,
      show_address: profile.show_address ?? false,
      show_photo: profile.show_photo ?? false,
      visitor_theme: profile.visitor_theme ?? 'ink',
      visitor_layout: profile.visitor_layout ?? 'standard',
      visitor_intro: profile.visitor_intro ?? '',
      is_active: profile.is_active ?? true,
    };

    if (existing) {
      const { error } = await supabase.from('profiles').update(values).eq('owner_id', ownerId);
      summary.profile = error ? 'skipped' : 'updated';
      if (error) log.warn('backup.restore profile failed', { code: error.code });
    } else {
      // No profile here yet: create one with a FRESH slug. The bundle's slug is
      // never written — a QR code must be minted for this account, not carried.
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const { error } = await supabase
          .from('profiles')
          .insert({ owner_id: ownerId, slug: generateSlug(), ...values });
        if (!error) {
          summary.profile = 'created';
          break;
        }
        if (error.code !== '23505') {
          log.warn('backup.restore profile insert failed', { code: error.code });
          summary.profile = 'skipped';
          break;
        }
      }
    }
  }

  for (const field of parsed.bundle.fields) {
    const isSensitive = field.is_sensitive;
    const plain = field.value ?? null;
    let value = plain;
    let value_encrypted: string | null = null;
    if (isSensitive && plain) {
      value_encrypted = encryptField(plain, fieldAad(ownerId, field.id, 'value_encrypted'));
      value = maskValue(plain);
    }

    const { error } = await supabase.from('fields').upsert(
      {
        id: field.id,
        owner_id: ownerId,
        kind: field.kind,
        label: field.label ?? null,
        value,
        value_encrypted,
        is_sensitive: isSensitive,
        is_public: publicKindAllowed(field.kind) && field.is_public && !isSensitive,
        sort: field.sort,
      },
      { onConflict: 'id' },
    );

    if (error) {
      summary.fields_failed += 1;
      log.warn('backup.restore field failed', { code: error.code });
    } else {
      summary.fields_restored += 1;
    }
  }

  for (const document of parsed.bundle.documents) {
    const bytes = parsed.documentFiles.get(document.id);
    if (!bytes) {
      // No file in the bundle: do not create a metadata row that points nowhere.
      summary.documents_skipped += 1;
      continue;
    }

    const validation = await validateUpload({
      buffer: Buffer.from(bytes),
      declaredName: document.name,
      declaredMime: document.mime,
    });
    if (!validation.ok) {
      summary.documents_rejected += 1;
      log.warn('backup.restore document rejected', { reason: validation.reason });
      continue;
    }

    const { data: previous } = await supabase
      .from('documents')
      .select('storage_path')
      .eq('id', document.id)
      .eq('owner_id', ownerId)
      .maybeSingle<{ storage_path: string }>();

    const storagePath = storagePathFor(ownerId, validation.data);
    const { error: uploadError } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .upload(storagePath, validation.data.buffer, { contentType: validation.data.mime, upsert: false });
    if (uploadError) {
      summary.documents_failed += 1;
      log.warn('backup.restore upload failed', { code: uploadError.name });
      continue;
    }

    const { error: dbError } = await supabase.from('documents').upsert(
      {
        id: document.id,
        owner_id: ownerId,
        category_id: null,
        name: validation.data.safeName,
        storage_path: storagePath,
        mime: validation.data.mime,
        size: validation.data.size,
        sha256: document.sha256 ?? null,
        is_shared: document.is_shared,
      },
      { onConflict: 'id' },
    );

    if (dbError) {
      // Never leave an orphan object behind when the metadata row is refused.
      await supabase.storage.from(DOCUMENTS_BUCKET).remove([storagePath]);
      summary.documents_failed += 1;
      log.warn('backup.restore document failed', { code: dbError.code });
      continue;
    }

    if (previous?.storage_path && previous.storage_path !== storagePath) {
      await supabase.storage.from(DOCUMENTS_BUCKET).remove([previous.storage_path]);
    }
    summary.documents_restored += 1;
  }

  return summary;
}
