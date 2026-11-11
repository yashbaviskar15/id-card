import { NextResponse, type NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/db/service';
import { sendAccessDigest } from '@/lib/mail';
import { loadOwnerId } from '@/lib/owner';
import { isCronAuthorized } from '@/lib/cron';
import { log } from '@/lib/log';

export const dynamic = 'force-dynamic';

/** Window summarised by one digest run. Daily cron → the last 24 hours. */
const WINDOW_HOURS = 24;
/** Upper bound on rows read; a personal card never approaches this. */
const MAX_ROWS = 5000;

/**
 * M-5 — daily access digest. Summarises the access log (how many checks, how
 * many codes were accepted, how many were refused, distinct visitors) and
 * emails it to the owner, so they no longer have to open the dashboard just to
 * see who got in.
 */
export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const ownerId = await loadOwnerId();
  if (!ownerId) {
    return NextResponse.json({ ok: true, skipped: 'no_profile' });
  }

  try {
    const supabase = createServiceClient();
    const since = new Date(Date.now() - WINDOW_HOURS * 3_600_000).toISOString();
    const { data, error } = await supabase
      .from('access_log')
      .select('outcome, ip_hash')
      .eq('owner_id', ownerId)
      .gt('created_at', since)
      .limit(MAX_ROWS);

    if (error) {
      log.warn('cron.digest failed', { code: error.code });
      return NextResponse.json({ ok: false, error: 'digest_failed' }, { status: 500 });
    }

    const rows = (data ?? []) as { outcome: string; ip_hash: string | null }[];
    if (rows.length === 0) {
      return NextResponse.json({ ok: true, skipped: 'no_activity' });
    }

    const counts = new Map<string, number>();
    const visitors = new Set<string>();
    let granted = 0;
    for (const row of rows) {
      counts.set(row.outcome, (counts.get(row.outcome) ?? 0) + 1);
      if (row.outcome === 'granted') granted += 1;
      if (row.ip_hash) visitors.add(row.ip_hash);
    }
    let topOutcome: { outcome: string; count: number } | undefined;
    for (const [outcome, count] of counts) {
      if (!topOutcome || count > topOutcome.count) topOutcome = { outcome, count };
    }

    await sendAccessDigest({
      windowHours: WINDOW_HOURS,
      total: rows.length,
      granted,
      denied: rows.length - granted,
      used: granted,
      uniqueVisitors: visitors.size,
      topOutcome,
    });
    log.info('cron.digest ran', { total: rows.length, granted });
    return NextResponse.json({ ok: true, total: rows.length, granted });
  } catch (cause) {
    log.warn('cron.digest threw', {
      message: cause instanceof Error ? cause.message : 'unknown',
    });
    return NextResponse.json({ ok: false, error: 'digest_threw' }, { status: 500 });
  }
}
