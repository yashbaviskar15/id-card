// @vitest-environment jsdom

import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Countdown } from '@/components/countdown';

afterEach(() => {
  vi.useRealTimers();
});

describe('Countdown', () => {
  it('uses the server deadline and does not expire before the exact instant', () => {
    vi.useFakeTimers();
    const now = Date.now();
    vi.setSystemTime(now);
    const onExpire = vi.fn();

    render(
      <Countdown
        until={new Date(now + 1500).toISOString()}
        serverNow={new Date(now).toISOString()}
        onExpire={onExpire}
      />,
    );

    expect(screen.getByText('0:02')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1499));
    expect(onExpire).not.toHaveBeenCalled();
    expect(screen.getByText('0:01')).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(1));
    expect(onExpire).toHaveBeenCalledTimes(1);
    expect(screen.getByText('0:00')).toBeInTheDocument();
  });
});
