import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/db/middleware';

/**
 * Per-request Content-Security-Policy with a nonce, session refresh, and route
 * protection for /dashboard.
 *
 * The nonce is generated per request; Next.js picks it up from the CSP header
 * and applies it to its own scripts. There are no inline scripts of our own.
 */
function buildCsp(nonce: string, isDev: boolean): string {
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  let supabaseOrigin = '';
  let supabaseWs = '';
  try {
    const url = new URL(supabase);
    supabaseOrigin = url.origin;
    supabaseWs = `wss://${url.host}`;
  } catch {
    /* leave blank when unset; check-env fails the build separately */
  }

  const scriptSrc = ["'self'", `'nonce-${nonce}'`, 'https://challenges.cloudflare.com'];
  if (isDev) scriptSrc.push("'unsafe-eval'");

  return [
    `default-src 'self'`,
    `script-src ${scriptSrc.join(' ')}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob:`,
    `font-src 'self' data:`,
    `connect-src 'self' ${supabaseOrigin} ${supabaseWs} https://challenges.cloudflare.com`,
    `frame-src https://challenges.cloudflare.com`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `object-src 'none'`,
    `upgrade-insecure-requests`,
  ].join('; ');
}

export async function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('base64');
  const isDev = process.env.NODE_ENV !== 'production';
  const csp = buildCsp(nonce, isDev);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);

  const { response, userId } = await updateSession(request);

  // Re-issue the response so the forwarded request headers reach the app.
  const next = NextResponse.next({ request: { headers: requestHeaders } });
  // Copy any refreshed auth cookies written by updateSession.
  for (const cookie of response.cookies.getAll()) {
    next.cookies.set(cookie);
  }
  next.headers.set('Content-Security-Policy', csp);

  const path = request.nextUrl.pathname;

  // The public profile and its contact download are never cached and never
  // indexed, at every layer that could otherwise keep a copy.
  if (path === '/p' || path.startsWith('/p/')) {
    next.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    next.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  }

  // Owner area: require a session. The OWNER_EMAIL allow-list is re-checked
  // server-side in the dashboard layout (middleware has no DB access).
  if (path.startsWith('/dashboard') && !userId) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', path);
    return NextResponse.redirect(url);
  }

  // Already signed in and visiting /login -> go to the dashboard.
  if (path === '/login' && userId) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return next;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|fonts/|.*\\.(?:png|jpg|jpeg|svg|webp|ico|woff2?)$).*)'],
};
