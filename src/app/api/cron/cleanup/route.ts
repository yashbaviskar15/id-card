import { NextResponse, type NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/db/service';
import { isCronAuthorized } from '@/lib/cron';
import { log } from '@/lib/log';

export const dynamic = 'force-dynamic';

/**
 * M-3 — scheduled housekeeping. Calls the service-role-only database function
 * that revokes expired codes and share links and purges old rate-limit
 * bookkeeping, so the owner never has to tidy up by hand.
 */
export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase.rpc('expire_stale_security_records');
    if (error) {
      log.warn('cron.cleanup failed', { code: error.code });
      return NextResponse.json({ ok: false, error: 'cleanup_failed' }, { status: 500 });
    }
    log.info('cron.cleanup ran', { stats: data as Record<string, unknown> });
    return NextResponse.json({ ok: true, stats: data });
  } catch (cause) {
    log.warn('cron.cleanup threw', {
      message: cause instanceof Error ? cause.message : 'unknown',
    });
    return NextResponse.json({ ok: false, error: 'cleanup_threw' }, { status: 500 });
  }
}
