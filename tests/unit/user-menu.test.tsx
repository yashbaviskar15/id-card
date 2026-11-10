// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/link', () => ({
  default: ({ href, ...props }: React.ComponentProps<'a'>) => <a href={href} {...props} />,
}));
vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard/access',
}));
vi.mock('@/components/offline/sign-out-form', () => ({
  SignOutForm: ({ children }: { children: React.ReactNode }) => <form>{children}</form>,
}));

import { UserMenu } from '@/app/dashboard/user-menu';

describe('mobile account menu', () => {
  it('opens account links inline without a nested popup', () => {
    render(<UserMenu name="Owner" email="owner@example.com" compact />);

    expect(screen.queryByRole('link', { name: 'Profile' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open signed-in account menu' }));

    expect(screen.getByRole('navigation', { name: 'Account' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Profile' })).toHaveAttribute('href', '/dashboard/profile');
  });
});
