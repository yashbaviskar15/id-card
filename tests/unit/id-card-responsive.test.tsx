import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/card/qr-svg', () => ({ QrSvg: () => null }));

import { IdCard, type CardData } from '@/components/card/id-card';

const cardData: CardData = {
  slug: 'test-profile',
  fullName: 'Test Person',
  dob: null,
  address: null,
  phone: null,
  email: null,
  photoUrl: null,
};

describe('identity card sizing', () => {
  it('fills the scaled card frame on both faces', () => {
    for (const face of ['front', 'back'] as const) {
      const markup = renderToStaticMarkup(<IdCard face={face} data={cardData} />);
      expect(markup).toContain('h-full w-full rounded-[32px]');
    }
  });
});
