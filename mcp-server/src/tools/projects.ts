import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getSupabase } from '../shims/supabase.ts';
import { ok, failFromPostgrest } from '../utils/errors.ts';

export function registerProjectTools(server: McpServer): void {
  server.registerTool(
    'list_projects',
    {
      title: 'List projects (hub entities)',
      description:
        'Lista proyectos (la entidad "hub", no las quotations). Ordenado por last_modified_at desc.',
      inputSchema: {
        status: z.string().optional().describe('Filtra por status'),
        query: z.string().optional().describe('ILIKE sobre name/customer'),
        limit: z.number().int().min(1).max(100).optional(),
      },
    },
    async ({ status, query, limit }) => {
      const sb = getSupabase();
      let q = sb
        .from('projects')
        .select(
          'id, name, customer, address, status, project_type, project_brief, last_modified_at, created_at',
        )
        .order('last_modified_at', { ascending: false, nullsFirst: false })
        .limit(limit ?? 25);
      if (status) q = q.eq('status', status);
      if (query) q = q.or(`name.ilike.%${query}%,customer.ilike.%${query}%`);
      const { data, error } = await q;
      if (error) return failFromPostgrest('list_projects failed', error);
      return ok({ count: data?.length ?? 0, rows: data ?? [] });
    },
  );

  server.registerTool(
    'get_project',
    {
      title: 'Get project + quotations',
      description:
        'Devuelve el proyecto y sus quotations (versiones de pricing). Recuerda: en las URLs del frontend, el "projectId" = quotation.id. Aquí project_id es el hub real.',
      inputSchema: {
        project_id: z.string().uuid(),
      },
    },
    async ({ project_id }) => {
      const sb = getSupabase();
      const [projRes, quotRes] = await Promise.all([
        sb.from('projects').select('*').eq('id', project_id).maybeSingle(),
        sb
          .from('quotations')
          .select(
            'id, name, version_number, version_label, status, pricing_method, profit_multiplier, tariff_multiplier, tax_percentage, total_amount, quote_date, updated_at',
          )
          .eq('project_id', project_id)
          .order('version_number', { ascending: false, nullsFirst: false }),
      ]);
      if (projRes.error) return failFromPostgrest('get_project failed', projRes.error);
      if (!projRes.data) return ok({ found: false, project_id });
      if (quotRes.error) return failFromPostgrest('get_project quotations failed', quotRes.error);
      return ok({
        project: projRes.data,
        quotations: quotRes.data ?? [],
      });
    },
  );

  server.registerTool(
    'list_project_areas',
    {
      title: 'List areas for a quotation',
      description:
        'Lista las áreas (project_areas) de una quotation. El parámetro quotation_id es lo que el frontend muestra como "projectId" en la URL de una quotation.',
      inputSchema: {
        quotation_id: z.string().uuid(),
      },
    },
    async ({ quotation_id }) => {
      const sb = getSupabase();
      const { data, error } = await sb
        .from('project_areas')
        .select('id, name, quantity, applies_tariff, display_order, subtotal')
        .eq('project_id', quotation_id)
        .order('display_order', { ascending: true, nullsFirst: false });
      if (error) return failFromPostgrest('list_project_areas failed', error);
      return ok({ quotation_id, count: data?.length ?? 0, rows: data ?? [] });
    },
  );

  server.registerTool(
    'get_area_cabinets',
    {
      title: 'Get cabinets for an area',
      description:
        'Devuelve los cabinets (area_cabinets) de un área, con costos por componente y SKU. Resuelve nombres de materiales por ID en un segundo query.',
      inputSchema: {
        area_id: z.string().uuid(),
      },
    },
    async ({ area_id }) => {
      const sb = getSupabase();
      const { data: cabinets, error } = await sb
        .from('area_cabinets')
        .select(
          'id, product_sku, quantity, box_material_id, box_edgeband_id, doors_material_id, doors_edgeband_id, hardware, accessories, box_material_cost, box_edgeband_cost, doors_material_cost, doors_edgeband_cost, drawer_box_material_cost, drawer_box_edgeband_cost, shelf_material_cost, shelf_edgeband_cost, back_panel_material_cost, door_profile_cost, hardware_cost, accessories_cost, labor_cost, subtotal, is_rta, display_order',
        )
        .eq('area_id', area_id)
        .order('display_order', { ascending: true, nullsFirst: false });
      if (error) return failFromPostgrest('get_area_cabinets failed', error);

      const matIds = new Set<string>();
      (cabinets ?? []).forEach((c) => {
        if (c.box_material_id) matIds.add(c.box_material_id);
        if (c.doors_material_id) matIds.add(c.doors_material_id);
        if (c.box_edgeband_id) matIds.add(c.box_edgeband_id);
        if (c.doors_edgeband_id) matIds.add(c.doors_edgeband_id);
      });
      const matById = new Map<string, string>();
      if (matIds.size > 0) {
        const { data: mats } = await sb
          .from('price_list')
          .select('id, concept_description')
          .in('id', [...matIds]);
        (mats ?? []).forEach((m) => matById.set(m.id, m.concept_description));
      }

      const enriched = (cabinets ?? []).map((c) => ({
        ...c,
        box_material_name: c.box_material_id ? matById.get(c.box_material_id) ?? null : null,
        doors_material_name: c.doors_material_id ? matById.get(c.doors_material_id) ?? null : null,
        box_edgeband_name: c.box_edgeband_id ? matById.get(c.box_edgeband_id) ?? null : null,
        doors_edgeband_name: c.doors_edgeband_id
          ? matById.get(c.doors_edgeband_id) ?? null
          : null,
      }));
      return ok({ area_id, count: enriched.length, rows: enriched });
    },
  );

  server.registerTool(
    'get_all_cabinets',
    {
      title: 'Get all cabinets for a quotation',
      description:
        'Devuelve un sumario agregado de todos los cabinets de una quotation (todas las áreas), con total de piezas por SKU y hardware agregado por ID.',
      inputSchema: {
        quotation_id: z.string().uuid(),
      },
    },
    async ({ quotation_id }) => {
      const sb = getSupabase();
      const { data: areas, error: areasErr } = await sb
        .from('project_areas')
        .select('id, name, quantity, applies_tariff, display_order')
        .eq('project_id', quotation_id)
        .order('display_order', { ascending: true, nullsFirst: false });
      if (areasErr) return failFromPostgrest('fetch areas failed', areasErr);
      if (!areas || areas.length === 0) {
        return ok({ quotation_id, areas: [], sku_counts: {}, hardware_counts: {} });
      }
      const areaIds = areas.map((a) => a.id);

      const { data: cabinets, error: cabErr } = await sb
        .from('area_cabinets')
        .select(
          'id, area_id, product_sku, quantity, hardware, subtotal, box_material_id, doors_material_id, labor_cost',
        )
        .in('area_id', areaIds);
      if (cabErr) return failFromPostgrest('fetch area_cabinets failed', cabErr);

      const skuCounts: Record<string, number> = {};
      const hardwareCounts: Record<string, number> = {};
      let totalSubtotal = 0;

      type HardwareEntry = { hardware_id?: string; quantity_per_cabinet?: number };
      for (const cab of cabinets ?? []) {
        const qty = cab.quantity ?? 1;
        if (cab.product_sku) {
          skuCounts[cab.product_sku] = (skuCounts[cab.product_sku] ?? 0) + qty;
        }
        totalSubtotal += cab.subtotal ?? 0;
        const hardware = Array.isArray(cab.hardware) ? (cab.hardware as HardwareEntry[]) : [];
        for (const entry of hardware) {
          if (!entry?.hardware_id) continue;
          const pieces = (entry.quantity_per_cabinet ?? 0) * qty;
          hardwareCounts[entry.hardware_id] =
            (hardwareCounts[entry.hardware_id] ?? 0) + pieces;
        }
      }

      const hardwareIds = Object.keys(hardwareCounts);
      const hwMap = new Map<string, string>();
      if (hardwareIds.length > 0) {
        const { data: hw } = await sb
          .from('price_list')
          .select('id, concept_description')
          .in('id', hardwareIds);
        (hw ?? []).forEach((h) => hwMap.set(h.id, h.concept_description));
      }

      const areasById = new Map(areas.map((a) => [a.id, a]));
      const byArea: Array<{
        area_id: string;
        area_name: string;
        area_quantity: number;
        applies_tariff: boolean;
        cabinet_count: number;
        cabinet_subtotal: number;
      }> = [];
      const byAreaAgg = new Map<
        string,
        { count: number; subtotal: number }
      >();
      for (const cab of cabinets ?? []) {
        const agg = byAreaAgg.get(cab.area_id) ?? { count: 0, subtotal: 0 };
        agg.count += cab.quantity ?? 1;
        agg.subtotal += cab.subtotal ?? 0;
        byAreaAgg.set(cab.area_id, agg);
      }
      for (const area of areas) {
        const agg = byAreaAgg.get(area.id) ?? { count: 0, subtotal: 0 };
        byArea.push({
          area_id: area.id,
          area_name: area.name,
          area_quantity: area.quantity ?? 1,
          applies_tariff: area.applies_tariff,
          cabinet_count: agg.count,
          cabinet_subtotal: agg.subtotal,
        });
      }

      return ok({
        quotation_id,
        total_cabinets: Object.values(skuCounts).reduce((s, n) => s + n, 0),
        total_subtotal_mxn: totalSubtotal,
        areas: byArea,
        sku_counts: skuCounts,
        hardware_counts: Object.entries(hardwareCounts).map(([id, qty]) => ({
          hardware_id: id,
          name: hwMap.get(id) ?? null,
          total_pieces: qty,
        })),
      });
    },
  );
}
