import { NextResponse, type NextRequest } from 'next/server';
import { getOwnerOrNull } from '@/lib/auth/session';
import { isReauthenticated } from '@/lib/auth/reauth';
import { buildBackupZip, loadBackupData } from '@/lib/export/backup';

export const dynamic = 'force-dynamic';

const NO_STORE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
} as const;

function csvCell(value: unknown): string {
  let text = value == null ? '' : typeof value === 'string' ? value : JSON.stringify(value);
  if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function toCsv(data: Awaited<ReturnType<typeof loadBackupData>>): string {
  const rows: unknown[][] = [['record_type', 'id', 'kind', 'label', 'value', 'sensitive', 'public', 'created_at']];
  if (data.profile) {
    for (const [label, value] of Object.entries(data.profile)) {
      rows.push(['profile', data.profile.id, '', label, value, '', '', data.profile.created_at]);
    }
  }
  for (const field of data.fields) {
    rows.push(['field', field.id, field.kind, field.label, field.value, field.is_sensitive, field.is_public, field.created_at]);
  }
  for (const category of data.categories) {
    rows.push(['category', category.id, '', category.name, '', '', '', category.created_at]);
  }
  for (const document of data.documents) {
    rows.push(['document', document.id, document.mime, document.name, document.size, '', document.is_shared, document.created_at]);
  }
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}

export async function GET(request: NextRequest) {
  const owner = await getOwnerOrNull();
  if (!owner) return new NextResponse('Unauthorized', { status: 401, headers: NO_STORE });
  if (!(await isReauthenticated())) {
    return new NextResponse('Please confirm your password before exporting a backup.', { status: 403, headers: NO_STORE });
  }

  const format = request.nextUrl.searchParams.get('format');
  try {
    if (format === 'zip') {
      const zip = await buildBackupZip(owner.id, false);
      return new NextResponse(new Uint8Array(zip), {
        headers: {
          ...NO_STORE,
          'Content-Type': 'application/zip',
          'Content-Disposition': 'attachment; filename="identity-documents.zip"',
        },
      });
    }

    const data = await loadBackupData(owner.id);
    if (format === 'csv') {
      return new NextResponse(toCsv(data), {
        headers: {
          ...NO_STORE,
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="identity-export.csv"',
        },
      });
    }
    if (format === 'json') {
      return new NextResponse(JSON.stringify(data, null, 2), {
        headers: {
          ...NO_STORE,
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': 'attachment; filename="identity-export.json"',
        },
      });
    }
    return new NextResponse('Unsupported export format', { status: 400, headers: NO_STORE });
  } catch (error) {
    console.error('api.backup failed', { name: error instanceof Error ? error.name : 'unknown' });
    return new NextResponse('Backup could not be created. Please try again.', { status: 500, headers: NO_STORE });
  }
}
