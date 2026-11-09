/**
 * Service worker for the Private Identity Card PWA.
 *
 * Goal: let the installed app open and show the last-seen screens with no
 * network. Two rules keep privacy intact:
 *   1. Visitor and auth surfaces (`/p/*`, `/s/*`, `/api/*`, `/login`, `/auth/*`)
 *      are NEVER cached and never served from cache.
 *   2. Static assets are cache-first; every other same-origin GET is
 *      network-first with a cache fallback, then the offline page.
 *
 * Caches can be wiped on demand via `postMessage('CLEAR_CACHES')`, which the app
 * sends on sign-out so no owner data survives on a shared device.
 */
const VERSION = 'v1';
const SHELL_CACHE = `shell-${VERSION}`;
const RUNTIME_CACHE = `runtime-${VERSION}`;
const OFFLINE_URL = '/offline';

const SHELL_ASSETS = [
  OFFLINE_URL,
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
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
        keys.filter((key) => key !== SHELL_CACHE && key !== RUNTIME_CACHE).map((key) => caches.delete(key)),
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
        await Promise.all(keys.map((key) => caches.delete(key)));
      })(),
    );
  }
});

// Paths that must never be stored or replayed from cache.
const NEVER_CACHE = [
  /^\/p(\/|$)/,
  /^\/s(\/|$)/,
  /^\/api(\/|$)/,
  /^\/auth(\/|$)/,
  /^\/login(\/|$)/,
  /^\/forgot(\/|$)/,
  /^\/reset(\/|$)/,
];
// Downloads and generated documents are never cached either.
const NEVER_CACHE_EXT = /\.(?:pdf|docx?|xlsx?|zip|vcf)$/i;
const STATIC_EXT = /\.(?:js|css|mjs|woff2?|ttf|otf|png|jpe?g|gif|svg|webp|avif|ico|json)$/i;

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isNeverCache(url) {
  return NEVER_CACHE.some((re) => re.test(url.pathname)) || NEVER_CACHE_EXT.test(url.pathname);
}

async function cacheFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response && response.ok && response.type === 'basic') {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const fallback = await caches.match(request);
    if (fallback) return fallback;
    throw error;
  }
}

async function networkFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok && response.type === 'basic') {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw error;
  }
}

async function handleNavigation(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok && response.type === 'basic') {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request, { ignoreSearch: false });
    if (cached) return cached;
    const shell = await caches.open(SHELL_CACHE);
    const offline = await shell.match(OFFLINE_URL);
    if (offline) return offline;
    throw error;
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
  if (isNeverCache(url)) return;

  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/fonts/') ||
    STATIC_EXT.test(url.pathname)
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }

  event.respondWith(networkFirst(request));
});
