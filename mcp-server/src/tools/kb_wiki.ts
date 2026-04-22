import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getSupabase } from '../shims/supabase.ts';
import { ok, failFromPostgrest } from '../utils/errors.ts';

function buildSnippet(body: string | null | undefined, query: string, max: number): string {
  const clean = String(body ?? '').replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  if (!query) return clean.length > max ? `${clean.slice(0, max)}…` : clean;
  const lower = clean.toLowerCase();
  const hit = lower.indexOf(query.toLowerCase());
  if (hit < 0) return clean.length > max ? `${clean.slice(0, max)}…` : clean;
  const start = Math.max(0, hit - 60);
  const end = Math.min(clean.length, hit + query.length + (max - 60));
  return (start > 0 ? '…' : '') + clean.slice(start, end) + (end < clean.length ? '…' : '');
}

export function registerKbWikiTools(server: McpServer): void {
  server.registerTool(
    'search_kb',
    {
      title: 'Search Knowledge Base',
      description:
        'Busca en la Knowledge Base interna de Evita (políticas, constantes, reglas de negocio). Intenta FTS en spanish y cae a ILIKE si no hay resultados.',
      inputSchema: {
        query: z.string(),
        category: z.string().optional().describe('slug de kb_categories'),
        entry_type: z.string().optional(),
        limit: z.number().int().min(1).max(30).optional(),
      },
    },
    async ({ query, category, entry_type, limit }) => {
      const sb = getSupabase();
      const lim = limit ?? 8;
      let base = sb
        .from('kb_entries')
        .select(
          'id, slug, title, entry_type, category_id, body_md, tags, needs_enrichment, updated_at',
        )
        .neq('status', 'archived')
        .limit(lim);

      if (category) {
        const { data: catRow } = await sb
          .from('kb_categories')
          .select('id')
          .eq('slug', category)
          .maybeSingle();
        if (catRow?.id) base = base.eq('category_id', catRow.id);
      }
      if (entry_type) base = base.eq('entry_type', entry_type);

      type Row = {
        id: string;
        slug: string;
        title: string;
        entry_type: string;
        category_id: string;
        body_md: string;
        tags: string[];
        needs_enrichment: boolean;
        updated_at: string;
      };
      let rows: Row[] = [];
      const q = query.trim();
      if (q) {
        const fts = await base.textSearch('search_tsv', q, {
          type: 'websearch',
          config: 'spanish',
        });
        if (!fts.error && fts.data && fts.data.length > 0) rows = fts.data as Row[];
        if (rows.length === 0) {
          const fallback = await sb
            .from('kb_entries')
            .select(
              'id, slug, title, entry_type, category_id, body_md, tags, needs_enrichment, updated_at',
            )
            .neq('status', 'archived')
            .or(`title.ilike.%${q}%,slug.ilike.%${q}%`)
            .limit(lim);
          if (fallback.error) return failFromPostgrest('search_kb fallback failed', fallback.error);
          rows = (fallback.data ?? []) as Row[];
        }
      } else {
        const { data, error } = await base.order('updated_at', { ascending: false });
        if (error) return failFromPostgrest('search_kb listing failed', error);
        rows = (data ?? []) as Row[];
      }

      const catIds = [...new Set(rows.map((r) => r.category_id).filter(Boolean))];
      const catMap = new Map<string, { slug: string; section_num: string | null }>();
      if (catIds.length) {
        const { data: cats } = await sb
          .from('kb_categories')
          .select('id, slug, section_num')
          .in('id', catIds);
        (cats ?? []).forEach((c) => catMap.set(c.id, { slug: c.slug, section_num: c.section_num }));
      }

      const results = rows.map((r) => ({
        slug: r.slug,
        title: r.title,
        entry_type: r.entry_type,
        category_slug: catMap.get(r.category_id)?.slug ?? null,
        section_num: catMap.get(r.category_id)?.section_num ?? null,
        snippet: buildSnippet(r.body_md, q, 180),
        tags: r.tags ?? [],
        needs_enrichment: !!r.needs_enrichment,
        updated_at: r.updated_at,
      }));
      return ok({ count: results.length, rows: results });
    },
  );

  server.registerTool(
    'get_kb_entry',
    {
      title: 'Get KB entry by slug',
      description: 'Devuelve el body_md completo + structured_data + categoría de una entrada de KB.',
      inputSchema: { slug: z.string() },
    },
    async ({ slug }) => {
      const sb = getSupabase();
      const { data, error } = await sb
        .from('kb_entries')
        .select(
          'slug, title, entry_type, category_id, body_md, structured_data, tags, supplier_ids, product_refs, price_item_refs, needs_enrichment, enrichment_notes, current_version, status, updated_at',
        )
        .eq('slug', slug)
        .maybeSingle();
      if (error) return failFromPostgrest('get_kb_entry failed', error);
      if (!data) return ok({ found: false, slug });
      const { data: catRow } = await sb
        .from('kb_categories')
        .select('slug, name, section_num')
        .eq('id', data.category_id)
        .maybeSingle();
      return ok({
        slug: data.slug,
        title: data.title,
        entry_type: data.entry_type,
        category: catRow ?? null,
        body_md: data.body_md,
        structured_data: data.structured_data,
        tags: data.tags,
        product_refs: data.product_refs,
        price_item_refs: data.price_item_refs,
        supplier_ids: data.supplier_ids,
        needs_enrichment: data.needs_enrichment,
        enrichment_notes: data.enrichment_notes,
        version: data.current_version,
        updated_at: data.updated_at,
      });
    },
  );

  server.registerTool(
    'search_wiki',
    {
      title: 'Search Wiki',
      description:
        'Busca en la Wiki interna (procedimientos, EPP, QC, assembly). FTS spanish con fallback ILIKE sobre title/slug/summary.',
      inputSchema: {
        query: z.string(),
        category: z.string().optional().describe('slug de wiki_categories'),
        limit: z.number().int().min(1).max(20).optional(),
      },
    },
    async ({ query, category, limit }) => {
      const sb = getSupabase();
      const lim = limit ?? 6;
      let base = sb
        .from('wiki_articles')
        .select(
          'id, slug, title, summary, category_id, body_md, tags, reading_time_min, updated_at',
        )
        .neq('status', 'archived')
        .limit(lim);

      if (category) {
        const { data: catRow } = await sb
          .from('wiki_categories')
          .select('id')
          .eq('slug', category)
          .maybeSingle();
        if (catRow?.id) base = base.eq('category_id', catRow.id);
      }

      type Row = {
        id: string;
        slug: string;
        title: string;
        summary: string | null;
        category_id: string;
        body_md: string;
        tags: string[];
        reading_time_min: number | null;
        updated_at: string;
      };
      const q = query.trim();
      let rows: Row[] = [];
      if (q) {
        const fts = await base.textSearch('search_tsv', q, {
          type: 'websearch',
          config: 'spanish',
        });
        if (!fts.error && fts.data && fts.data.length > 0) rows = fts.data as Row[];
        if (rows.length === 0) {
          const fb = await sb
            .from('wiki_articles')
            .select(
              'id, slug, title, summary, category_id, body_md, tags, reading_time_min, updated_at',
            )
            .neq('status', 'archived')
            .or(`title.ilike.%${q}%,slug.ilike.%${q}%,summary.ilike.%${q}%`)
            .limit(lim);
          if (fb.error) return failFromPostgrest('search_wiki fallback failed', fb.error);
          rows = (fb.data ?? []) as Row[];
        }
      } else {
        const { data, error } = await base.order('updated_at', { ascending: false });
        if (error) return failFromPostgrest('search_wiki listing failed', error);
        rows = (data ?? []) as Row[];
      }

      const catIds = [...new Set(rows.map((r) => r.category_id).filter(Boolean))];
      const catMap = new Map<string, { slug: string; name: string }>();
      if (catIds.length) {
        const { data: cats } = await sb
          .from('wiki_categories')
          .select('id, slug, name')
          .in('id', catIds);
        (cats ?? []).forEach((c) => catMap.set(c.id, { slug: c.slug, name: c.name }));
      }

      const results = rows.map((r) => ({
        slug: r.slug,
        title: r.title,
        summary: r.summary,
        category_slug: catMap.get(r.category_id)?.slug ?? null,
        category_name: catMap.get(r.category_id)?.name ?? null,
        snippet: buildSnippet(r.body_md, q, 220),
        tags: r.tags ?? [],
        reading_time_min: r.reading_time_min,
        updated_at: r.updated_at,
      }));
      return ok({ count: results.length, rows: results });
    },
  );

  server.registerTool(
    'get_wiki_article',
    {
      title: 'Get wiki article by slug',
      description: 'Devuelve el body_md completo + categoría de un artículo wiki.',
      inputSchema: { slug: z.string() },
    },
    async ({ slug }) => {
      const sb = getSupabase();
      const { data, error } = await sb
        .from('wiki_articles')
        .select(
          'slug, title, summary, category_id, body_md, tags, reading_time_min, current_version, status, updated_at',
        )
        .eq('slug', slug)
        .maybeSingle();
      if (error) return failFromPostgrest('get_wiki_article failed', error);
      if (!data) return ok({ found: false, slug });
      const { data: catRow } = await sb
        .from('wiki_categories')
        .select('slug, name')
        .eq('id', data.category_id)
        .maybeSingle();
      return ok({
        slug: data.slug,
        title: data.title,
        summary: data.summary,
        category: catRow ?? null,
        body_md: data.body_md,
        tags: data.tags,
        reading_time_min: data.reading_time_min,
        version: data.current_version,
        status: data.status,
        updated_at: data.updated_at,
      });
    },
  );
}
