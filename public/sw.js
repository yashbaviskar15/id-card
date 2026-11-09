/**
 * Service worker for the Private Identity Card PWA.
 *
 * Goal: make the installed app shell available offline without persisting
 * authenticated pages, visitor data, or server responses on a shared device.
 * Only static assets are cached. Server-backed features remain online-only.
 *
 * Caches can be wiped on demand via `postMessage('CLEAR_CACHES')`, which the app
 * sends on sign-out so no owner data survives on a shared device.
 */
const VERSION = 'v8';
const STATIC_CACHE = `identity-static-${VERSION}`;
const OFFLINE_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#ffffff">
    <title>Private Identity | Offline</title>
    <style>
      :root{color-scheme:light;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#111827;background:#f5f6f8}
      *{box-sizing:border-box}body{min-height:100vh;margin:0;display:grid;place-items:center;padding:24px}
      main{width:min(100%,420px);padding:32px 24px;border:1px solid #dde1e7;border-radius:18px;background:#fff;text-align:center;box-shadow:0 8px 28px #11182712}
      .brand{display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:28px;text-align:left}
      .brand img{display:block;border-radius:11px}
      .name{display:block;font-size:15px;font-weight:700}
      h1{margin:0;font-size:21px}.message{margin:10px 0 0;color:#667085;font-size:14px;line-height:1.6}
      .note{margin-top:22px;padding:12px;border-radius:10px;background:#f3f4f6;color:#475467;font-size:12px;line-height:1.55}
      a.btn{display:inline-block;margin-top:22px;padding:10px 18px;border:1px solid #dde1e7;border-radius:10px;color:#111827;font-size:14px;font-weight:600;text-decoration:none}
      a.btn:hover{background:#f3f4f6}
    </style>
  </head>
  <body>
    <main>
      <header class="brand"><img src="/logo.svg" width="40" height="40" alt="Private Identity"><span class="name">Private Identity</span></header>
      <h1>You are offline</h1>
      <p class="message">The app shell is ready, but private dashboard pages are not cached for offline browsing.</p>
      <p class="note">Explicitly queued card or information edits stay in this browser until you reconnect. Sign-in, access codes, file sharing, downloads, and security settings need an internet connection.</p>
      <a class="btn" href="/dashboard">Try again</a>
    </main>
  </body>
</html>`;

const SHELL_ASSETS = [
  '/logo.svg',
  '/manifest.webmanifest',
  '/icons/icon-32.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
  '/icons/maskable-512.png',
  '/icons/pwa-icon-192.png',
  '/icons/pwa-icon-512.png',
  '/icons/pwa-maskable-512.png',
  '/icons/pwa-apple-touch-icon.png',
  '/favicon.ico',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      await Promise.allSettled(
        SHELL_ASSETS.map((url) => cache.add(new Request(url, { cache: 'reload' }))),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => (key === 'shell-v1' || key === 'runtime-v1' || key.startsWith('identity-static-')) && key !== STATIC_CACHE)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  const data = event.data;
  if (data === 'CLEAR_CACHES' || (data && data.type === 'CLEAR_CACHES')) {
    event.waitUntil(
      (async () => {
        const keys = await caches.keys();
        await Promise.all(
          keys.filter((key) => key === 'runtime-v1' || key.startsWith('identity-runtime-')).map((key) => caches.delete(key)),
        );
      })(),
    );
  }
});

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isCacheableStatic(response) {
  const cacheControl = response.headers.get('Cache-Control') ?? '';
  return response.ok
    && response.type === 'basic'
    && !/\b(?:no-store|private)\b/i.test(cacheControl)
    && !response.headers.has('Set-Cookie');
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (isCacheableStatic(response)) {
      await cache.put(request, response.clone()).catch(() => undefined);
    }
    return response;
  } catch (error) {
    const fallback = await cache.match(request);
    if (fallback) return fallback;
    throw error;
  }
}

function offlineResponse() {
  return new Response(OFFLINE_HTML, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      'Content-Security-Policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    },
  });
}

async function handleNavigation(request) {
  try {
    const response = await fetch(request);
    if (response.status === 502 || response.status === 503 || response.status === 504) {
      return offlineResponse();
    }
    return response;
  } catch {
    return offlineResponse();
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  if (!isSameOrigin(url)) return;

  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/fonts/') ||
    url.pathname === '/logo.svg' ||
    url.pathname === '/manifest.webmanifest' ||
    url.pathname === '/favicon.ico'
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
  }
});
