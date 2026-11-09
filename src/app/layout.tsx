import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { InteractionGuard } from '@/components/security/interaction-guard';
import { OfflineProvider } from '@/components/offline/offline-provider';
import { OfflineIndicator } from '@/components/offline/offline-indicator';
import { ServiceWorkerRegister } from '@/components/offline/service-worker-register';
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

export const metadata: Metadata = {
  title: {
    default: 'Private Identity Card',
    template: '%s · Private Identity Card',
  },
  description: 'Private identity card and document vault for a single owner.',
  applicationName: 'Private Identity Card',
  robots: { index: false, follow: false, nocache: true },
  referrer: 'no-referrer',
  formatDetection: { telephone: false, email: false, address: false },
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [{ url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: {
    capable: true,
    title: 'Identity',
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
    <html lang="en" className={manrope.variable}>
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        <OfflineProvider>
          <InteractionGuard />
          <TooltipProvider>{children}</TooltipProvider>
          <OfflineIndicator />
          <ServiceWorkerRegister />
        </OfflineProvider>
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
