import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getSupabase } from '../shims/supabase.ts';
import { getSettings } from '../shims/settings.ts';
import { ok, failFromPostgrest, fail } from '../utils/errors.ts';

import {
  cabinetConfigFromCatalogProduct,
  computeCutList,
} from '@evita-lib/cabinet/index.ts';
import {
  parseDimsFromSku,
  parseDimsFromDescription,
  parseDoorDrawerConfig,
  getSeriesPrefix,
  cabinetTypeFromPrefix,
  getShelfCount,
} from '@evita-lib/cabinet/parseProductMetadata.ts';
import { getCabinetTotalCost } from '@evita-lib/pricing/getCabinetTotalCost.ts';
import {
  computeQuotationTotalsSqft,
  type AreaWithChildren,
  type QuotationMultipliers,
} from '@evita-lib/pricing/computeQuotationTotalsSqft.ts';

export function registerComputeTools(server: McpServer): void {
  server.registerTool(
    'get_settings',
    {
      title: 'Get business settings',
      description:
        'Devuelve los settings vivos: labor costs (con/sin drawers/accesorios), waste factors (box/doors), y FX USD→MXN. Cacheado 5 min.',
      inputSchema: {},
    },
    async () => {
      const settings = await getSettings();
      return ok(settings);
    },
  );

  server.registerTool(
    'parse_sku_metadata',
    {
      title: 'Parse SKU metadata',
      description:
        'Parsea un SKU CDS (y opcionalmente su descripción) para inferir: serie, dimensiones, cabinet type (base/wall/tall/etc.), configuración de puertas/cajones/shelves. Es el mismo parser que usa la app para generar despieces.',
      inputSchema: {
        sku: z.string(),
        description: z.string().optional(),
        has_drawers: z.boolean().optional(),
      },
    },
    async ({ sku, description, has_drawers }) => {
      const desc = description ?? '';
      const dims = parseDimsFromSku(sku) ?? parseDimsFromDescription(desc);
      const prefix = getSeriesPrefix(sku);
      const cabinetType = cabinetTypeFromPrefix(prefix, desc);
      const dd = parseDoorDrawerConfig(sku, desc, has_drawers ?? null);
      const shelf = dims && cabinetType
        ? getShelfCount(sku, desc, cabinetType, dims.heightIn, dd.isSink)
        : { count: 0, type: 'fixed' as const };
      return ok({
        sku,
        series_prefix: prefix,
        cabinet_type: cabinetType,
        dimensions_inches: dims,
        dimensions_mm: dims
          ? {
              widthMm: Math.round(dims.widthIn * 25.4),
              heightMm: Math.round(dims.heightIn * 25.4),
              depthMm: Math.round(dims.depthIn * 25.4),
            }
          : null,
        doors: { hasDoors: dd.hasDoors, numDoors: dd.numDoors },
        drawers: { hasDrawers: dd.hasDrawers, numDrawers: dd.numDrawers },
        is_sink: dd.isSink,
        is_open_box: dd.isOpenBox,
        shelves: shelf,
      });
    },
  );

  server.registerTool(
    'compute_cut_list',
    {
      title: 'Compute cut list for a catalog product',
      description:
        'Corre el engine de despiece sobre un producto del catálogo (por SKU o product_id) y devuelve la lista de cortes (CutPieces) con ancho, alto, cantidad, material y edgeband en mm.',
      inputSchema: {
        sku: z.string().optional(),
        product_id: z.string().uuid().optional(),
      },
    },
    async ({ sku, product_id }) => {
      if (!sku && !product_id) return fail('Provide sku or product_id');
      const sb = getSupabase();
      let query = sb
        .from('products_catalog')
        .select('id, sku, description, has_drawers, cut_pieces')
        .limit(1);
      if (product_id) query = query.eq('id', product_id);
      else if (sku) query = query.eq('sku', sku);
      const { data, error } = await query.maybeSingle();
      if (error) return failFromPostgrest('fetch product failed', error);
      if (!data) return fail(`Product not found for ${sku ?? product_id}`);

      const result = cabinetConfigFromCatalogProduct({
        id: data.id,
        sku: data.sku,
        description: data.description,
        has_drawers: data.has_drawers,
        cut_pieces: data.cut_pieces,
      });

      if (!result.ok) {
        return ok({
          product: { id: data.id, sku: data.sku, description: data.description },
          adapter_result: {
            ok: false,
            reason: result.reason,
            message: result.message,
          },
          cut_pieces: null,
        });
      }

      const pieces = computeCutList(result.config);
      return ok({
        product: { id: data.id, sku: data.sku, description: data.description },
        parsed_dims_in: result.parsedDims,
        cabinet_config: result.config,
        cut_pieces: pieces,
        piece_count: pieces.length,
        total_quantity: pieces.reduce((s, p) => s + p.cantidad, 0),
      });
    },
  );

  server.registerTool(
    'get_cabinet_total_cost',
    {
      title: 'Live recompute of a cabinet total cost',
      description:
        'Suma los 15 campos de costo de un area_cabinet (box/doors/back/drawer/shelf material + edgeband + hardware + accesorios + labor + door_profile + interior finish). Útil para detectar drift contra el campo denormalizado `subtotal`.',
      inputSchema: { cabinet_id: z.string().uuid() },
    },
    async ({ cabinet_id }) => {
      const sb = getSupabase();
      const { data, error } = await sb
        .from('area_cabinets')
        .select('*')
        .eq('id', cabinet_id)
        .maybeSingle();
      if (error) return failFromPostgrest('fetch cabinet failed', error);
      if (!data) return fail(`Cabinet ${cabinet_id} not found`);
      const live = getCabinetTotalCost(data as unknown as Record<string, unknown>);
      return ok({
        cabinet_id,
        product_sku: data.product_sku,
        quantity: data.quantity,
        live_total_cost: live,
        cached_subtotal: data.subtotal,
        drift: live - (data.subtotal ?? 0),
        in_sync: Math.abs(live - (data.subtotal ?? 0)) < 0.01,
      });
    },
  );

  server.registerTool(
    'compute_quotation_totals',
    {
      title: 'Compute quotation totals (sqft mode)',
      description:
        'Recomputa en vivo los totales de una quotation en modo sqft: fetch de áreas + cabinets/items/countertops/closets/prefabs + multipliers de la quotation, y corre computeQuotationTotalsSqft. Devuelve materialsSubtotal, price, tariff, referral, tax y fullProjectTotal.',
      inputSchema: {
        quotation_id: z.string().uuid(),
      },
    },
    async ({ quotation_id }) => {
      const sb = getSupabase();
      const { data: quotation, error: qErr } = await sb
        .from('quotations')
        .select(
          'id, name, pricing_method, profit_multiplier, tariff_multiplier, tax_percentage, referral_currency_rate, install_delivery, other_expenses, risk_factor_percentage, risk_factor_applies_sqft, total_amount',
        )
        .eq('id', quotation_id)
        .maybeSingle();
      if (qErr) return failFromPostgrest('fetch quotation failed', qErr);
      if (!quotation) return fail(`Quotation ${quotation_id} not found`);

      const { data: areas, error: aErr } = await sb
        .from('project_areas')
        .select('*')
        .eq('project_id', quotation_id)
        .order('display_order', { ascending: true, nullsFirst: false });
      if (aErr) return failFromPostgrest('fetch areas failed', aErr);
      if (!areas || areas.length === 0) {
        return ok({
          quotation_id,
          warning: 'no areas',
          totals: null,
        });
      }
      const areaIds = areas.map((a) => a.id);

      const [cabRes, itemRes, ctRes, closRes, prefRes] = await Promise.all([
        sb.from('area_cabinets').select('*').in('area_id', areaIds),
        sb.from('area_items').select('*').in('area_id', areaIds),
        sb.from('area_countertops').select('*').in('area_id', areaIds),
        sb.from('area_closet_items').select('*').in('area_id', areaIds),
        sb.from('area_prefab_items').select('*').in('area_id', areaIds),
      ]);
      if (cabRes.error) return failFromPostgrest('fetch area_cabinets failed', cabRes.error);
      if (itemRes.error) return failFromPostgrest('fetch area_items failed', itemRes.error);
      if (ctRes.error) return failFromPostgrest('fetch area_countertops failed', ctRes.error);
      if (closRes.error) return failFromPostgrest('fetch area_closet_items failed', closRes.error);
      if (prefRes.error) return failFromPostgrest('fetch area_prefab_items failed', prefRes.error);

      const cabinets = cabRes.data ?? [];
      const items = itemRes.data ?? [];
      const countertops = ctRes.data ?? [];
      const closets = closRes.data ?? [];
      const prefabs = prefRes.data ?? [];

      const areasData: AreaWithChildren[] = areas.map((area) => ({
        ...area,
        cabinets: cabinets.filter((c) => c.area_id === area.id),
        items: items.filter((i) => i.area_id === area.id) as unknown as AreaWithChildren['items'],
        countertops: countertops.filter(
          (c) => c.area_id === area.id,
        ) as unknown as AreaWithChildren['countertops'],
        closetItems: closets.filter(
          (c) => c.area_id === area.id,
        ) as unknown as AreaWithChildren['closetItems'],
        prefabItems: prefabs.filter(
          (p) => p.area_id === area.id,
        ) as unknown as AreaWithChildren['prefabItems'],
      }));

      const appliesRisk = quotation.risk_factor_applies_sqft ?? true;
      const multipliers: QuotationMultipliers = {
        profitMultiplier: quotation.profit_multiplier ?? 0,
        tariffMultiplier: quotation.tariff_multiplier ?? 0,
        referralRate: quotation.referral_currency_rate ?? 0,
        taxPercentage: quotation.tax_percentage ?? 0,
        installDeliveryMxn: quotation.install_delivery ?? 0,
        otherExpenses: quotation.other_expenses ?? 0,
        riskFactorPct: appliesRisk ? quotation.risk_factor_percentage ?? 0 : 0,
      };

      const totals = computeQuotationTotalsSqft(areasData, multipliers);
      return ok({
        quotation_id,
        name: quotation.name,
        pricing_method_on_record: quotation.pricing_method,
        multipliers,
        totals,
        stored_total_amount: quotation.total_amount,
        drift_vs_stored:
          quotation.total_amount != null ? totals.fullProjectTotal - quotation.total_amount : null,
      });
    },
  );
}
