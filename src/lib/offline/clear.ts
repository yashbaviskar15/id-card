'use client';

/**
 * Clears every offline artefact on the device: cached pages/assets (via the
 * service worker) and any queued, not-yet-synced edits. Called on sign-out so
 * nothing owner-related survives on a shared device.
 */
export async function clearAppOfflineData(): Promise<void> {
  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      const worker = registration?.active ?? navigator.serviceWorker.controller;
      worker?.postMessage('CLEAR_CACHES');
    }
  } catch {
    /* best effort */
  }

  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch {
    /* best effort */
  }

  try {
    const { clearQueue } = await import('./outbox');
    await clearQueue();
  } catch {
    /* best effort */
  }
}
