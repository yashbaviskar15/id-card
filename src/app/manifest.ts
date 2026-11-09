import type { MetadataRoute } from 'next';

/**
 * Web app manifest. Makes the app installable on mobile and laptop and lets it
 * launch in standalone mode (no browser chrome) even without a network
 * connection, backed by the service worker in `public/sw.js`.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Private Identity Card',
    short_name: 'Identity',
    description: 'Private identity card and document vault for a single owner.',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#ffffff',
    theme_color: '#ffffff',
    lang: 'en',
    dir: 'ltr',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
