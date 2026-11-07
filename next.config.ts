import type { NextConfig } from 'next';

/**
 * Static security headers. The per-request Content-Security-Policy (which needs
 * a nonce) is set in middleware.ts.
 */
const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'no-referrer' },
  { key: 'X-Frame-Options', value: 'DENY' },
  // Isolate the document from other browsing contexts and stop other origins
  // from embedding or reading our responses (defence in depth for XS-Leaks).
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  },
];

const noStore = [
  { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, max-age=0' },
  { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // Native/ESM-only packages must stay outside the server bundle.
  serverExternalPackages: ['@resvg/resvg-js', '@node-rs/argon2', 'file-type', 'sharp'],
  experimental: {
    serverActions: { bodySizeLimit: '51mb' },
  },
  async headers() {
    return [
      { source: '/(.*)', headers: securityHeaders },
      { source: '/p/:path*', headers: noStore },
      { source: '/s/:path*', headers: noStore },
      { source: '/api/:path*', headers: noStore },
      { source: '/dashboard/:path*', headers: noStore },
    ];
  },
};

export default nextConfig;
