import { supabase } from '../supabase';
import type { Database } from '../database.types';
import type {
  KbCategory,
  KbComment,
  KbEntry,
  KbEntryListItem,
  KbEntryVersion,
  KbProposal,
  KbSupplier,
} from './kbTypes';

export type KbProposalInsert = Database['public']['Tables']['kb_proposals']['Insert'];
export type KbProposalUpdate = Database['public']['Tables']['kb_proposals']['Update'];
export type KbCommentInsert  = Database['public']['Tables']['kb_comments']['Insert'];

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

export async function fetchSupplierBySlug(slug: string): Promise<KbSupplier | null> {
  const { data, error } = await supabase
    .from('kb_suppliers')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchEntriesBySupplierId(supplierId: string): Promise<KbEntryListItem[]> {
  const { data, error } = await supabase
    .from('kb_entries')
    .select(LIST_SELECT)
    .neq('status', 'archived')
    .contains('supplier_ids', [supplierId])
    .order('title', { ascending: true });
  if (error) throw error;
  return (data ?? []) as KbEntryListItem[];
}

export async function fetchEntryVersions(entryId: string): Promise<KbEntryVersion[]> {
  const { data, error } = await supabase
    .from('kb_entry_versions')
    .select('*')
    .eq('entry_id', entryId)
    .order('version_num', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchProposals(opts?: {
  state?: string;
  authorId?: string;
  limit?: number;
}): Promise<KbProposal[]> {
  let builder = supabase
    .from('kb_proposals')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(opts?.limit ?? 100);
  if (opts?.state) builder = builder.eq('state', opts.state);
  if (opts?.authorId) builder = builder.eq('author_id', opts.authorId);
  const { data, error } = await builder;
  if (error) throw error;
  return data ?? [];
}

export async function fetchProposal(id: string): Promise<KbProposal | null> {
  const { data, error } = await supabase
    .from('kb_proposals')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createProposal(row: KbProposalInsert): Promise<KbProposal> {
  const { data, error } = await supabase
    .from('kb_proposals')
    .insert(row)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function updateProposal(id: string, patch: KbProposalUpdate): Promise<KbProposal> {
  const { data, error } = await supabase
    .from('kb_proposals')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function transitionProposal(id: string, nextState: string, reviewNote?: string): Promise<KbProposal> {
  const patch: KbProposalUpdate = { state: nextState };
  if (reviewNote !== undefined) patch.review_note = reviewNote;
  if (['approved', 'rejected', 'changes_requested'].includes(nextState)) {
    patch.reviewed_at = new Date().toISOString();
  }
  return updateProposal(id, patch);
}

export async function mergeProposal(id: string, note?: string): Promise<string> {
  const { data, error } = await supabase.rpc('kb_merge_proposal', {
    p_proposal_id: id,
    p_note: note,
  });
  if (error) throw error;
  return data as string;
}

export async function fetchComments(params: {
  proposalId?: string;
  entryId?: string;
}): Promise<KbComment[]> {
  let builder = supabase
    .from('kb_comments')
    .select('*')
    .order('created_at', { ascending: true });
  if (params.proposalId) builder = builder.eq('proposal_id', params.proposalId);
  if (params.entryId) builder = builder.eq('entry_id', params.entryId);
  const { data, error } = await builder;
  if (error) throw error;
  return data ?? [];
}

export async function createComment(row: KbCommentInsert): Promise<KbComment> {
  const { data, error } = await supabase
    .from('kb_comments')
    .insert(row)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export function plainTextToTiptap(text: string): Record<string, unknown> {
  const paragraphs = text.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  if (paragraphs.length === 0) {
    return { type: 'doc', content: [{ type: 'paragraph' }] };
  }
  return {
    type: 'doc',
    content: paragraphs.map((p) => ({
      type: 'paragraph',
      content: [{ type: 'text', text: p }],
    })),
  };
}

export async function fetchMemberNames(): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from('team_members')
    .select('id, name')
    .order('name', { ascending: true });
  if (error) throw error;
  const map: Record<string, string> = {};
  for (const row of data ?? []) {
    map[row.id] = row.name ?? 'Unknown';
  }
  return map;
}

export function tiptapToPlainText(doc: unknown): string {
  if (!doc || typeof doc !== 'object') return '';
  const out: string[] = [];
  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object') return;
    const n = node as Record<string, unknown>;
    if (n.type === 'text' && typeof n.text === 'string') {
      out.push(n.text);
      return;
    }
    if (n.type === 'paragraph') {
      const para: string[] = [];
      const children = Array.isArray(n.content) ? (n.content as unknown[]) : [];
      for (const c of children) {
        if (c && typeof c === 'object') {
          const cn = c as Record<string, unknown>;
          if (cn.type === 'text' && typeof cn.text === 'string') para.push(cn.text);
        }
      }
      out.push(para.join(''));
      return;
    }
    const children = Array.isArray(n.content) ? (n.content as unknown[]) : [];
    children.forEach(walk);
  };
  walk(doc);
  return out.join('\n\n').trim();
}
