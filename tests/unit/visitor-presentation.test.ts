import { describe, expect, it } from 'vitest';
import { visitorPresentationSchema } from '@/lib/validation';

const base = {
  visitor_theme: 'ink',
  visitor_layout: 'standard',
  visitor_intro: '',
};

describe('visitor presentation settings', () => {
  it('accepts only supported themes and layouts', () => {
    expect(visitorPresentationSchema.safeParse({
      ...base,
      visitor_theme: 'ocean',
      visitor_layout: 'compact',
    }).success).toBe(true);
    expect(visitorPresentationSchema.safeParse({
      ...base,
      visitor_theme: 'url(javascript:alert(1))',
    }).success).toBe(false);
  });

  it('trims and limits the plain-text introduction', () => {
    expect(visitorPresentationSchema.parse({
      ...base,
      visitor_intro: '  Hello visitors  ',
    }).visitor_intro).toBe('Hello visitors');
    expect(visitorPresentationSchema.safeParse({
      ...base,
      visitor_intro: 'x'.repeat(181),
    }).success).toBe(false);
  });
});
