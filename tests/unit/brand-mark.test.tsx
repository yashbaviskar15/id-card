import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BrandMark } from '@/components/brand/brand-mark';

describe('brand mark sizing', () => {
  it('renders the unchanged P mark at one shared 40px size', () => {
    const markup = renderToStaticMarkup(<BrandMark />);

    expect(markup).toContain('width="40"');
    expect(markup).toContain('height="40"');
    expect(markup).toContain('viewBox="0 0 48 48"');
    expect(markup).toContain('d="M15 9.5h10.4c8.3 0 13.1 4.1 13.1 11.4');
  });
});
