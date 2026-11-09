'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

/**
 * Debounced search box. Typing updates `?q=` after a short pause, exactly like
 * the vault filter, so the server component re-runs the query and renders
 * results — there is no client-side data access.
 */
export function SearchClient({ queryValue }: { queryValue: string }) {
  const [query, setQuery] = useState(queryValue);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    setQuery(queryValue);
  }, [queryValue]);

  useEffect(() => {
    if (query.trim() === queryValue) return;
    const timer = setTimeout(() => {
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      const search = params.toString();
      router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
    }, 300);
    return () => clearTimeout(timer);
  }, [query, queryValue, pathname, router]);

  return (
    <div className="relative">
      <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-label" aria-hidden="true" />
      <Input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search documents and information…"
        aria-label="Search documents and information"
        autoFocus
        className="h-11 border-hairline pl-9 focus:border-ink"
      />
    </div>
  );
}
