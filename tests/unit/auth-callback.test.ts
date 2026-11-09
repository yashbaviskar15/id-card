import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createUserClient, warn } = vi.hoisted(() => ({
  createUserClient: vi.fn(),
  warn: vi.fn(),
}));

vi.mock('@/lib/db/user', () => ({ createUserClient }));
vi.mock('@/lib/log', () => ({ log: { warn } }));

import { NextRequest } from 'next/server';
import { GET } from '@/app/auth/callback/route';

const auth = {
  exchangeCodeForSession: vi.fn(),
  verifyOtp: vi.fn(),
};

describe('email authentication callback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createUserClient.mockResolvedValue({ auth });
    auth.exchangeCodeForSession.mockResolvedValue({ error: null });
    auth.verifyOtp.mockResolvedValue({ error: null });
  });

  it('verifies a recovery token and returns to password reset', async () => {
    const response = await GET(new NextRequest(
      'https://ecard-personal.aravanta.tech/auth/callback?token_hash=one-time-token&type=recovery&next=%2Freset',
    ));

    expect(auth.verifyOtp).toHaveBeenCalledWith({
      token_hash: 'one-time-token',
      type: 'recovery',
    });
    expect(response.headers.get('location')).toBe('https://ecard-personal.aravanta.tech/reset');
  });

  it('sends expired links to a recoverable sign-in page', async () => {
    auth.verifyOtp.mockResolvedValueOnce({
      error: { code: 'otp_expired', status: 403 },
    });

    const response = await GET(new NextRequest(
      'https://ecard-personal.aravanta.tech/auth/callback?token_hash=expired&type=recovery',
    ));

    expect(response.headers.get('location')).toBe(
      'https://ecard-personal.aravanta.tech/login?error=link',
    );
    expect(warn).toHaveBeenCalledWith('auth.email_link_verification_failed', {
      flow: 'token_hash',
      code: 'otp_expired',
      status: 403,
    });
  });
});
