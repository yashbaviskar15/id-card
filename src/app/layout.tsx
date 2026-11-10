import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { ThemeProvider } from 'next-themes';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { OfflineProvider } from '@/components/offline/offline-provider';
import { OfflineIndicator } from '@/components/offline/offline-indicator';
import { ServiceWorkerRegister } from '@/components/offline/service-worker-register';
import { OfflineNavigationGuard } from '@/components/offline/dashboard-navigation-guard';
import { AppLaunchSplash } from '@/components/app-launch-splash';
import { RouteProgress } from '@/components/loading/route-progress';
import { SecurityGuard } from '@/components/security/security-guard';
import { siteUrl } from '@/lib/env';
import { createShareMetadata } from '@/lib/seo';
import './globals.css';

/**
 * Manrope is self-hosted (public/fonts) so the build never depends on a font CDN
 * and the printed card always renders with the same typeface.
 */
const manrope = localFont({
  src: [{ path: '../../public/fonts/manrope-latin-var.woff2', weight: '400 800', style: 'normal' }],
  variable: '--font-manrope',
  display: 'swap',
  fallback: ['system-ui', 'Segoe UI', 'Helvetica Neue', 'Arial', 'sans-serif'],
});
const inter = localFont({
  src: [{ path: '../../public/fonts/inter-latin-variable.woff2', weight: '400 700', style: 'normal' }],
  variable: '--font-inter',
  display: 'swap',
  fallback: ['system-ui', 'Segoe UI', 'Helvetica Neue', 'Arial', 'sans-serif'],
});

export const metadata: Metadata = {
  ...createShareMetadata({
    title: 'Private Identity Card',
    description: 'Private identity cards and secure file sharing, protected by owner-issued access.',
    robots: { index: false, follow: false, nocache: true },
  }),
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Private Identity Card',
    template: '%s · Private Identity Card',
  },
  description: 'Private identity card and document vault for a single owner.',
  applicationName: 'Private Identity Card',
  robots: { index: false, follow: false, nocache: true },
  referrer: 'no-referrer',
  formatDetection: { telephone: false, email: false, address: false },
  manifest: new URL('/manifest.webmanifest', `${siteUrl}/`).toString(),
  icons: {
    icon: [
      { url: new URL('/favicon.ico?v=3', `${siteUrl}/`).toString(), sizes: 'any' },
      {
        url: new URL('/icons/icon-32.png?v=3', `${siteUrl}/`).toString(),
        sizes: '32x32',
        type: 'image/png',
      },
      {
        url: new URL('/icons/icon-192.png?v=3', `${siteUrl}/`).toString(),
        sizes: '192x192',
        type: 'image/png',
      },
    ],
    apple: [
      {
        url: new URL('/icons/pwa-apple-touch-icon.png?v=3', `${siteUrl}/`).toString(),
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  },
  appleWebApp: {
    capable: true,
    title: 'Private Identity',
    statusBarStyle: 'default',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#ffffff',
  colorScheme: 'light',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${manrope.variable} ${inter.variable}`} suppressHydrationWarning>
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        {/*
         * `data-shell` is written on <html> before paint so the dark dashboard
         * never flashes light; the palette itself is scoped to `.dashboard-shell`
         * in globals.css, so auth, visitor and share pages stay light. Colour
         * scheme is left to our own CSS (enableColorScheme={false}) for the same
         * reason, and the storage key keeps this choice separate from anything
         * else on the domain.
         */}
        <ThemeProvider
          attribute="data-shell"
          defaultTheme="system"
          enableSystem
          enableColorScheme={false}
          disableTransitionOnChange
          storageKey="pis-shell"
        >
          <OfflineProvider>
            <SecurityGuard />
            <RouteProgress />
            <OfflineNavigationGuard />
            <TooltipProvider>{children}</TooltipProvider>
            <OfflineIndicator />
            <ServiceWorkerRegister />
            <AppLaunchSplash />
          </OfflineProvider>
          <Toaster position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
