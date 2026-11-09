'use client';

import { useEffect, useState } from 'react';
import { CloudUpload, Download, RefreshCw, WifiOff } from 'lucide-react';
import { useOffline } from '@/components/offline/offline-provider';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Bottom bar that surfaces offline state and queued edits, and offers the
 * browser install prompt so the app can be added to the home screen / desktop.
 * Renders nothing when online, nothing is queued and no install is offered.
 */
export function OfflineIndicator() {
  const { online, pending, sync } = useOffline();
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallEvent(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const showInstall = Boolean(installEvent) && !installed;
  if (online !== false && pending === 0 && !showInstall) return null;
  const installOnly = showInstall && online !== false && pending === 0;

  async function install() {
    if (!installEvent) return;
    try {
      await installEvent.prompt();
      await installEvent.userChoice;
    } catch {
      // A browser may reject a stale install prompt.
    } finally {
      setInstallEvent(null);
    }
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] print:hidden lg:left-64 lg:justify-end lg:px-6">
      <div
        className={`flex w-full flex-wrap items-center gap-3 rounded-xl border border-subtle-line bg-white/95 px-4 py-3 text-sm shadow-card backdrop-blur ${
          installOnly ? 'max-w-md sm:flex-nowrap sm:justify-between' : 'max-w-3xl'
        }`}
      >
        {online === false ? (
          <div className="flex min-w-0 flex-1 items-start gap-2 text-ink">
            <WifiOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0">
              <span className="block font-semibold">You are offline</span>
              <span className="block text-xs leading-5 text-label">
                Private data and server actions need a connection. Unsynced edits stay on this device.
              </span>
            </span>
          </div>
        ) : null}

        {pending > 0 ? (
          <span className="flex items-center gap-2 text-label">
            <CloudUpload className="h-4 w-4" aria-hidden="true" />
            {pending} change{pending === 1 ? '' : 's'} waiting to sync
          </span>
        ) : null}

        {installOnly ? (
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-ink">Install Private Identity</p>
            <p className="text-xs leading-5 text-label">Add the app for quick access on this device.</p>
          </div>
        ) : null}

        {!installOnly ? <span className="grow" /> : null}

        {pending > 0 ? (
          <button
            type="button"
            onClick={sync}
            disabled={!online}
            className="flex items-center gap-2 rounded-lg border border-subtle-line px-3 py-1.5 font-medium text-ink hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Sync now
          </button>
        ) : null}

        {showInstall ? (
          <button
            type="button"
            onClick={() => void install()}
            className={`flex shrink-0 items-center gap-2 rounded-lg bg-ink px-3 py-1.5 font-medium text-white hover:opacity-90 ${
              installOnly ? 'w-full justify-center sm:w-auto' : ''
            }`}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Install app
          </button>
        ) : null}
      </div>
    </div>
  );
}
