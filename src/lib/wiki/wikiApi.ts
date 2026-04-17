import { supabase } from '../supabase';
import type {
  WikiArticle,
  WikiArticleListItem,
  WikiArticleVersion,
  WikiCategory,
} from './wikiTypes';

const LIST_SELECT =
  'id, slug, title, summary, category_id, tags, reading_time_min, updated_at';

export async function fetchWikiCategories(): Promise<WikiCategory[]> {
  const { data, error } = await supabase
    .from('wiki_categories')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchWikiArticleList(): Promise<WikiArticleListItem[]> {
  const { data, error } = await supabase
    .from('wiki_articles')
    .select(LIST_SELECT)
    .neq('status', 'archived')
    .order('title', { ascending: true });
  if (error) throw error;
  return (data ?? []) as WikiArticleListItem[];
}

export async function fetchWikiArticleBySlug(slug: string): Promise<WikiArticle | null> {
  const { data, error } = await supabase
    .from('wiki_articles')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchWikiArticleVersions(articleId: string): Promise<WikiArticleVersion[]> {
  const { data, error } = await supabase
    .from('wiki_article_versions')
    .select('*')
    .eq('article_id', articleId)
    .order('version_num', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function searchWikiArticles(
  query: string,
  opts?: { categoryId?: string; limit?: number },
): Promise<WikiArticleListItem[]> {
  const q = query.trim();
  const limit = opts?.limit ?? 40;
  if (!q) {
    let builder = supabase
      .from('wiki_articles')
      .select(LIST_SELECT)
      .neq('status', 'archived')
      .order('updated_at', { ascending: false })
      .limit(limit);
    if (opts?.categoryId) builder = builder.eq('category_id', opts.categoryId);
    const { data, error } = await builder;
    if (error) throw error;
    return (data ?? []) as WikiArticleListItem[];
  }

  let builder = supabase
    .from('wiki_articles')
    .select(LIST_SELECT)
    .neq('status', 'archived')
    .textSearch('search_tsv', q, { type: 'websearch', config: 'spanish' })
    .limit(limit);
  if (opts?.categoryId) builder = builder.eq('category_id', opts.categoryId);

  const { data, error } = await builder;
  if (error || !data || data.length === 0) {
    const fallback = await supabase
      .from('wiki_articles')
      .select(LIST_SELECT)
      .neq('status', 'archived')
      .or(`title.ilike.%${q}%,slug.ilike.%${q}%,summary.ilike.%${q}%`)
      .limit(limit);
    if (fallback.error) throw fallback.error;
    return (fallback.data ?? []) as WikiArticleListItem[];
  }
  return data as WikiArticleListItem[];
}
