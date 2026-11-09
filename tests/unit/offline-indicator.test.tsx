// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ online: true }));

vi.mock('@/components/offline/offline-provider', () => ({
  useOffline: () => ({ online: mocks.online, pending: 0, sync: vi.fn() }),
}));

import { OfflineIndicator } from '@/components/offline/offline-indicator';

afterEach(() => {
  mocks.online = true;
  vi.unstubAllGlobals();
});

describe('offline indicator install prompt', () => {
  it('shows a compact install card and invokes the browser prompt', async () => {
    render(<OfflineIndicator />);

    const prompt = vi.fn().mockResolvedValue(undefined);
    const installEvent = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
    };
    installEvent.prompt = prompt;
    installEvent.userChoice = Promise.resolve({ outcome: 'accepted' });
    window.dispatchEvent(installEvent);

    const heading = await screen.findByText('Install Private Identity');
    expect(heading.closest('.max-w-md')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Install app' }));
    await waitFor(() => expect(prompt).toHaveBeenCalledOnce());
  });
});
