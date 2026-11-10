import { beforeEach, describe, expect, it, vi } from 'vitest';

const { updateSession } = vi.hoisted(() => ({
  updateSession: vi.fn(),
}));

vi.mock('@/lib/db/middleware', () => ({ updateSession }));

import { NextRequest, NextResponse } from 'next/server';
import { middleware } from '@/middleware';

describe('auth middleware redirects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateSession.mockResolvedValue({
      response: NextResponse.next(),
      userId: null,
      userEmail: null,
      needsMfa: false,
    });
  });

  it('redirects a fully signed-in owner away from the login page', async () => {
    updateSession.mockResolvedValueOnce({
      response: NextResponse.next(),
      userId: 'owner-id',
      userEmail: 'owner@example.com',
      needsMfa: false,
    });

    const response = await middleware(new NextRequest('https://example.com/login'));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://example.com/dashboard');
  });

  it('keeps an owner with pending MFA on the login page', async () => {
    updateSession.mockResolvedValueOnce({
      response: NextResponse.next(),
      userId: 'owner-id',
      userEmail: 'owner@example.com',
      needsMfa: true,
    });

    const response = await middleware(new NextRequest('https://example.com/login'));

    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
  });

  it('skips session refresh on the email callback route', async () => {
    const response = await middleware(new NextRequest('https://example.com/auth/callback?code=one-time'));

    expect(updateSession).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
  });
});
