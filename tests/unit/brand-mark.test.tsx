import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BrandMark } from '@/components/brand/brand-mark';

describe('brand mark sizing', () => {
  it('renders the shared PNG logo at the unchanged 40px size', () => {
    const markup = renderToStaticMarkup(<BrandMark />);

    expect(markup).toContain('src="/logo.png"');
    expect(markup).toContain('alt="Private Identity"');
    expect(markup).toContain('width="40"');
    expect(markup).toContain('height="40"');
  });
});
