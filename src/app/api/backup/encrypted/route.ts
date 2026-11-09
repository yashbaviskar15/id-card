import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getOwnerOrNull } from '@/lib/auth/session';
import { isReauthenticated } from '@/lib/auth/reauth';
import { buildBackupZip, encryptBackup } from '@/lib/export/backup';
import { alertBackupExported } from '@/lib/mail';

export const dynamic = 'force-dynamic';

const NO_STORE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
} as const;

const requestSchema = z.object({
  passphrase: z.string().min(12).max(1024),
});

export async function POST(request: NextRequest) {
  const owner = await getOwnerOrNull();
  if (!owner) return new NextResponse('Unauthorized', { status: 401, headers: NO_STORE });
  if (!(await isReauthenticated())) {
    return new NextResponse('Please confirm your password before exporting a backup.', { status: 403, headers: NO_STORE });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new NextResponse('Invalid request', { status: 400, headers: NO_STORE });
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return new NextResponse('Use a backup passphrase with at least 12 characters.', { status: 400, headers: NO_STORE });
  }

  try {
    const zip = await buildBackupZip(owner.id, true);
    const encrypted = encryptBackup(zip, parsed.data.passphrase);
    void alertBackupExported().catch(() => {});
    return new NextResponse(new Uint8Array(encrypted), {
      headers: {
        ...NO_STORE,
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': 'attachment; filename="identity-full-backup.idbackup"',
      },
    });
  } catch (error) {
    console.error('api.backup.encrypted failed', { name: error instanceof Error ? error.name : 'unknown' });
    return new NextResponse('Backup could not be created. Please try again.', { status: 500, headers: NO_STORE });
  }
}
