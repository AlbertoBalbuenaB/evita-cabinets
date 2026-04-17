import { supabase } from '../supabase';
import type { Database } from '../database.types';
import type {
  WikiArticle,
  WikiArticleListItem,
  WikiArticleVersion,
  WikiAuditRow,
  WikiCategory,
  WikiComment,
  WikiProposal,
} from './wikiTypes';

export type WikiProposalInsert = Database['public']['Tables']['wiki_proposals']['Insert'];
export type WikiProposalUpdate = Database['public']['Tables']['wiki_proposals']['Update'];
export type WikiCommentInsert  = Database['public']['Tables']['wiki_comments']['Insert'];

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

export async function fetchWikiProposals(opts?: { state?: string; limit?: number }): Promise<WikiProposal[]> {
  let builder = supabase
    .from('wiki_proposals')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(opts?.limit ?? 100);
  if (opts?.state) builder = builder.eq('state', opts.state);
  const { data, error } = await builder;
  if (error) throw error;
  return data ?? [];
}

export async function fetchWikiProposal(id: string): Promise<WikiProposal | null> {
  const { data, error } = await supabase
    .from('wiki_proposals')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createWikiProposal(row: WikiProposalInsert): Promise<WikiProposal> {
  const { data, error } = await supabase
    .from('wiki_proposals')
    .insert(row)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function transitionWikiProposal(id: string, nextState: string, reviewNote?: string): Promise<WikiProposal> {
  const patch: WikiProposalUpdate = { state: nextState };
  if (reviewNote !== undefined) patch.review_note = reviewNote;
  if (['approved', 'rejected', 'changes_requested'].includes(nextState)) {
    patch.reviewed_at = new Date().toISOString();
  }
  const { data, error } = await supabase
    .from('wiki_proposals')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function mergeWikiProposal(id: string, note?: string): Promise<string> {
  const { data, error } = await supabase.rpc('wiki_merge_proposal', {
    p_proposal_id: id,
    p_note: note,
  });
  if (error) throw error;
  return data as string;
}

export async function fetchWikiComments(params: {
  proposalId?: string;
  articleId?: string;
}): Promise<WikiComment[]> {
  let builder = supabase
    .from('wiki_comments')
    .select('*')
    .order('created_at', { ascending: true });
  if (params.proposalId) builder = builder.eq('proposal_id', params.proposalId);
  if (params.articleId) builder = builder.eq('article_id', params.articleId);
  const { data, error } = await builder;
  if (error) throw error;
  return data ?? [];
}

export async function createWikiComment(row: WikiCommentInsert): Promise<WikiComment> {
  const { data, error } = await supabase
    .from('wiki_comments')
    .insert(row)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function fetchWikiAuditLog(limit = 200): Promise<WikiAuditRow[]> {
  const { data, error } = await supabase
    .from('wiki_audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
