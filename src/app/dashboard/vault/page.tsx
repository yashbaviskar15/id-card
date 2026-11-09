import { requireOwner } from '@/lib/auth/session';
import { createUserClient } from '@/lib/db/user';
import { log } from '@/lib/log';
import { escapeLike } from '@/lib/vault/load';
import { VaultClient, type VaultCategory, type VaultDocument } from './vault-client';

export const dynamic = 'force-dynamic';
const PAGE_SIZE = 20;

interface DocumentRowWithCategory {
  id: string;
  name: string;
  size: number;
  created_at: string;
  is_shared: boolean;
  categories: { name: string } | null;
}

interface VaultSearchParams {
  page?: string;
  q?: string;
  category?: string;
}

export default async function VaultPage({
  searchParams,
}: {
  searchParams: Promise<VaultSearchParams>;
}) {
  const params = await searchParams;
  const owner = await requireOwner('/dashboard/vault');
  const supabase = await createUserClient();
  const pageParam = Number(params.page);
  const page = Number.isSafeInteger(pageParam) && pageParam > 0 ? Math.min(pageParam, 100_000) : 1;
  const query = (params.q ?? '').trim().slice(0, 120);
  const requestedCategory = (params.category ?? '').slice(0, 80);
  const category = requestedCategory === '__none'
    || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestedCategory)
    ? requestedCategory
    : '';
  const readDocuments = (targetPage: number) => {
    let request = supabase
      .from('documents')
      .select('id, name, size, created_at, is_shared, categories(name)', { count: 'exact' })
      .eq('owner_id', owner.id);

    if (query) request = request.ilike('name', `%${escapeLike(query)}%`);
    if (category === '__none') request = request.is('category_id', null);
    else if (category) request = request.eq('category_id', category);

    return request
      .order('created_at', { ascending: false })
      .range((targetPage - 1) * PAGE_SIZE, targetPage * PAGE_SIZE)
      .returns<DocumentRowWithCategory[]>();
  };

  const [pageResult, categoriesResult, totalDocumentsResult, sharedDocumentsResult] = await Promise.all([
    readDocuments(page),
    supabase
      .from('categories')
      .select('id, name')
      .eq('owner_id', owner.id)
      .order('sort', { ascending: true })
      .returns<VaultCategory[]>(),
    supabase
      .from('documents')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', owner.id),
    supabase
      .from('documents')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', owner.id)
      .eq('is_shared', true),
  ]);

  const hasNextPage = (pageResult.data?.length ?? 0) > PAGE_SIZE;
  const documentsResult = pageResult;
  if (documentsResult.error) {
    log.warn('vault.documents read failed', { message: documentsResult.error.message });
  }
  if (categoriesResult.error) {
    log.warn('vault.categories read failed', { message: categoriesResult.error.message });
  }
  if (totalDocumentsResult.error) {
    log.warn('vault.total documents count failed', { message: totalDocumentsResult.error.message });
  }
  if (sharedDocumentsResult.error) {
    log.warn('vault.shared documents count failed', { message: sharedDocumentsResult.error.message });
  }

  const documents: VaultDocument[] = (documentsResult.data ?? []).slice(0, PAGE_SIZE).map((row) => ({
    id: row.id,
    name: row.name,
    size: row.size,
    created_at: row.created_at,
    is_shared: row.is_shared,
    category: row.categories?.name ?? null,
  }));

  return (
    <VaultClient
      documents={documents}
      categories={categoriesResult.data ?? []}
      page={page}
      pageSize={PAGE_SIZE}
      queryValue={query}
      categoryValue={category}
      hasNextPage={hasNextPage}
      documentsLoadFailed={Boolean(documentsResult.error)}
      categoriesLoadFailed={Boolean(categoriesResult.error)}
      filteredCount={documentsResult.count ?? 0}
      totalDocuments={totalDocumentsResult.error ? null : totalDocumentsResult.count ?? 0}
      sharedDocuments={sharedDocumentsResult.error ? null : sharedDocumentsResult.count ?? 0}
    />
  );
}
