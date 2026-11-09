export type ShareLinkSort = 'newest' | 'oldest' | 'name' | 'expires' | 'downloads';
export type ShareLinkStatusFilter = 'all' | 'active' | 'expired' | 'revoked' | 'exhausted';

export interface ShareLinkPage<T> {
  items: T[];
  page: number;
  pageCount: number;
  firstIndex: number;
}

type ShareLinkListItem = {
  document_name: string;
  created_at: string;
  expires_at: string;
  download_count: number;
  status: Exclude<ShareLinkStatusFilter, 'all'>;
};

export function filterAndSortShareLinks<T extends ShareLinkListItem>(
  links: readonly T[],
  query: string,
  status: ShareLinkStatusFilter,
  sort: ShareLinkSort,
): T[] {
  const search = query.trim().toLocaleLowerCase();

  return links
    .filter((link) => {
      const matchesQuery =
        !search ||
        link.document_name.toLocaleLowerCase().includes(search) ||
        link.status.includes(search);
      return matchesQuery && (status === 'all' || link.status === status);
    })
    .map((link, index) => ({ link, index }))
    .sort((left, right) => {
      let comparison = 0;

      if (sort === 'name') {
        comparison = left.link.document_name.localeCompare(right.link.document_name, undefined, {
          sensitivity: 'base',
          numeric: true,
        });
      } else if (sort === 'expires') {
        comparison = Date.parse(left.link.expires_at) - Date.parse(right.link.expires_at);
      } else if (sort === 'downloads') {
        comparison = right.link.download_count - left.link.download_count;
      } else {
        comparison = Date.parse(left.link.created_at) - Date.parse(right.link.created_at);
        if (sort === 'newest') comparison *= -1;
      }

      return comparison || left.index - right.index;
    })
    .map(({ link }) => link);
}

export function paginateShareLinks<T>(
  links: readonly T[],
  requestedPage: number,
  pageSize: number,
): ShareLinkPage<T> {
  const safePageSize = Math.max(1, Math.floor(pageSize));
  const pageCount = Math.max(1, Math.ceil(links.length / safePageSize));
  const page = Math.min(Math.max(1, Math.floor(requestedPage)), pageCount);
  const firstIndex = (page - 1) * safePageSize;

  return {
    items: links.slice(firstIndex, firstIndex + safePageSize),
    page,
    pageCount,
    firstIndex,
  };
}
