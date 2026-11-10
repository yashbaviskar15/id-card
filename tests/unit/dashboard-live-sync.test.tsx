// @vitest-environment jsdom
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  status: null as null | ((status: string) => void),
  broadcast: null as null | ((message: { payload?: { table?: string } }) => void),
  channel: {
    on: vi.fn(),
    subscribe: vi.fn(),
  },
  supabase: {
    channel: vi.fn(),
    removeChannel: vi.fn(),
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

vi.mock('@/lib/db/browser', () => ({
  createBrowserSupabase: () => mocks.supabase,
}));

import { DashboardLiveSync } from '@/components/dashboard/live-sync';

function subscribe(status: string) {
  mocks.status?.(status);
}

function broadcast(table: string) {
  mocks.broadcast?.({ payload: { table } });
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  mocks.refresh.mockReset();
  mocks.status = null;
  mocks.broadcast = null;
  mocks.channel.on.mockReset().mockImplementation((_type, _filter, callback) => {
    mocks.broadcast = callback;
    return mocks.channel;
  });
  mocks.channel.subscribe.mockReset().mockImplementation((callback) => {
    mocks.status = callback;
    return mocks.channel;
  });
  mocks.supabase.channel.mockReset().mockReturnValue(mocks.channel);
  mocks.supabase.removeChannel.mockReset().mockResolvedValue('ok');
});

afterEach(() => {
  vi.useRealTimers();
});

describe('dashboard realtime invalidations', () => {
  it('uses one private owner channel and coalesces duplicate table events', async () => {
    render(<DashboardLiveSync ownerId="owner-123" />);

    expect(mocks.supabase.channel).toHaveBeenCalledWith('owner:owner-123', { config: { private: true } });
    expect(mocks.channel.on).toHaveBeenCalledOnce();
    subscribe('SUBSCRIBED');
    broadcast('fields');
    broadcast('documents');
    broadcast('fields');

    await advance(120);
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it('falls back at one second while disconnected and stops polling after reconnect', async () => {
    render(<DashboardLiveSync ownerId="owner-123" />);
    subscribe('CHANNEL_ERROR');

    await advance(999);
    expect(mocks.refresh).not.toHaveBeenCalled();
    await advance(1);
    expect(mocks.refresh).toHaveBeenCalledOnce();

    subscribe('SUBSCRIBED');
    await advance(120);
    mocks.refresh.mockClear();
    await advance(2_000);
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it('cleans up the channel on unmount', () => {
    const view = render(<DashboardLiveSync ownerId="owner-123" />);
    view.unmount();
    expect(mocks.supabase.removeChannel).toHaveBeenCalledWith(mocks.channel);
  });
});
