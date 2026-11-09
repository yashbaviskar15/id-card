import { describe, expect, it } from 'vitest';
import { filterAndSortShareLinks, paginateShareLinks } from '@/lib/share/list';

const links = [
  {
    id: '1',
    document_name: 'zeta.pdf',
    created_at: '2026-02-03T12:00:00.000Z',
    expires_at: '2026-02-05T12:00:00.000Z',
    download_count: 1,
    status: 'active' as const,
  },
  {
    id: '2',
    document_name: 'Alpha.txt',
    created_at: '2026-02-01T12:00:00.000Z',
    expires_at: '2026-02-02T12:00:00.000Z',
    download_count: 4,
    status: 'expired' as const,
  },
  {
    id: '3',
    document_name: 'beta.pdf',
    created_at: '2026-02-02T12:00:00.000Z',
    expires_at: '2026-02-04T12:00:00.000Z',
    download_count: 2,
    status: 'revoked' as const,
  },
];

describe('share-link list filtering and sorting', () => {
  it('filters by document name and status without mutating the input', () => {
    const result = filterAndSortShareLinks(links, 'PDF', 'active', 'newest');

    expect(result.map((link) => link.id)).toEqual(['1']);
    expect(links.map((link) => link.id)).toEqual(['1', '2', '3']);
  });

  it('sorts names case-insensitively and by soonest expiry', () => {
    expect(filterAndSortShareLinks(links, '', 'all', 'name').map((link) => link.id)).toEqual([
      '2',
      '3',
      '1',
    ]);
    expect(filterAndSortShareLinks(links, '', 'all', 'expires').map((link) => link.id)).toEqual([
      '2',
      '3',
      '1',
    ]);
  });

  it('orders newest links and most-downloaded links first', () => {
    expect(filterAndSortShareLinks(links, '', 'all', 'newest').map((link) => link.id)).toEqual([
      '1',
      '3',
      '2',
    ]);
    expect(filterAndSortShareLinks(links, '', 'all', 'downloads').map((link) => link.id)).toEqual([
      '2',
      '3',
      '1',
    ]);
  });

  it('paginates results and clamps the requested page to the available range', () => {
    const page = paginateShareLinks([...links, ...links, ...links, ...links], 2, 5);
    expect(page).toMatchObject({ page: 2, pageCount: 3, firstIndex: 5 });
    expect(page.items.map((link) => link.id)).toEqual(['3', '1', '2', '3', '1']);

    const clamped = paginateShareLinks(links, 20, 2);
    expect(clamped).toMatchObject({ page: 2, pageCount: 2, firstIndex: 2 });
    expect(clamped.items.map((link) => link.id)).toEqual(['3']);
  });
});
