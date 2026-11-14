import { NextResponse, type NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/db/service';
import { readAlbumSession } from '@/lib/access/visitor';
import { log } from '@/lib/log';
import { slugSchema } from '@/lib/validation';
import type { GrantedPhotoAlbum } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

/**
 * Live photo-album stream for a visitor who already holds a valid album
 * session. The visitor album page opens one Server-Sent Events connection;
 * the server re-projects the grant-filtered album on a short interval and
 * pushes a frame only when the projection actually changed. Because the
 * projection comes from `get_granted_photos()`, a revoked or expired grant,
 * the owner's kill switch and the album on/off switch all end the stream
 * immediately. Nothing is ever cached: every frame is `no-store`.
 */
const POLL_MS = 500;
const HEARTBEAT_MS = 15_000;
/** Long-lived connections are recycled so a stalled proxy can never pin one. */
const MAX_STREAM_MS = 10 * 60_000;

const STREAM_HEADERS = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-store, no-cache, must-revalidate, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
} as const;

const CLOSE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
} as const;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const parsed = slugSchema.safeParse(slug);
  if (!parsed.success) {
    return new NextResponse('Not found', { status: 404, headers: CLOSE_HEADERS });
  }

  const session = await readAlbumSession(parsed.data);
  if (!session) {
    return new NextResponse('Unauthorized', { status: 401, headers: CLOSE_HEADERS });
  }

  const supabase = createServiceClient();
  const encoder = new TextEncoder();

  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let pollTimer: ReturnType<typeof setTimeout> | null = null;
      let heartbeatTimer: ReturnType<typeof setTimeout> | null = null;
      let lastHash: string | null = null;
      const startedAt = Date.now();

      const finish = () => {
        if (closed) return;
        closed = true;
        if (pollTimer) clearTimeout(pollTimer);
        if (heartbeatTimer) clearTimeout(heartbeatTimer);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      const write = (chunk: string) => {
        if (closed) return false;
        try {
          controller.enqueue(encoder.encode(chunk));
          return true;
        } catch {
          finish();
          return false;
        }
      };

      const endStream = () => {
        write('event: ended\ndata: {}\n\n');
        finish();
      };

      const schedulePoll = () => {
        if (closed) return;
        pollTimer = setTimeout(() => void poll(), POLL_MS);
      };

      const poll = async () => {
        if (closed) return;
        if (Date.now() - startedAt > MAX_STREAM_MS) {
          write('event: recycle\ndata: {}\n\n');
          finish();
          return;
        }

        const { data, error } = await supabase.rpc('get_granted_photos', {
          p_grant_id: session.grantId,
          p_slug: parsed.data,
        });

        if (error) {
          log.warn('access.album.stream read failed', { code: error.code });
          schedulePoll();
          return;
        }
        if (!data) {
          endStream();
          return;
        }

        const album = data as GrantedPhotoAlbum;
        const hash = JSON.stringify(album);
        if (hash !== lastHash) {
          if (closed) return;
          lastHash = hash;
          write(`data: ${JSON.stringify({ album })}\n\n`);
        }

        schedulePoll();
      };

      const scheduleHeartbeat = () => {
        if (closed) return;
        heartbeatTimer = setTimeout(() => {
          write(`: keep-alive ${Date.now()}\n\n`);
          scheduleHeartbeat();
        }, HEARTBEAT_MS);
      };

      request.signal.addEventListener('abort', finish, { once: true });

      write('retry: 1000\n\n');
      void poll();
      scheduleHeartbeat();
    },
  });

  return new NextResponse(body, { headers: STREAM_HEADERS });
}
