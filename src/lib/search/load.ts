import 'server-only';
import { createUserClient } from '@/lib/db/user';
import { escapeLike } from '@/lib/vault/load';
import { log } from '@/lib/log';
import type { FieldKind } from '@/lib/types';

/**
 * Global search. Everything is read through the owner-scoped client so Row Level
 * Security always applies, and the term is escaped with the same helper the
 * vault uses, so a search is a literal `ilike` and never a LIKE pattern.
 *
 * Why `ilike` and not the Postgres full-text indexes: the GIN indexes
 * (documents_name_fts_idx / fields_value_fts_idx) are built on
 * `to_tsvector('simple', coalesce(...))`, which does not line up with the
 * `textSearch()` helper's query shape, and no search RPC exists. A literal
 * `ilike` over the owner's own rows is exact and injection-free, which is what
 * matters for a single-owner vault. Sensitive values are never decrypted here:
 * the stored `value` for a sensitive field is already its masked display form.
 */

export const SEARCH_LIMIT = 25;

export interface SearchDocumentResult {
  id: string;
  name: string;
  category_name: string | null;
  size: number;
  created_at: string;
}

export interface SearchFieldResult {
  id: string;
  kind: FieldKind;
  label: string | null;
  value: string | null;
  is_sensitive: boolean;
  is_public: boolean;
}

export interface SearchResults {
  documents: SearchDocumentResult[];
  fields: SearchFieldResult[];
  failed: boolean;
}

const FIELD_COLUMNS = 'id, kind, label, value, is_sensitive, is_public, sort';

type DocumentJoinedRow = {
  id: string;
  name: string;
  size: number;
  created_at: string;
  categories: { name: string } | null;
};

type FieldJoinedRow = {
  id: string;
  kind: FieldKind;
  label: string | null;
  value: string | null;
  is_sensitive: boolean;
  is_public: boolean;
  sort: number;
};

/**
 * Searches the owner's documents (by name) and information fields (by label or
 * value). Returns an empty result for a blank term — the page then shows its
 * initial state instead of the whole vault.
 */
export async function searchEverything(ownerId: string, term: string): Promise<SearchResults> {
  const query = term.trim();
  if (!query) return { documents: [], fields: [], failed: false };

  const supabase = await createUserClient();
  const pattern = `%${escapeLike(query)}%`;

  const [documentResult, labelResult, valueResult] = await Promise.all([
    supabase
      .from('documents')
      .select('id, name, size, created_at, categories(name)')
      .eq('owner_id', ownerId)
      .ilike('name', pattern)
      .order('created_at', { ascending: false })
      .limit(SEARCH_LIMIT)
      .returns<DocumentJoinedRow[]>(),
    supabase
      .from('fields')
      .select(FIELD_COLUMNS)
      .eq('owner_id', ownerId)
      .ilike('label', pattern)
      .order('sort', { ascending: true })
      .limit(SEARCH_LIMIT)
      .returns<FieldJoinedRow[]>(),
    supabase
      .from('fields')
      .select(FIELD_COLUMNS)
      .eq('owner_id', ownerId)
      .ilike('value', pattern)
      .order('sort', { ascending: true })
      .limit(SEARCH_LIMIT)
      .returns<FieldJoinedRow[]>(),
  ]);

  const failed = Boolean(documentResult.error || labelResult.error || valueResult.error);
  if (documentResult.error) log.warn('search.documents failed', { code: documentResult.error.code });
  if (labelResult.error) log.warn('search.fields.label failed', { code: labelResult.error.code });
  if (valueResult.error) log.warn('search.fields.value failed', { code: valueResult.error.code });

  const documents: SearchDocumentResult[] = (documentResult.data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    category_name: row.categories?.name ?? null,
    size: row.size,
    created_at: row.created_at,
  }));

  // The two field queries can return overlapping rows; keep one per id.
  const merged = new Map<string, SearchFieldResult>();
  for (const row of [...(labelResult.data ?? []), ...(valueResult.data ?? [])]) {
    if (merged.has(row.id)) continue;
    merged.set(row.id, {
      id: row.id,
      kind: row.kind,
      label: row.label,
      value: row.value,
      is_sensitive: row.is_sensitive,
      is_public: row.is_public,
    });
  }
  const fields = [...merged.values()].sort((left, right) => (left.label ?? '').localeCompare(right.label ?? ''));

  return { documents, fields, failed };
}
