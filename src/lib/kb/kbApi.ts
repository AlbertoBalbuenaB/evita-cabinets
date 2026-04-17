import { supabase } from '../supabase';
import type {
  KbCategory,
  KbEntry,
  KbEntryListItem,
  KbSupplier,
} from './kbTypes';

const LIST_SELECT =
  'id, slug, title, category_id, entry_type, tags, needs_enrichment, supplier_ids, updated_at';

export async function fetchCategories(): Promise<KbCategory[]> {
  const { data, error } = await supabase
    .from('kb_categories')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchSuppliers(): Promise<KbSupplier[]> {
  const { data, error } = await supabase
    .from('kb_suppliers')
    .select('*')
    .order('name', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchEntryList(): Promise<KbEntryListItem[]> {
  const { data, error } = await supabase
    .from('kb_entries')
    .select(LIST_SELECT)
    .neq('status', 'archived')
    .order('title', { ascending: true });
  if (error) throw error;
  return (data ?? []) as KbEntryListItem[];
}

export async function fetchEntryBySlug(slug: string): Promise<KbEntry | null> {
  const { data, error } = await supabase
    .from('kb_entries')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function searchEntries(
  query: string,
  opts?: { categoryId?: string; entryType?: string; limit?: number },
): Promise<KbEntryListItem[]> {
  const q = query.trim();
  const limit = opts?.limit ?? 30;
  if (!q) {
    let builder = supabase
      .from('kb_entries')
      .select(LIST_SELECT)
      .neq('status', 'archived')
      .order('updated_at', { ascending: false })
      .limit(limit);
    if (opts?.categoryId) builder = builder.eq('category_id', opts.categoryId);
    if (opts?.entryType) builder = builder.eq('entry_type', opts.entryType);
    const { data, error } = await builder;
    if (error) throw error;
    return (data ?? []) as KbEntryListItem[];
  }

  let builder = supabase
    .from('kb_entries')
    .select(LIST_SELECT)
    .neq('status', 'archived')
    .textSearch('search_tsv', q, { type: 'websearch', config: 'spanish' })
    .limit(limit);

  if (opts?.categoryId) builder = builder.eq('category_id', opts.categoryId);
  if (opts?.entryType) builder = builder.eq('entry_type', opts.entryType);

  const { data, error } = await builder;
  if (error) {
    const fallback = await supabase
      .from('kb_entries')
      .select(LIST_SELECT)
      .neq('status', 'archived')
      .ilike('title', `%${q}%`)
      .limit(limit);
    if (fallback.error) throw fallback.error;
    return (fallback.data ?? []) as KbEntryListItem[];
  }

  if (data && data.length > 0) return data as KbEntryListItem[];

  const fuzzy = await supabase
    .from('kb_entries')
    .select(LIST_SELECT)
    .neq('status', 'archived')
    .or(`title.ilike.%${q}%,slug.ilike.%${q}%`)
    .limit(limit);
  if (fuzzy.error) throw fuzzy.error;
  return (fuzzy.data ?? []) as KbEntryListItem[];
}
