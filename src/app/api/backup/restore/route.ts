import { NextResponse, type NextRequest } from 'next/server';
import { headers } from 'next/headers';
import { z } from 'zod';
import { getOwnerOrNull } from '@/lib/auth/session';
import { isReauthenticated } from '@/lib/auth/reauth';
import { decryptBackup, BackupDecryptError } from '@/lib/export/backup';
import { parseBackupZip, restoreBackup, BackupParseError, type RestoreSummary } from '@/lib/export/restore';
import { writeAudit } from '@/lib/audit';
import { clientIpFromHeaders, hashIp, truncateUserAgent } from '@/lib/crypto/ip';
import { log } from '@/lib/log';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
} as const;

/** Hard ceiling on an uploaded bundle so a hostile file cannot exhaust memory. */
const RESTORE_MAX_BYTES = 256 * 1024 * 1024;

const passphraseSchema = z.string().min(12).max(1024);

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

export async function POST(request: NextRequest) {
  const owner = await getOwnerOrNull();
  if (!owner) return json({ ok: false, error: 'Unauthorized', code: 'unauthorized' }, 401);
  if (!(await isReauthenticated())) {
    return json(
      { ok: false, error: 'Please confirm your password before restoring a backup.', code: 'reauth_required' },
      403,
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ ok: false, error: 'Invalid request.', code: 'invalid_request' }, 400);
  }

  const passphrase = passphraseSchema.safeParse(form.get('passphrase'));
  if (!passphrase.success) {
    return json(
      { ok: false, error: 'Enter the backup passphrase (at least 12 characters).', code: 'invalid_passphrase' },
      400,
    );
  }

  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return json({ ok: false, error: 'Choose a .idbackup file to restore.', code: 'invalid_file' }, 400);
  }
  if (file.size > RESTORE_MAX_BYTES) {
    return json({ ok: false, error: 'That backup file is too large to restore here.', code: 'file_too_large' }, 400);
  }

  const dryRun = form.get('dryRun') === 'true';

  let parsed;
  try {
    const bundle = Buffer.from(await file.arrayBuffer());
    const zip = decryptBackup(bundle, passphrase.data);
    parsed = parseBackupZip(zip);
  } catch (error) {
    if (error instanceof BackupDecryptError) {
      return json(
        { ok: false, error: error.message, code: 'decrypt_failed' },
        400,
      );
    }
    if (error instanceof BackupParseError) {
      return json({ ok: false, error: error.message, code: 'parse_failed' }, 400);
    }
    log.warn('api.backup.restore failed', { name: error instanceof Error ? error.name : 'unknown' });
    return json({ ok: false, error: 'The backup could not be read.', code: 'failed' }, 500);
  }

  if (dryRun) {
    return json({ ok: true, dry_run: true, summary: parsed.summary });
  }

  let restored: RestoreSummary;
  try {
    restored = await restoreBackup(owner.id, parsed);
  } catch (error) {
    log.warn('api.backup.restore write failed', { name: error instanceof Error ? error.name : 'unknown' });
    return json({ ok: false, error: 'The backup could not be restored. Try again.', code: 'failed' }, 500);
  }

  const headerList = await headers();
  await writeAudit({
    ownerId: owner.id,
    actor: 'owner',
    action: 'backup.restore',
    entityType: 'backup',
    detail: { exported_at: parsed.summary.exported_at, ...restored },
    ipHash: hashIp(clientIpFromHeaders(headerList)),
    userAgent: truncateUserAgent(headerList.get('user-agent')),
  });

  return json({ ok: true, dry_run: false, restored });
}
