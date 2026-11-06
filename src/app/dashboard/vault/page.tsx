import { requireOwner } from '@/lib/auth/session';
import { createUserClient } from '@/lib/db/user';
import { log } from '@/lib/log';
import { VaultClient, type VaultCategory, type VaultDocument } from './vault-client';

export const dynamic = 'force-dynamic';

interface DocumentRowWithCategory {
  id: string;
  name: string;
  size: number;
  created_at: string;
  is_shared: boolean;
  categories: { name: string } | null;
}

export default async function VaultPage() {
  const owner = await requireOwner('/dashboard/vault');
  const supabase = await createUserClient();

  const [documentsResult, categoriesResult] = await Promise.all([
    supabase
      .from('documents')
      .select('id, name, size, created_at, is_shared, categories(name)')
      .eq('owner_id', owner.id)
      .order('created_at', { ascending: false })
      .returns<DocumentRowWithCategory[]>(),
    supabase
      .from('categories')
      .select('id, name')
      .eq('owner_id', owner.id)
      .order('sort', { ascending: true })
      .returns<VaultCategory[]>(),
  ]);

  if (documentsResult.error) {
    log.warn('vault.documents read failed', { message: documentsResult.error.message });
  }
  if (categoriesResult.error) {
    log.warn('vault.categories read failed', { message: categoriesResult.error.message });
  }

  const documents: VaultDocument[] = (documentsResult.data ?? []).map((row) => ({
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
      documentsLoadFailed={Boolean(documentsResult.error)}
      categoriesLoadFailed={Boolean(categoriesResult.error)}
    />
  );
}
