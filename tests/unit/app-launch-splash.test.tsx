// @vitest-environment jsdom
import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppLaunchSplash } from '@/components/app-launch-splash';

const originalMatchMedia = window.matchMedia;

function mockDisplayMode(standalone: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn((query: string) => ({
      matches: query === '(display-mode: standalone)' && standalone,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

afterEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: originalMatchMedia,
  });
  document.documentElement.classList.remove('installed-app-mode');
  vi.useRealTimers();
});

describe('installed app launch splash', () => {
  it('stays out of the regular web app', async () => {
    mockDisplayMode(false);
    render(<AppLaunchSplash />);

    await waitFor(() => expect(screen.queryByText('Private Identity')).not.toBeInTheDocument());
    expect(document.documentElement).not.toHaveClass('installed-app-mode');
  });

  it('shows the compact brand briefly in standalone app mode', () => {
    mockDisplayMode(true);
    vi.useFakeTimers();
    render(<AppLaunchSplash />);

    expect(screen.getByText('Private Identity')).toBeInTheDocument();
    expect(document.documentElement).toHaveClass('installed-app-mode');

    act(() => {
      vi.advanceTimersByTime(1100);
    });

    expect(screen.queryByText('Private Identity')).not.toBeInTheDocument();
    expect(document.documentElement).not.toHaveClass('installed-app-mode');
  });
});
