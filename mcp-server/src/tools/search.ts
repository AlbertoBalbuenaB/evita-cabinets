import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getSupabase } from '../shims/supabase.ts';
import { ok, failFromPostgrest } from '../utils/errors.ts';

export function registerSearchTools(server: McpServer): void {
  server.registerTool(
    'search_materials',
    {
      title: 'Search materials in price_list',
      description:
        'Busca materiales/hardware/edgeband/accesorios en la tabla price_list por nombre (ILIKE). Devuelve concepto, tipo, precio, unidad y dimensiones.',
      inputSchema: {
        query: z
          .string()
          .describe('Término de búsqueda, se aplica ILIKE sobre concept_description'),
        type: z
          .string()
          .optional()
          .describe('Filtro opcional por type (Material, Hardware, Accessory, Edgeband, ...)'),
        limit: z.number().int().min(1).max(50).optional(),
      },
    },
    async ({ query, type, limit }) => {
      const sb = getSupabase();
      let q = sb
        .from('price_list')
        .select(
          'id, concept_description, type, price, price_with_tax, unit, dimensions, sf_per_sheet, is_active',
        )
        .ilike('concept_description', `%${query}%`)
        .eq('is_active', true)
        .limit(limit ?? 15);
      if (type) q = q.eq('type', type);
      const { data, error } = await q;
      if (error) return failFromPostgrest('search_materials failed', error);
      return ok({ count: data?.length ?? 0, rows: data ?? [] });
    },
  );

  server.registerTool(
    'search_products',
    {
      title: 'Search products_catalog',
      description:
        'Busca productos CDS por SKU o descripción. Devuelve id, sku, description, SF de caja y frentes, edgeband total, y si tiene cut_pieces guardado.',
      inputSchema: {
        query: z.string().describe('Busca ILIKE sobre sku y description'),
        limit: z.number().int().min(1).max(50).optional(),
      },
    },
    async ({ query, limit }) => {
      const sb = getSupabase();
      const { data, error } = await sb
        .from('products_catalog')
        .select(
          'id, sku, description, box_sf, doors_fronts_sf, total_edgeband, has_drawers, cut_pieces',
        )
        .or(`sku.ilike.%${query}%,description.ilike.%${query}%`)
        .limit(limit ?? 15);
      if (error) return failFromPostgrest('search_products failed', error);
      const slim = (data ?? []).map((p) => ({
        id: p.id,
        sku: p.sku,
        description: p.description,
        box_sf: p.box_sf,
        doors_fronts_sf: p.doors_fronts_sf,
        total_edgeband: p.total_edgeband,
        has_drawers: p.has_drawers,
        has_cut_pieces: Array.isArray(p.cut_pieces) && p.cut_pieces.length > 0,
      }));
      return ok({ count: slim.length, rows: slim });
    },
  );

  server.registerTool(
    'search_prefab_catalog',
    {
      title: 'Search prefab catalog (Venus / Northville)',
      description:
        'Busca items del catálogo prefab (Venus, Northville) por código o descripción. Devuelve dimensiones y precios USD por acabado.',
      inputSchema: {
        query: z.string(),
        brand: z.enum(['Venus', 'Northville']).optional(),
        limit: z.number().int().min(1).max(30).optional(),
      },
    },
    async ({ query, brand, limit }) => {
      const sb = getSupabase();
      let q = sb
        .from('prefab_catalog')
        .select(
          'id, cabinet_code, description, category, width_in, height_in, depth_in, item_type, brand:brand_id(name), prices:prefab_catalog_price(finish, cost_usd, effective_date, is_current)',
        )
        .or(`cabinet_code.ilike.%${query}%,description.ilike.%${query}%`)
        .eq('is_active', true)
        .limit(limit ?? 15);
      if (brand) {
        const { data: brandRow } = await sb
          .from('prefab_brand')
          .select('id')
          .eq('name', brand)
          .maybeSingle();
        if (brandRow?.id) q = q.eq('brand_id', brandRow.id);
      }
      const { data, error } = await q;
      if (error) return failFromPostgrest('search_prefab_catalog failed', error);
      return ok({ count: data?.length ?? 0, rows: data ?? [] });
    },
  );

  server.registerTool(
    'search_suppliers',
    {
      title: 'Search suppliers',
      description:
        'Busca proveedores por nombre. Devuelve contactos, email, teléfono, lead time y payment terms.',
      inputSchema: {
        query: z.string(),
        limit: z.number().int().min(1).max(30).optional(),
      },
    },
    async ({ query, limit }) => {
      const sb = getSupabase();
      const { data, error } = await sb
        .from('suppliers')
        .select('*')
        .ilike('name', `%${query}%`)
        .limit(limit ?? 15);
      if (error) return failFromPostgrest('search_suppliers failed', error);
      return ok({ count: data?.length ?? 0, rows: data ?? [] });
    },
  );
}
