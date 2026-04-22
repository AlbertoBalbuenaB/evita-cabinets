import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getSupabase } from '../shims/supabase.ts';
import { ok, failFromPostgrest } from '../utils/errors.ts';

export function registerInventoryTools(server: McpServer): void {
  server.registerTool(
    'get_inventory_stock',
    {
      title: 'Get inventory stock for an item',
      description:
        'Consulta stock actual, average_cost, last_purchase_cost y stock_location de un item del price_list. Acepta texto (ILIKE) o item_id.',
      inputSchema: {
        query: z.string().optional(),
        item_id: z.string().uuid().optional(),
        limit: z.number().int().min(1).max(30).optional(),
      },
    },
    async ({ query, item_id, limit }) => {
      if (!query && !item_id) {
        return ok({ error: 'Provide either query or item_id' });
      }
      const sb = getSupabase();
      let q = sb
        .from('price_list')
        .select(
          'id, concept_description, type, unit, stock_quantity, min_stock_level, average_cost, last_purchase_cost, price, price_with_tax, stock_location',
        )
        .limit(limit ?? 10);
      if (item_id) q = q.eq('id', item_id);
      else if (query) q = q.ilike('concept_description', `%${query}%`);
      const { data, error } = await q;
      if (error) return failFromPostgrest('get_inventory_stock failed', error);
      return ok({ count: data?.length ?? 0, rows: data ?? [] });
    },
  );

  server.registerTool(
    'get_low_stock_items',
    {
      title: 'Get items below their minimum stock level',
      description:
        'Devuelve items donde stock_quantity < min_stock_level. Útil para preparar órdenes de compra.',
      inputSchema: {
        limit: z.number().int().min(1).max(100).optional(),
      },
    },
    async ({ limit }) => {
      const sb = getSupabase();
      const { data, error } = await sb
        .from('price_list')
        .select(
          'id, concept_description, type, unit, stock_quantity, min_stock_level, average_cost',
        )
        .gt('min_stock_level', 0)
        .eq('is_active', true)
        .limit(limit ?? 50);
      if (error) return failFromPostgrest('get_low_stock_items failed', error);
      const low = (data ?? []).filter(
        (row) => (row.stock_quantity ?? 0) < (row.min_stock_level ?? 0),
      );
      return ok({ count: low.length, rows: low });
    },
  );

  server.registerTool(
    'get_purchase_items',
    {
      title: 'Get purchase items for a project',
      description:
        'Lista items de la purchase list de un proyecto. Acepta project_id (hub) o quotation_id (alias del frontend).',
      inputSchema: {
        project_id: z.string().uuid().optional(),
        quotation_id: z.string().uuid().optional(),
        status: z.string().optional(),
        limit: z.number().int().min(1).max(200).optional(),
      },
    },
    async ({ project_id, quotation_id, status, limit }) => {
      const sb = getSupabase();
      let resolvedProjectId = project_id;
      if (!resolvedProjectId && quotation_id) {
        const { data: qRow, error: qErr } = await sb
          .from('quotations')
          .select('project_id')
          .eq('id', quotation_id)
          .maybeSingle();
        if (qErr) return failFromPostgrest('resolve project_id from quotation failed', qErr);
        if (!qRow?.project_id) return ok({ error: 'quotation has no project_id' });
        resolvedProjectId = qRow.project_id;
      }
      if (!resolvedProjectId) {
        return ok({ error: 'Provide project_id or quotation_id' });
      }
      let q = sb
        .from('project_purchase_items')
        .select('*')
        .eq('project_id', resolvedProjectId)
        .limit(limit ?? 100);
      if (status) q = q.eq('status', status);
      const { data, error } = await q;
      if (error) return failFromPostgrest('get_purchase_items failed', error);
      return ok({ project_id: resolvedProjectId, count: data?.length ?? 0, rows: data ?? [] });
    },
  );
}
