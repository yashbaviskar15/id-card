import { NextResponse, type NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/db/service';
import { buildBackupZip, encryptBackup } from '@/lib/export/backup';
import { alertScheduledBackup } from '@/lib/mail';
import { loadOwnerId } from '@/lib/owner';
import { isCronAuthorized } from '@/lib/cron';
import { serverEnv } from '@/lib/env.server';
import { log } from '@/lib/log';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Private bucket that only the service role can read or write (migration 0012). */
const BACKUPS_BUCKET = 'backups';
const BACKUP_PREFIX = 'scheduled';
/** Keeps the seven most recent scheduled backups; older ones are pruned. */
const KEEP_BACKUPS = 7;

function backupPath(at: Date): string {
  const stamp = at.toISOString().replace(/[:.]/g, '-');
  return `${BACKUP_PREFIX}/${stamp}.idbackup`;
}

/**
 * M-4 — scheduled encrypted backup. Builds the same `.idbackup` bundle as the
 * manual export, encrypts it with BACKUP_PASSPHRASE, stores it in the private
 * `backups` bucket and emails the owner the outcome. No browser session is
 * involved, so everything runs through the service client.
 */
export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  let passphrase: string | undefined;
  try {
    passphrase = serverEnv().BACKUP_PASSPHRASE;
  } catch (cause) {
    log.warn('cron.backup env invalid', {
      message: cause instanceof Error ? cause.message : 'unknown',
    });
  }
  if (!passphrase) {
    const error = 'BACKUP_PASSPHRASE is not configured.';
    await alertScheduledBackup({ ok: false, documentCount: 0, sizeBytes: 0, error });
    return NextResponse.json({ ok: false, error: 'backup_not_configured' }, { status: 503 });
  }

  const ownerId = await loadOwnerId();
  if (!ownerId) {
    return NextResponse.json({ ok: true, skipped: 'no_profile' });
  }

  try {
    const supabase = createServiceClient();
    const zip = await buildBackupZip(ownerId, true, supabase);
    const encrypted = encryptBackup(zip, passphrase);
    const path = backupPath(new Date());

    const { error: uploadError } = await supabase.storage
      .from(BACKUPS_BUCKET)
      .upload(path, encrypted, { contentType: 'application/octet-stream', upsert: false });
    if (uploadError) throw new Error(uploadError.message);

    const { count } = await supabase
      .from('documents')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', ownerId);

    // Prune the oldest bundles beyond the retention window.
    const { data: existing } = await supabase.storage
      .from(BACKUPS_BUCKET)
      .list(BACKUP_PREFIX, { limit: 1000, sortBy: { column: 'name', order: 'asc' } });
    const files = (existing ?? []).filter((file) => file.name.endsWith('.idbackup'));
    const excess = files.slice(0, Math.max(0, files.length - KEEP_BACKUPS));
    if (excess.length > 0) {
      await supabase.storage
        .from(BACKUPS_BUCKET)
        .remove(excess.map((file) => `${BACKUP_PREFIX}/${file.name}`));
    }

    await alertScheduledBackup({
      ok: true,
      documentCount: count ?? 0,
      sizeBytes: encrypted.byteLength,
      storedPath: `${BACKUPS_BUCKET}/${path}`,
    });
    log.info('cron.backup ran', { documents: count ?? 0, bytes: encrypted.byteLength });
    return NextResponse.json({ ok: true, storedPath: path, documents: count ?? 0 });
  } catch (cause) {
    const error = cause instanceof Error ? cause.message : 'unknown error';
    log.warn('cron.backup failed', { message: error });
    await alertScheduledBackup({ ok: false, documentCount: 0, sizeBytes: 0, error });
    return NextResponse.json({ ok: false, error: 'backup_failed' }, { status: 500 });
  }
}
