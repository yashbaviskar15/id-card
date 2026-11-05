import 'server-only';
import path from 'node:path';
import { fileTypeFromBuffer } from 'file-type';
import { serverEnv } from '@/lib/env.server';
import { generateStorageId } from '@/lib/crypto/random';

/**
 * Server-side upload validation. The browser's declared MIME type and file name
 * are treated as hostile: the real type is sniffed from the bytes, the extension
 * must agree with it, and executables/scripts — including SVG, which can carry
 * script — are refused outright.
 */

const ALLOWED_TYPES: Record<string, readonly string[]> = {
  'application/pdf': ['pdf'],
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/webp': ['webp'],
  'image/heic': ['heic'],
  'image/heif': ['heif'],
  'image/tiff': ['tif', 'tiff'],
  'application/msword': ['doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
  'application/vnd.ms-excel': ['xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['xlsx'],
  'application/vnd.oasis.opendocument.text': ['odt'],
  'application/vnd.oasis.opendocument.spreadsheet': ['ods'],
  'text/plain': ['txt'],
  'text/csv': ['csv'],
  'application/rtf': ['rtf'],
};

const IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/tiff',
]);

/** Extensions that must never be accepted, whatever the sniffed type says. */
const BLOCKED_EXTENSIONS = new Set([
  'svg', 'svgz', 'html', 'htm', 'xhtml', 'js', 'mjs', 'cjs', 'jsx', 'ts', 'tsx',
  'exe', 'dll', 'com', 'bat', 'cmd', 'msi', 'scr', 'pif', 'cpl', 'sh', 'bash',
  'ps1', 'psm1', 'jar', 'app', 'apk', 'dmg', 'vbs', 'wsf', 'hta', 'php', 'py', 'rb',
]);

/** Deliberately conservative: letters, digits, dot, dash, underscore only. */
export function safeFileName(originalName: string): string {
  const base = path.basename(originalName).normalize('NFKD');
  const cleaned = base
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+/, '')
    .slice(0, 120);
  return cleaned || 'file';
}

export function maxUploadBytes(): number {
  return serverEnv().MAX_UPLOAD_MB * 1024 * 1024;
}

/** Lowercased extension of a declared file name, without the dot. */
export function declaredExtension(originalName: string): string {
  return path.extname(originalName).replace(/^\./, '').toLowerCase().slice(0, 12);
}

/** True when the declared name carries an extension we refuse outright. */
export function isBlockedExtension(originalName: string): boolean {
  return BLOCKED_EXTENSIONS.has(declaredExtension(originalName));
}

/**
 * Provisional destination for a direct-to-storage upload.
 *
 * The browser uploads large files straight to the private bucket (a request body
 * that big would be rejected by the hosting platform before it ever reached a
 * server action), so the server has to pick the path before it has seen a single
 * byte. Nothing is recorded in the vault until `finalizeUpload` has pulled the
 * object back, sniffed its real content and agreed it is what it claims to be —
 * a rejected object is deleted again.
 */
export function pendingStoragePath(ownerId: string, declaredName: string): string {
  const stem = safeFileName(declaredName).replace(/\.[^.]+$/, '') || 'file';
  const extension = declaredExtension(declaredName) || 'bin';
  return `${ownerId}/${generateStorageId()}-${stem}.${extension}`;
}

/** Display name for a document: the original, minus control characters. */
export function displayName(originalName: string): string {
  const base = path.basename(originalName).replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return base.slice(0, 300) || 'Untitled';
}

export interface UploadCandidate {
  buffer: Buffer;
  declaredName: string;
  declaredMime: string;
  /** When true only image types are accepted (e.g. the profile photo). */
  imagesOnly?: boolean;
}

export type UploadRejection =
  | 'too_large'
  | 'empty'
  | 'blocked_extension'
  | 'type_not_allowed'
  | 'type_mismatch'
  | 'content_mismatch';

export interface ValidatedUpload {
  mime: string;
  extension: string;
  safeName: string;
  size: number;
  buffer: Buffer;
}

export type UploadValidation =
  | { ok: true; data: ValidatedUpload }
  | { ok: false; reason: UploadRejection };

export async function validateUpload(candidate: UploadCandidate): Promise<UploadValidation> {
  const { buffer, declaredName, declaredMime, imagesOnly } = candidate;
  const size = buffer.byteLength;

  if (size === 0) return { ok: false, reason: 'empty' };
  if (size > maxUploadBytes()) return { ok: false, reason: 'too_large' };

  const rawExtension = path.extname(declaredName).replace(/^\./, '').toLowerCase();
  if (rawExtension && BLOCKED_EXTENSIONS.has(rawExtension)) {
    return { ok: false, reason: 'blocked_extension' };
  }
  if (declaredMime && BLOCKED_EXTENSIONS.has(declaredMime.split('/').pop() ?? '')) {
    return { ok: false, reason: 'type_not_allowed' };
  }

  // Sniff the real type from the bytes. `file-type` knows nothing about plain
  // text containers, so a text/csv/rtf upload falls back to its declared type
  // — but only when the declared type itself is on the allow-list.
  const sniffed = await fileTypeFromBuffer(buffer);
  const mime = sniffed?.mime;

  if (mime) {
    if (!(mime in ALLOWED_TYPES)) return { ok: false, reason: 'type_not_allowed' };
    if (imagesOnly && !IMAGE_TYPES.has(mime)) return { ok: false, reason: 'type_not_allowed' };
    if (declaredMime && declaredMime !== mime && !declaredMime.startsWith('image/')) {
      return { ok: false, reason: 'type_mismatch' };
    }
    const extension = sniffed?.ext ?? ALLOWED_TYPES[mime][0];
    if (!ALLOWED_TYPES[mime].includes(extension)) return { ok: false, reason: 'content_mismatch' };
    return {
      ok: true,
      data: { mime, extension, safeName: safeFileName(declaredName), size, buffer },
    };
  }

  if (!(declaredMime in ALLOWED_TYPES)) return { ok: false, reason: 'type_mismatch' };
  if (imagesOnly) return { ok: false, reason: 'type_not_allowed' };
  const declaredExtension = ALLOWED_TYPES[declaredMime][0];
  if (rawExtension && rawExtension !== declaredExtension) {
    return { ok: false, reason: 'content_mismatch' };
  }
  return {
    ok: true,
    data: { mime: declaredMime, extension: declaredExtension, safeName: safeFileName(declaredName), size, buffer },
  };
}

/**
 * Storage object path. Always scoped to the owner's folder (the storage policies
 * only ever allow `<uid>/...`) and always random-prefixed, so a hostile file name
 * can never escape the folder or collide.
 */
export function storagePathFor(ownerId: string, validated: ValidatedUpload): string {
  const stem = validated.safeName.replace(new RegExp(`\\.${validated.extension}$`, 'i'), '');
  return `${ownerId}/${generateStorageId()}-${stem || 'file'}.${validated.extension}`;
}
