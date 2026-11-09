// @vitest-environment jsdom
import { render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/card/id-card', () => ({
  CARD_HEIGHT_PX: 540,
  CARD_WIDTH_PX: 856,
  IdCard: () => <div data-testid="scaled-card" />,
}));

import { ResponsiveCard } from '@/components/card/responsive-card';
import type { CardData } from '@/components/card/id-card';

class ResizeObserverMock {
  static width = 600;

  constructor(private readonly callback: ResizeObserverCallback) {}

  observe(target: Element) {
    this.callback(
      [{ target, contentRect: { width: ResizeObserverMock.width } as DOMRectReadOnly } as ResizeObserverEntry],
      this as unknown as ResizeObserver,
    );
  }

  disconnect() {}
  unobserve() {}
}

const data: CardData = {
  slug: 'test-profile',
  fullName: 'Test Person',
  dob: null,
  address: null,
  phone: null,
  email: null,
  photoUrl: null,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('responsive card placement', () => {
  it('centers the scaled card in its preview at narrow widths', async () => {
    ResizeObserverMock.width = 600;
    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
    const { container } = render(<ResponsiveCard face="front" data={data} />);
    const scaledCard = container.querySelector('[data-testid="scaled-card"]')?.parentElement;

    await waitFor(() => expect(scaledCard?.style.transform).toContain('scale('));

    expect(scaledCard?.style.left).toBe('50%');
    expect(Number.parseFloat(scaledCard?.style.marginLeft ?? '')).toBeCloseTo(-300);
    expect(Number.parseFloat(scaledCard?.style.transform.match(/scale\(([^)]+)\)/)?.[1] ?? '')).toBeCloseTo(
      600 / 856,
    );
  });

  it('keeps the card centered at its full print-preview scale', async () => {
    ResizeObserverMock.width = 1000;
    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
    const { container } = render(<ResponsiveCard face="back" data={data} />);
    const scaledCard = container.querySelector('[data-testid="scaled-card"]')?.parentElement;

    await waitFor(() => expect(scaledCard?.style.transform).toBe('scale(1)'));

    expect(scaledCard?.style.left).toBe('50%');
    expect(scaledCard?.style.marginLeft).toBe('-428px');
  });
});
