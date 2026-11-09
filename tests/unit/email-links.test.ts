import { describe, expect, it } from 'vitest';
import { passwordResetRedirectUrl } from '@/lib/auth/email-links';

describe('password reset email redirects', () => {
  it('uses the configured canonical origin and the recovery callback', () => {
    expect(passwordResetRedirectUrl('https://ecard-personal.aravanta.tech')).toBe(
      'https://ecard-personal.aravanta.tech/auth/callback?next=%2Freset',
    );
  });
});
