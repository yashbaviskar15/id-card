import { NextResponse, type NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/db/service';
import { readVisitorSession, visitorPhotoUrl } from '@/lib/access/visitor';
import { log } from '@/lib/log';
import { slugSchema } from '@/lib/validation';
import type { GrantedProfile } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

/**
 * Live profile stream for a visitor who already holds a valid access session.
 *
 * The visitor page no longer polls on a slow timer: it opens one Server-Sent
 * Events connection and the server re-projects the grant-filtered profile on a
 * short interval, pushing a frame only when the projection actually changed.
 * Because the projection is produced by `get_granted_profile()`, a revoked or
 * expired grant and the owner's kill switch all end the stream immediately —
 * and nothing is ever cached: every frame is `no-store`.
 */
const POLL_MS = 1_200;
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

  const session = await readVisitorSession(parsed.data);
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
      let knownPhotoPath: string | null = null;
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
          // Ask the browser's EventSource to reconnect and pick up a fresh frame.
          write('event: recycle\ndata: {}\n\n');
          finish();
          return;
        }

        const { data, error } = await supabase.rpc('get_granted_profile', {
          p_grant_id: session.grantId,
          p_slug: parsed.data,
        });

        if (error) {
          log.warn('access.stream read failed', { code: error.code });
          schedulePoll();
          return;
        }
        if (!data) {
          endStream();
          return;
        }

        const profile = data as GrantedProfile;
        const hash = JSON.stringify(profile);
        if (hash !== lastHash) {
          const photoChanged = profile.photo_path !== knownPhotoPath;
          const photoUrl = photoChanged ? visitorPhotoUrl(parsed.data, profile.photo_path) : undefined;
          if (closed) return;
          knownPhotoPath = profile.photo_path;
          lastHash = hash;
          write(
            `data: ${JSON.stringify({
              profile,
              photoChanged,
              ...(photoChanged ? { photoUrl: photoUrl ?? null } : {}),
            })}\n\n`,
          );
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

      // Open the connection promptly so the browser is not left waiting.
      write('retry: 3000\n\n');
      void poll();
      scheduleHeartbeat();
    },
  });

  return new NextResponse(body, { headers: STREAM_HEADERS });
}
