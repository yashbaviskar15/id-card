// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  online: true,
  clearOfflineData: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('@/components/offline/offline-provider', () => ({
  useOffline: () => ({ online: mocks.online, pending: 0, sync: vi.fn() }),
}));
vi.mock('@/lib/offline/clear', () => ({
  clearAppOfflineData: mocks.clearOfflineData,
}));
vi.mock('sonner', () => ({
  toast: { error: mocks.toastError },
}));

import { SignOutForm } from '@/components/offline/sign-out-form';

afterEach(() => {
  mocks.online = true;
  mocks.clearOfflineData.mockReset();
  mocks.toastError.mockReset();
  vi.unstubAllGlobals();
});

describe('sign out confirmation', () => {
  it('requires confirmation before requesting sign-out', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: false });
    vi.stubGlobal('fetch', fetch);
    render(
      <SignOutForm>
        <button type="submit">Sign out</button>
      </SignOutForm>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    let dialog = await screen.findByRole('alertdialog');
    expect(fetch).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(fetch).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Sign out' }));

    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    expect(mocks.clearOfflineData).not.toHaveBeenCalled();
  });

  it('keeps sign-out confirmation unavailable while offline', () => {
    mocks.online = false;
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    render(
      <SignOutForm>
        <button type="submit">Sign out</button>
      </SignOutForm>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
    expect(mocks.toastError).toHaveBeenCalledWith(
      'Reconnect before signing out so the server session can be revoked safely.',
    );
  });
});
