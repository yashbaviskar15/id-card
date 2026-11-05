import 'server-only';
import { createUserClient } from '@/lib/db/user';
import { createServiceClient } from '@/lib/db/service';
import { log } from '@/lib/log';
import type { CategoryRow, DocumentRow } from '@/lib/types';

/**
 * Vault reads. Everything goes through the owner-scoped client so Row Level
 * Security applies: an id belonging to another owner simply returns nothing.
 */

export interface DocumentWithCategory extends DocumentRow {
  category_name: string | null;
}

export interface VaultSummary {
  documentCount: number;
  totalBytes: number;
  categoryCount: number;
}

const DOCUMENT_COLUMNS =
  'id, owner_id, category_id, name, storage_path, mime, size, sha256, created_at, updated_at';

/**
 * Escapes the LIKE metacharacters so a search term is matched literally instead
 * of being interpreted as a pattern.
 */
function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export async function listCategories(): Promise<CategoryRow[]> {
  const supabase = await createUserClient();
  const { data, error } = await supabase
    .from('categories')
    .select('id, owner_id, name, sort, is_system, created_at')
    .order('sort', { ascending: true })
    .order('name', { ascending: true });
  if (error) {
    log.warn('vault.categories failed', { code: error.code });
    return [];
  }
  return (data ?? []) as CategoryRow[];
}

/**
 * Every document the owner holds, newest first. The list is small by nature
 * (one person's paperwork), so it is loaded once and filtered in the browser for
 * instant search; `listDocuments` still accepts filters for server-side use.
 */
export async function listDocuments(options?: {
  search?: string;
  categoryId?: string | null;
}): Promise<DocumentWithCategory[]> {
  const supabase = await createUserClient();
  let query = supabase
    .from('documents')
    .select(`${DOCUMENT_COLUMNS}, categories (name)`)
    .order('created_at', { ascending: false });

  const search = options?.search?.trim();
  if (search) query = query.ilike('name', `%${escapeLike(search)}%`);
  if (options?.categoryId) query = query.eq('category_id', options.categoryId);

  const { data, error } = await query;
  if (error) {
    log.warn('vault.documents failed', { code: error.code });
    return [];
  }

  type Joined = DocumentRow & { categories: { name: string } | null };
  return ((data ?? []) as unknown as Joined[]).map((row) => {
    const { categories, ...document } = row;
    return { ...document, category_name: categories?.name ?? null };
  });
}

export async function getDocument(documentId: string): Promise<DocumentRow | null> {
  const supabase = await createUserClient();
  const { data, error } = await supabase
    .from('documents')
    .select(DOCUMENT_COLUMNS)
    .eq('id', documentId)
    .maybeSingle<DocumentRow>();
  if (error) {
    log.warn('vault.document failed', { code: error.code });
    return null;
  }
  return data ?? null;
}

export async function vaultSummary(): Promise<VaultSummary> {
  const supabase = await createUserClient();
  const [documents, categories] = await Promise.all([
    supabase.from('documents').select('size'),
    supabase.from('categories').select('id', { count: 'exact', head: true }),
  ]);

  const rows = (documents.data ?? []) as { size: number }[];
  return {
    documentCount: rows.length,
    totalBytes: rows.reduce((sum, row) => sum + Number(row.size ?? 0), 0),
    categoryCount: categories.count ?? 0,
  };
}

/**
 * The default categories are created by a trigger when the auth user is created,
 * but an account that predates the trigger (or was made by hand in the Supabase
 * dashboard before the schema was applied) would start empty. Seeding is
 * idempotent, so the dashboard calls this before rendering the vault.
 */
export async function ensureCategories(ownerId: string): Promise<void> {
  const supabase = await createUserClient();
  const { count, error } = await supabase
    .from('categories')
    .select('id', { count: 'exact', head: true });
  if (error) {
    log.warn('vault.ensureCategories count failed', { code: error.code });
    return;
  }
  if ((count ?? 0) > 0) return;

  // seed_categories is service-role only: it writes on behalf of a user who has
  // no session yet, and it must stay unreachable from the browser.
  const service = createServiceClient();
  const { error: seedError } = await service.rpc('seed_categories', { p_owner_id: ownerId });
  if (seedError) log.warn('vault.ensureCategories seed failed', { code: seedError.code });
}
