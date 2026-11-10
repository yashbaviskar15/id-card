import { createHash } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { isShareUnlocked } from '@/lib/share/unlock';
import { resolveShareLink, shareTokenSchema } from '@/lib/share/load';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const POLL_MS = 500;
const MAX_STREAM_MS = 10 * 60_000;
const STREAM_HEADERS = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-store, no-cache, must-revalidate, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
} as const;
const NO_STORE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
} as const;

function targetRevision(target: NonNullable<Awaited<ReturnType<typeof resolveShareLink>>>) {
  return createHash('sha256')
    .update(JSON.stringify([target.ownerId, target.name, target.mime, target.size, target.storagePath, target.requiresPassword]))
    .digest('hex');
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const parsed = shareTokenSchema.safeParse(token);
  if (!parsed.success) return new NextResponse('Not found', { status: 404, headers: NO_STORE });

  const initialTarget = await resolveShareLink(parsed.data);
  if (!initialTarget) return new NextResponse('Not found', { status: 404, headers: NO_STORE });
  if (initialTarget.requiresPassword && !(await isShareUnlocked(parsed.data))) {
    return new NextResponse('Unauthorized', { status: 401, headers: NO_STORE });
  }

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let pollTimer: ReturnType<typeof setTimeout> | null = null;
      let lastRevision: string | null = null;
      const startedAt = Date.now();

      const finish = () => {
        if (closed) return;
        closed = true;
        if (pollTimer) clearTimeout(pollTimer);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      const write = (frame: string) => {
        if (closed) return false;
        try {
          controller.enqueue(encoder.encode(frame));
          return true;
        } catch {
          finish();
          return false;
        }
      };

      const schedulePoll = () => {
        if (!closed) pollTimer = setTimeout(() => void poll(), POLL_MS);
      };

      const poll = async () => {
        if (closed) return;
        if (Date.now() - startedAt > MAX_STREAM_MS) {
          write('event: recycle\ndata: {}\n\n');
          finish();
          return;
        }

        const target = await resolveShareLink(parsed.data);
        if (!target || (target.requiresPassword && !(await isShareUnlocked(parsed.data)))) {
          write('event: ended\ndata: {}\n\n');
          finish();
          return;
        }

        const revision = targetRevision(target);
        if (revision !== lastRevision) {
          lastRevision = revision;
          // The revision is opaque; never send the token, storage path, or file data.
          write('event: update\ndata: {}\n\n');
        }
        schedulePoll();
      };

      request.signal.addEventListener('abort', finish, { once: true });
      write('retry: 1000\n\n');
      void poll();
    },
  });

  return new NextResponse(body, { headers: STREAM_HEADERS });
}
