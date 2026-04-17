import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const EVITA_SECRET  = Deno.env.get('EVITA_IA_SECRET')  ?? '';
const SB_URL        = Deno.env.get('SUPABASE_URL')      ?? '';
const SB_SERVICE    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const SB_ANON       = Deno.env.get('SUPABASE_ANON_KEY')         ?? '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-evita-key',
};

function hasModificationIntent(messages: {role:string;content:string}[]): boolean {
  const last = [...messages].reverse().find(m => m.role === 'user')?.content ?? '';
  const kw = ['cambia','cambiar','actualiza','actualizar','modifica','modificar',
    'pon','poner','agrega','agregar','quita','quitar','elimina','eliminar',
    'change','update','modify','set','add','remove','delete','switch',
    'reemplaza','reemplazar','aplica','aplicar',
    'hardware','pull','pulls','jaladera','jaladora','jaladores','jaladeras',
    'bisagra','bisagras','hinge','hinges','slide','slides','correderas',
    'sink tray','tray','herraje','herrajes','manija','manijas',
    // Purchases / inventory / suppliers
    'compra','compras','pedido','pedidos','proveedor','proveedores',
    'almacén','almacen','inventario','stock','movimiento','movimientos',
    'llegó','llego','llegaron','recibido','recibida','recibidos',
    'purchase','purchases','order','orders','supplier','suppliers','vendor',
    'inventory','warehouse','movement','received','arrived',
    // Optimizer runs / pricing method
    'ejecutar','corrida','corridas','optimizador','método','metodo','activar','activa',
    'run','runs','optimizer','method','activate','toggle'];
  return kw.some(k => last.toLowerCase().includes(k));
}

function normalizeQuotes(s: string): string {
  return s
    .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'");
}

function extractSkus(messages: {role:string;content:string}[]): string[] {
  const raw = messages.map(m => m.content).join(' ');
  const text = normalizeQuotes(raw);
  const p1 = text.match(/[A-Z]{0,4}\d{2,4}[-x"x\-.][^\s,;]{2,}/gi) ?? [];
  const p2 = text.match(/\b(CAS|CSS|CDB|DH|HPO|HPT|H|KSC|DB|TPO|RTA)[A-Z0-9][A-Z0-9\-]{2,}/gi) ?? [];
  const all = [...p1, ...p2];
  const seen = new Set<string>();
  return all.map(s => normalizeQuotes(s.trim()).toUpperCase()).filter(s => s.length >= 4 && !seen.has(s) && !!seen.add(s));
}

const SEARCH_TOOLS = [
  {
    name: 'search_materials',
    description: 'Search for materials, hardware, or any item in the price list by name. Use for ANY price or material query.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search term e.g. "Oval Rod", "Blum", "Evita Plus Nogal Tenue"' },
        type: { type: 'string', description: 'Optional filter: Melamine, Edgeband, Hinges, Slides, Special Hardware, Laminate' }
      },
      required: ['query']
    }
  },
];

const CATALOG_SEARCH_TOOL = [
  {
    name: 'search_catalog',
    description: 'Search the products catalog by description or keyword when the exact SKU is not known. Use when user describes a cabinet without a SKU code.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search keywords e.g. "base 2 door", "sink base", "wall 30"' },
        has_drawers: { type: 'boolean' },
        limit: { type: 'number' }
      },
      required: ['query']
    }
  }
];

const KNOWLEDGE_TOOLS = [
  {
    name: 'search_templates',
    description: 'Search saved cabinet templates by name, category, or SKU. Use when user asks about available templates or wants to find a specific template.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search term e.g. "kitchen", "Premium", "102"' },
        category: { type: 'string', description: 'Optional category filter e.g. "Kitchen", "Closet", "General"' }
      },
      required: ['query']
    }
  },
  {
    name: 'search_closet_catalog',
    description: 'Search the closet catalog for prefab closet items with pricing. Use when user asks about closet products, closet pricing, or closet options.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search term e.g. "double hang", "shelf", "COS1812"' },
        evita_line: { type: 'string', description: 'Optional filter: "Evita Plus" or "Evita Premium"' }
      },
      required: ['query']
    }
  },
  {
    name: 'search_prefab_catalog',
    description: 'Search the prefab cabinets catalog (Venus / Northville reseller SKUs) with current per-finish USD pricing. Use when user asks about Venus, Northville, prefab cabinets, or any code like B24, W3030, SB36, OC3384, etc. Returns dims, item_type, and an array of active finishes with cost_usd. Cost in MXN is computed at quote time via the project FX rate.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search term: cabinet_code, description, or category. e.g. "B24", "wall cabinet", "sink base"' },
        brand: { type: 'string', description: 'Optional brand filter: "Venus" or "Northville"' },
        finish: { type: 'string', description: 'Optional finish filter, e.g. "Houston Frost", "Elegant White"' }
      },
      required: ['query']
    }
  },
  {
    name: 'get_project_management',
    description: 'Get project management data: tasks, documents, and activity log for the currently open project. Use when user asks about tasks, documents, or project notes.',
    input_schema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
];

const KB_TOOLS = [
  {
    name: 'search_kb',
    description: 'Search the internal Evita Knowledge Base (policy, finishes, cubrecantos, hardware, production rules, constants, glossary). Returns ranked results with slug + snippet. ALWAYS call this FIRST for questions about: waste multipliers, labor costs, FX, material IDs, CDS series, plywood rules, cut-list edgeband patterns, finish lines (Plus/Premium/Elite), supplier references, and anything that sounds like an internal rule or policy.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Free-text query in Spanish or English. e.g. "desperdicio box", "Plus finish", "CDS 100 series"' },
        category: { type: 'string', description: 'Optional category slug filter: finishes, edge-bands, toe-kicks, hardware, panels-shelves, glass-aluminum, countertops, blinds, production, costs, rules, glossary' },
        entry_type: { type: 'string', description: 'Optional filter: finish, edge_band, toe_kick, hardware, panel, shelf, countertop, blind, cost_constant, rule, glossary, general' },
        limit: { type: 'integer', description: 'Max results (default 8).' }
      },
      required: ['query']
    }
  },
  {
    name: 'get_kb_entry',
    description: 'Fetch the full body of a KB entry by slug. Use when search_kb returned a relevant entry and you need the full content to answer accurately (numeric constants, verbatim tables, nested rules). Quote numbers exactly from the returned body_md.',
    input_schema: {
      type: 'object',
      properties: {
        slug: { type: 'string', description: 'Entry slug, e.g. "rules-project-constants", "finishes-plus"' }
      },
      required: ['slug']
    }
  },
  {
    name: 'search_suppliers_kb',
    description: 'Search KB suppliers by name or category. Returns slug + notes. Use when user asks who supplies X, what lines a supplier serves, or needs contact context. Cite with [[supplier:slug|Name]].',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Supplier name or category keyword. e.g. "Blum", "barcocinas", "hardware", "textiles"' },
        limit: { type: 'integer', description: 'Max results (default 5).' }
      },
      required: ['query']
    }
  },
];

const WIKI_TOOLS = [
  {
    name: 'search_wiki',
    description: 'Search the internal Evita Wiki (long-form articles: assembly techniques, safety/EPP, quality control, training, shop floor workflow). Call this when the user asks HOW to do something in production (how to install, how to align, protocols, checklists, procedures) — as opposed to numeric policy/constants which live in search_kb.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Free-text query in Spanish or English. e.g. "correderas ocultas", "EPP", "alineación de puertas".' },
        category: { type: 'string', description: 'Optional category slug filter: welcome, assembly, safety, quality, training, workflow.' },
        limit: { type: 'integer', description: 'Max results (default 6).' }
      },
      required: ['query']
    }
  },
  {
    name: 'get_wiki_article',
    description: 'Fetch the full body of a Wiki article by slug. Use after search_wiki when the user needs detailed step-by-step procedures, checklists, or tolerances. Quote verbatim.',
    input_schema: {
      type: 'object',
      properties: {
        slug: { type: 'string', description: 'Article slug, e.g. "assembly-correderas-ocultas".' }
      },
      required: ['slug']
    }
  },
];

const MODIFICATION_TOOLS = [
  {
    name: 'get_area_cabinets',
    description: 'Get all cabinets in a specific area of the open project. Always call this before making changes.',
    input_schema: {
      type: 'object',
      properties: {
        area_name: { type: 'string', description: 'Name of the area e.g. Kitchen, Master Closet' }
      },
      required: ['area_name']
    }
  },
  {
    name: 'update_cabinet_material',
    description: 'Update box or door material/edgeband for cabinets. Always show preview and ask confirmation before calling.',
    input_schema: {
      type: 'object',
      properties: {
        cabinet_ids: { type: 'array', items: { type: 'string' } },
        field: { type: 'string', enum: ['box_material_id','doors_material_id','box_edgeband_id','doors_edgeband_id'] },
        new_material_id: { type: 'string' },
        new_material_name: { type: 'string' }
      },
      required: ['cabinet_ids','field','new_material_id','new_material_name']
    }
  },
  {
    name: 'update_cabinet_quantity',
    description: 'Update quantity of a specific cabinet. Confirm with user before calling.',
    input_schema: {
      type: 'object',
      properties: {
        cabinet_id: { type: 'string' },
        new_quantity: { type: 'number' },
        cabinet_sku: { type: 'string' }
      },
      required: ['cabinet_id','new_quantity','cabinet_sku']
    }
  },
  {
    name: 'update_quotation_settings',
    description: 'Update quotation-level settings: profit, tax, tariff, install cost. Confirm before calling.',
    input_schema: {
      type: 'object',
      properties: {
        field: { type: 'string', enum: ['profit_multiplier','tax_percentage','tariff_multiplier','install_delivery','referral_currency_rate'] },
        new_value: { type: 'number' }
      },
      required: ['field','new_value']
    }
  },
  {
    name: 'get_all_cabinets',
    description: 'Get ALL areas and ALL cabinets for the open project including hardware info. Use before bulk hardware operations to calculate scope and preview cost delta.',
    input_schema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'bulk_update_hardware',
    description: 'Add or replace a hardware item across ALL (or filtered) cabinets in the project. Handles JSONB merge, cost delta, and cascade automatically. Call once per hardware item. Always show preview and confirm before calling.',
    input_schema: {
      type: 'object',
      properties: {
        hardware_id:   { type: 'string', description: 'price_list UUID of the hardware item to add' },
        price:         { type: 'number', description: 'Price per unit (MXN)' },
        qty_rule:      { type: 'string', enum: ['pull_standard','sink_tray_kitchen_only','fixed:0','fixed:1','fixed:2','fixed:3','fixed:4','fixed:5','fixed:6'], description: 'pull_standard=standard pull count by SKU prefix | sink_tray_kitchen_only=only 152 in kitchen areas | fixed:N=same qty for all' },
        remove_id:     { type: 'string', description: 'Optional: UUID of hardware item to remove/replace' },
        remove_price:  { type: 'number', description: 'Price of item being removed (for cost delta)' },
        area_filter:   { type: 'string', description: 'Optional: ILIKE filter on area name e.g. "kitchen"' }
      },
      required: ['hardware_id','price','qty_rule']
    }
  },
  {
    name: 'update_purchase_item_status',
    description: 'Change the status of a project purchase item. DB trigger auto-creates an IN inventory movement when status becomes "In Warehouse", and a RETURN movement when status becomes "Return". Always confirm before calling.',
    input_schema: {
      type: 'object',
      properties: {
        purchase_item_id: { type: 'string', description: 'UUID of the project_purchase_items row' },
        new_status:       { type: 'string', enum: ['Ordered','Paid','In Transit','In Warehouse','Return'], description: 'New status value' }
      },
      required: ['purchase_item_id','new_status']
    }
  },
  {
    name: 'set_active_optimizer_run',
    description: 'Mark a saved optimizer run as active for the open quotation. Also writes quotations.active_optimizer_run_id and refreshes optimizer_total_amount from the run total_cost. Confirm before calling.',
    input_schema: {
      type: 'object',
      properties: {
        run_id: { type: 'string', description: 'UUID of the quotation_optimizer_runs row' }
      },
      required: ['run_id']
    }
  },
  {
    name: 'set_pricing_method',
    description: 'Toggle the open quotation between "sqft" (ft²) and "optimizer" pricing. When switching to optimizer, mirrors optimizer_total_amount into total_amount so the rollup matches. Confirm before calling.',
    input_schema: {
      type: 'object',
      properties: {
        method: { type: 'string', enum: ['sqft','optimizer'], description: 'Target pricing method' }
      },
      required: ['method']
    }
  }
];

// ────────────────────────────────────────────────────────────────
// Read-only tools for inventory, suppliers, purchases, optimizer
// Always available (no modification intent required).
// ────────────────────────────────────────────────────────────────
const INVENTORY_TOOLS = [
  {
    name: 'get_inventory_stock',
    description: 'Look up current stock level, WAC (average_cost), last purchase cost, min stock level, location, and primary supplier for price_list items. Pass a query to search by name, or an item_id for a direct lookup.',
    input_schema: {
      type: 'object',
      properties: {
        query:          { type: 'string', description: 'Search term for concept_description e.g. "MDF 3/4", "Blum", "Oval Rod"' },
        item_id:        { type: 'string', description: 'Optional: exact price_list UUID' },
        only_below_min: { type: 'boolean', description: 'If true, only return items where stock_quantity < min_stock_level' }
      },
      required: []
    }
  },
  {
    name: 'get_low_stock_items',
    description: 'List price_list items where stock_quantity < min_stock_level and min_stock_level > 0 (items that need to be reordered). Limited to 25 results.',
    input_schema: {
      type: 'object',
      properties: {
        type: { type: 'string', description: 'Optional type filter e.g. "Melamine", "Hardware"' }
      },
      required: []
    }
  },
  {
    name: 'get_inventory_movements',
    description: 'Get the inventory movement ledger (IN/OUT/ADJUSTMENT/RETURN) for a specific item or project. Returns recent movements with running WAC.',
    input_schema: {
      type: 'object',
      properties: {
        item_id:       { type: 'string', description: 'Optional: price_list UUID to filter by item' },
        project_id:    { type: 'string', description: 'Optional: projects.id (business-level) to filter by project' },
        movement_type: { type: 'string', enum: ['IN','OUT','ADJUSTMENT','RETURN'], description: 'Optional movement type filter' },
        limit:         { type: 'number', description: 'Max rows (default 20)' }
      },
      required: []
    }
  },
  {
    name: 'search_suppliers',
    description: 'Search suppliers by name or contact. Returns name, contact, phone, email, lead_time_days, payment_terms.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search term e.g. "Rehau", "Blum"' }
      },
      required: ['query']
    }
  }
];

const PURCHASE_READ_TOOLS = [
  {
    name: 'get_purchase_items',
    description: 'Get project purchase items for the business project that owns the open quotation. Resolves projects.id automatically from the open quotation via quotations.project_id. Supports filtering by status, priority, or supplier name. Use when user asks about purchases, pedidos, orders for the current project.',
    input_schema: {
      type: 'object',
      properties: {
        status:         { type: 'string', enum: ['Ordered','Paid','In Transit','In Warehouse','Return','Pending','Delay'], description: 'Optional status filter' },
        priority:       { type: 'string', enum: ['Urgent','High','Medium','Low'], description: 'Optional priority filter' },
        supplier_query: { type: 'string', description: 'Optional ILIKE on supplier name' }
      },
      required: []
    }
  }
];

const OPTIMIZER_TOOLS = [
  {
    name: 'get_optimizer_runs',
    description: 'List saved optimizer runs for the open quotation, with KPIs (total_cost, material_cost, waste_pct, board_count, cost_per_m2) and active/stale flags. Use for comparison, version history, or to answer "which run is active" questions.',
    input_schema: { type: 'object', properties: {}, required: [] }
  }
];

const BOM_TOOLS = [
  {
    name: 'get_quotation_bom',
    description: 'Get the Bill of Materials (BOM) for the open quotation, aggregated by category (Box Construction, Doors & Fronts, Edgeband, Hardware, Accessories, Items, Countertops). Returns concept, quantity, unit, price, and subtotal per row. Use when user asks for the BOM, despiece, or material list of the open quotation.',
    input_schema: { type: 'object', properties: {}, required: [] }
  }
];

async function executeTool(name: string, input: any, sb: any, projectId: string | null): Promise<string> {
  try {
    switch (name) {

      case 'search_materials': {
        let q = sb.from('price_list')
          .select('id, concept_description, type, price, unit')
          .ilike('concept_description', `%${input.query}%`)
          .eq('is_active', true)
          .limit(10);
        if (input.type) q = q.eq('type', input.type);
        const { data, error } = await q;
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify({ count: data?.length ?? 0, results: data ?? [] });
      }

      case 'get_area_cabinets': {
        if (!projectId) return JSON.stringify({ error: 'No project open.' });
        const { data: areas, error: aErr } = await sb.from('project_areas')
          .select('id, name')
          .eq('project_id', projectId)
          .ilike('name', `%${input.area_name}%`);
        if (aErr) return JSON.stringify({ error: aErr.message });
        if (!areas?.length) return JSON.stringify({ error: `Area "${input.area_name}" not found.` });
        const areaId = areas[0].id;
        const { data: cabs, error: cErr } = await sb.from('area_cabinets')
          .select('id, product_sku, quantity, box_material_id, doors_material_id, box_edgeband_id, doors_edgeband_id, subtotal')
          .eq('area_id', areaId);
        if (cErr) return JSON.stringify({ error: cErr.message });
        const matIds = [...new Set([
          ...(cabs?.map((c:any) => c.box_material_id).filter(Boolean) ?? []),
          ...(cabs?.map((c:any) => c.doors_material_id).filter(Boolean) ?? []),
        ])];
        let matNames: Record<string,string> = {};
        if (matIds.length) {
          const { data: mats } = await sb.from('price_list').select('id, concept_description').in('id', matIds);
          mats?.forEach((m:any) => { matNames[m.id] = m.concept_description; });
        }
        return JSON.stringify({
          area: areas[0].name, area_id: areaId,
          cabinet_count: cabs?.length ?? 0,
          cabinets: cabs?.map((c:any) => ({
            id: c.id, sku: c.product_sku, qty: c.quantity,
            subtotal_mxn: c.subtotal,
            box_material: matNames[c.box_material_id] ?? c.box_material_id,
            doors_material: matNames[c.doors_material_id] ?? c.doors_material_id,
          }))
        });
      }

      case 'update_cabinet_material': {
        if (!projectId) return JSON.stringify({ error: 'No project open.' });
        if (!input.cabinet_ids?.length) return JSON.stringify({ error: 'No cabinet IDs.' });
        const { error } = await sb.from('area_cabinets')
          .update({ [input.field]: input.new_material_id })
          .in('id', input.cabinet_ids);
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify({
          success: true, updated: input.cabinet_ids.length,
          message: `Updated ${input.cabinet_ids.length} cabinet(s). ${input.field} -> "${input.new_material_name}". Refresh project to see recalculated totals.`
        });
      }

      case 'update_cabinet_quantity': {
        if (!projectId) return JSON.stringify({ error: 'No project open.' });
        if (input.new_quantity < 1) return JSON.stringify({ error: 'Quantity must be >= 1.' });
        const { error } = await sb.from('area_cabinets')
          .update({ quantity: input.new_quantity }).eq('id', input.cabinet_id);
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify({ success: true, message: `${input.cabinet_sku} quantity updated to ${input.new_quantity}. Refresh to see totals.` });
      }

      case 'update_quotation_settings': {
        if (!projectId) return JSON.stringify({ error: 'No project open.' });
        const { error } = await sb.from('quotations')
          .update({ [input.field]: input.new_value }).eq('id', projectId);
        if (error) return JSON.stringify({ error: error.message });
        const labels: Record<string,string> = {
          profit_multiplier:'Profit', tax_percentage:'Tax',
          tariff_multiplier:'Tariff', install_delivery:'Install/Delivery',
          referral_currency_rate:'Referral'
        };
        return JSON.stringify({ success: true, message: `${labels[input.field] ?? input.field} updated to ${input.new_value}. Refresh to see totals.` });
      }

      case 'search_catalog': {
        const limit = input.limit ?? 5;
        const normalizedQuery = normalizeQuotes(input.query);
        let q = sb.from('products_catalog')
          .select('sku, description, box_sf, doors_fronts_sf, box_edgeband, box_edgeband_color, doors_fronts_edgeband, has_drawers, boxes_per_unit')
          .ilike('description', `%${normalizedQuery}%`)
          .eq('is_active', true)
          .limit(limit);
        if (typeof input.has_drawers === 'boolean') {
          q = q.eq('has_drawers', input.has_drawers);
        }
        const { data, error } = await q;
        if (error) return JSON.stringify({ error: error.message });
        if (!data?.length) {
          const { data: skuData } = await sb.from('products_catalog')
            .select('sku, description, box_sf, doors_fronts_sf, box_edgeband, box_edgeband_color, doors_fronts_edgeband, has_drawers, boxes_per_unit')
            .ilike('sku', `%${normalizeQuotes(input.query)}%`)
            .eq('is_active', true)
            .limit(limit);
          if (skuData?.length) {
            return JSON.stringify({ count: skuData.length, results: skuData, matched_by: 'sku' });
          }
          const words = normalizedQuery.split(' ').filter((w: string) => w.length > 2);
          if (words.length > 1) {
            const { data: data2 } = await sb.from('products_catalog')
              .select('sku, description, box_sf, doors_fronts_sf, box_edgeband, box_edgeband_color, doors_fronts_edgeband, has_drawers, boxes_per_unit')
              .ilike('description', `%${words[0]}%`)
              .eq('is_active', true)
              .limit(limit);
            return JSON.stringify({ count: data2?.length ?? 0, results: data2 ?? [], note: 'Broader search used' });
          }
        }
        return JSON.stringify({ count: data?.length ?? 0, results: data ?? [] });
      }

      case 'get_all_cabinets': {
        if (!projectId) return JSON.stringify({ error: 'No project open.' });
        const { data: areas, error: ae } = await sb.from('project_areas')
          .select('id, name, applies_tariff, subtotal')
          .eq('project_id', projectId).order('display_order');
        if (ae) return JSON.stringify({ error: ae.message });
        const areaIds = (areas ?? []).map((a: any) => a.id);
        const { data: cabs, error: ce } = await sb.from('area_cabinets')
          .select('id, area_id, product_sku, quantity, hardware, hardware_cost, subtotal')
          .in('area_id', areaIds);
        if (ce) return JSON.stringify({ error: ce.message });
        const cabsByArea: Record<string, any[]> = {};
        for (const c of cabs ?? []) {
          if (!cabsByArea[c.area_id]) cabsByArea[c.area_id] = [];
          cabsByArea[c.area_id].push({
            id: c.id, sku: c.product_sku, prefix: c.product_sku.split('-')[0],
            qty: c.quantity, hardware: c.hardware, subtotal: c.subtotal
          });
        }
        const result = (areas ?? []).map((a: any) => ({
          area_id: a.id, area_name: a.name, applies_tariff: a.applies_tariff,
          area_subtotal: a.subtotal, cabinets: cabsByArea[a.id] ?? []
        }));
        // Collect hardware items used across all cabinets
        let hardwareSummary: Record<string, { name: string; total_qty: number; total_cost: number }> = {};
        if (areaIds.length) {
          const { data: cabHardware } = await sb.from('area_cabinets')
            .select('hardware, hardware_cost, quantity')
            .in('area_id', areaIds);
          if (cabHardware) {
            for (const c of cabHardware) {
              const hw = c.hardware as Record<string, any> | null;
              if (!hw) continue;
              for (const [hwId, hwData] of Object.entries(hw)) {
                if (!hwData || typeof hwData !== 'object') continue;
                const name = (hwData as any).name ?? hwId;
                const qty = Number((hwData as any).qty ?? 0) * (Number(c.quantity) || 1);
                const cost = Number((hwData as any).price ?? 0) * qty;
                if (!hardwareSummary[hwId]) hardwareSummary[hwId] = { name, total_qty: 0, total_cost: 0 };
                hardwareSummary[hwId].total_qty += qty;
                hardwareSummary[hwId].total_cost += cost;
              }
            }
          }
        }
        return JSON.stringify({
          project_id: projectId,
          total_areas: (areas ?? []).length,
          total_cabinet_lines: (cabs ?? []).length,
          areas: result,
          hardware_used: Object.values(hardwareSummary).map(h => ({
            name: h.name,
            total_qty: h.total_qty,
            total_cost: `$${Math.round(h.total_cost).toLocaleString('en-US')}`,
          })),
        });
      }

      case 'bulk_update_hardware': {
        if (!projectId) return JSON.stringify({ error: 'No project open.' });
        const { data, error } = await sb.rpc('evita_hardware_bulk_update', {
          p_project_id:  projectId,
          p_hardware_id: input.hardware_id,
          p_price:       input.price,
          p_qty_rule:    input.qty_rule ?? 'pull_standard',
          p_remove_id:   input.remove_id ?? null,
          p_remove_price:input.remove_price ?? 0,
          p_area_filter: input.area_filter ?? null,
        });
        if (error) return JSON.stringify({ error: error.message });
        const d = data as any;
        return JSON.stringify({
          success: true,
          updated: d?.updated ?? 0,
          new_project_total: d?.new_project_total ?? 0,
          message: `Updated ${d?.updated ?? 0} cabinet lines. New project total: $${Number(d?.new_project_total ?? 0).toLocaleString('en-US', { maximumFractionDigits: 2 })} MXN. Refresh to see changes.`
        });
      }

      case 'search_templates': {
        let q = sb.from('cabinet_templates')
          .select('id, name, category, product_sku, product_description, box_material_name, doors_material_name, hardware, usage_count, last_used_at')
          .ilike('name', `%${input.query}%`)
          .limit(10);
        if (input.category) q = q.eq('category', input.category);
        const { data, error } = await q;
        if (error) return JSON.stringify({ error: error.message });
        if (!data?.length) {
          const { data: d2 } = await sb.from('cabinet_templates')
            .select('id, name, category, product_sku, product_description, box_material_name, doors_material_name, hardware, usage_count, last_used_at')
            .ilike('product_sku', `%${input.query}%`)
            .limit(10);
          return JSON.stringify({ count: d2?.length ?? 0, results: d2 ?? [] });
        }
        return JSON.stringify({ count: data.length, results: data });
      }

      case 'search_closet_catalog': {
        let q = sb.from('closet_catalog')
          .select('id, cabinet_code, description, evita_line, height_in, width_in, depth_in, price_with_backs_usd, price_without_backs_usd, has_backs_option, boxes_count')
          .eq('is_active', true)
          .limit(10);
        if (input.evita_line) q = q.eq('evita_line', input.evita_line);
        const { data, error } = await q.or(`description.ilike.%${input.query}%,cabinet_code.ilike.%${input.query}%`);
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify({ count: data?.length ?? 0, results: data ?? [] });
      }

      case 'search_prefab_catalog': {
        // Optional brand filter. Resolve brand id once so we can narrow on
        // the main query instead of post-filtering in JS.
        let brandId: string | null = null;
        if (input.brand) {
          const { data: brandRow } = await sb.from('prefab_brand')
            .select('id, name')
            .ilike('name', input.brand)
            .maybeSingle();
          if (brandRow) brandId = brandRow.id;
        }

        let q = sb.from('prefab_catalog')
          .select('id, cabinet_code, category, description, item_type, width_in, height_in, depth_in, brand:prefab_brand(name), current_prices:prefab_catalog_price(finish, cost_usd, is_current)')
          .eq('is_active', true)
          .limit(10);
        if (brandId) q = q.eq('brand_id', brandId);
        const { data, error } = await q.or(
          `cabinet_code.ilike.%${input.query}%,description.ilike.%${input.query}%,category.ilike.%${input.query}%`
        );
        if (error) return JSON.stringify({ error: error.message });

        // Keep only current prices and optionally filter by finish.
        const results = (data ?? []).map((row: any) => {
          let prices = (row.current_prices ?? []).filter((p: any) => p.is_current);
          if (input.finish) {
            prices = prices.filter((p: any) =>
              String(p.finish).toLowerCase().includes(String(input.finish).toLowerCase())
            );
          }
          return {
            id: row.id,
            brand: row.brand?.name ?? null,
            cabinet_code: row.cabinet_code,
            category: row.category,
            description: row.description,
            item_type: row.item_type,
            width_in: row.width_in,
            height_in: row.height_in,
            depth_in: row.depth_in,
            // NOTE: cost_usd is the raw vendor MSRP. The project-level
            // profit_multiplier + tariff_multiplier scale it automatically at
            // quote time; do NOT mention a markup in the response.
            finishes: prices.map((p: any) => ({ finish: p.finish, cost_usd: p.cost_usd })),
          };
        });
        return JSON.stringify({ count: results.length, results });
      }

      case 'search_kb': {
        const q = String(input.query ?? '').trim();
        const limit = Math.min(Math.max(Number(input.limit ?? 8), 1), 30);
        let builder = sb.from('kb_entries')
          .select('id, slug, title, entry_type, category_id, body_md, tags, needs_enrichment, updated_at')
          .neq('status', 'archived')
          .limit(limit);
        if (input.category) {
          const { data: catRow } = await sb.from('kb_categories')
            .select('id').eq('slug', input.category).maybeSingle();
          if (catRow) builder = builder.eq('category_id', catRow.id);
        }
        if (input.entry_type) builder = builder.eq('entry_type', input.entry_type);

        let rows: any[] = [];
        if (q) {
          const fts = await builder.textSearch('search_tsv', q, { type: 'websearch', config: 'spanish' });
          if (!fts.error && fts.data && fts.data.length > 0) rows = fts.data;
          if (rows.length === 0) {
            const fallback = await sb.from('kb_entries')
              .select('id, slug, title, entry_type, category_id, body_md, tags, needs_enrichment, updated_at')
              .neq('status', 'archived')
              .or(`title.ilike.%${q}%,slug.ilike.%${q}%`)
              .limit(limit);
            if (!fallback.error && fallback.data) rows = fallback.data;
          }
        } else {
          const { data } = await builder.order('updated_at', { ascending: false });
          rows = data ?? [];
        }

        const catIds = [...new Set(rows.map((r) => r.category_id).filter(Boolean))];
        const { data: cats } = catIds.length
          ? await sb.from('kb_categories').select('id, slug, section_num').in('id', catIds)
          : { data: [] as any[] };
        const catBySlug = new Map<string, any>();
        (cats ?? []).forEach((c: any) => catBySlug.set(c.id, c));

        const results = rows.map((r) => {
          const body = String(r.body_md ?? '').replace(/\s+/g, ' ').trim();
          const lower = q ? body.toLowerCase() : '';
          const hit = q ? lower.indexOf(q.toLowerCase()) : -1;
          const snippetStart = hit >= 0 ? Math.max(0, hit - 60) : 0;
          const snippetEnd = hit >= 0 ? Math.min(body.length, hit + q.length + 120) : Math.min(body.length, 200);
          const snippet = body.slice(snippetStart, snippetEnd) + (snippetEnd < body.length ? '…' : '');
          const cat = catBySlug.get(r.category_id);
          return {
            id: r.id,
            slug: r.slug,
            title: r.title,
            entry_type: r.entry_type,
            category_slug: cat?.slug ?? null,
            section_num: cat?.section_num ?? null,
            snippet,
            tags: r.tags ?? [],
            needs_enrichment: !!r.needs_enrichment,
            updated_at: r.updated_at,
          };
        });
        return JSON.stringify({ count: results.length, results });
      }

      case 'get_kb_entry': {
        if (!input.slug) return JSON.stringify({ error: 'slug required' });
        const { data, error } = await sb.from('kb_entries')
          .select('id, slug, title, entry_type, category_id, body_md, structured_data, tags, supplier_ids, product_refs, price_item_refs, needs_enrichment, enrichment_notes, current_version, status, updated_at')
          .eq('slug', input.slug)
          .maybeSingle();
        if (error) return JSON.stringify({ error: error.message });
        if (!data) return JSON.stringify({ error: 'not_found' });

        const [catRes, supRes] = await Promise.all([
          sb.from('kb_categories').select('slug, name, section_num').eq('id', data.category_id).maybeSingle(),
          data.supplier_ids?.length
            ? sb.from('kb_suppliers').select('slug, name').in('id', data.supplier_ids)
            : Promise.resolve({ data: [] as any[] }),
        ]);

        return JSON.stringify({
          slug: data.slug,
          title: data.title,
          entry_type: data.entry_type,
          category: catRes.data ?? null,
          body_md: data.body_md,
          structured_data: data.structured_data,
          tags: data.tags,
          suppliers: (supRes.data ?? []).map((s: any) => ({ slug: s.slug, name: s.name })),
          product_refs: data.product_refs,
          price_item_refs: data.price_item_refs,
          needs_enrichment: data.needs_enrichment,
          enrichment_notes: data.enrichment_notes,
          version: data.current_version,
          updated_at: data.updated_at,
        });
      }

      case 'search_wiki': {
        const q = String(input.query ?? '').trim();
        const limit = Math.min(Math.max(Number(input.limit ?? 6), 1), 20);
        let builder = sb.from('wiki_articles')
          .select('id, slug, title, summary, category_id, body_md, tags, reading_time_min, updated_at')
          .neq('status', 'archived')
          .limit(limit);
        if (input.category) {
          const { data: catRow } = await sb.from('wiki_categories')
            .select('id').eq('slug', input.category).maybeSingle();
          if (catRow) builder = builder.eq('category_id', catRow.id);
        }
        let rows: any[] = [];
        if (q) {
          const fts = await builder.textSearch('search_tsv', q, { type: 'websearch', config: 'spanish' });
          if (!fts.error && fts.data && fts.data.length > 0) rows = fts.data;
          if (rows.length === 0) {
            const fb = await sb.from('wiki_articles')
              .select('id, slug, title, summary, category_id, body_md, tags, reading_time_min, updated_at')
              .neq('status', 'archived')
              .or(`title.ilike.%${q}%,slug.ilike.%${q}%,summary.ilike.%${q}%`)
              .limit(limit);
            if (!fb.error && fb.data) rows = fb.data;
          }
        } else {
          const { data } = await builder.order('updated_at', { ascending: false });
          rows = data ?? [];
        }
        const catIds = [...new Set(rows.map((r) => r.category_id).filter(Boolean))];
        const { data: cats } = catIds.length
          ? await sb.from('wiki_categories').select('id, slug, name').in('id', catIds)
          : { data: [] as any[] };
        const catById = new Map<string, any>();
        (cats ?? []).forEach((c: any) => catById.set(c.id, c));
        const results = rows.map((r) => {
          const body = String(r.body_md ?? '').replace(/\s+/g, ' ').trim();
          const lower = q ? body.toLowerCase() : '';
          const hit = q ? lower.indexOf(q.toLowerCase()) : -1;
          const start = hit >= 0 ? Math.max(0, hit - 60) : 0;
          const end   = hit >= 0 ? Math.min(body.length, hit + q.length + 140) : Math.min(body.length, 220);
          const snippet = body.slice(start, end) + (end < body.length ? '…' : '');
          const cat = catById.get(r.category_id);
          return {
            slug: r.slug,
            title: r.title,
            summary: r.summary,
            category_slug: cat?.slug ?? null,
            category_name: cat?.name ?? null,
            snippet,
            tags: r.tags ?? [],
            reading_time_min: r.reading_time_min,
            updated_at: r.updated_at,
          };
        });
        return JSON.stringify({ count: results.length, results });
      }

      case 'get_wiki_article': {
        if (!input.slug) return JSON.stringify({ error: 'slug required' });
        const { data, error } = await sb.from('wiki_articles')
          .select('id, slug, title, summary, category_id, body_md, tags, reading_time_min, current_version, status, updated_at')
          .eq('slug', input.slug)
          .maybeSingle();
        if (error) return JSON.stringify({ error: error.message });
        if (!data) return JSON.stringify({ error: 'not_found' });
        const { data: catRow } = await sb.from('wiki_categories')
          .select('slug, name').eq('id', data.category_id).maybeSingle();
        return JSON.stringify({
          slug: data.slug,
          title: data.title,
          summary: data.summary,
          category: catRow ?? null,
          body_md: data.body_md,
          tags: data.tags,
          reading_time_min: data.reading_time_min,
          version: data.current_version,
          updated_at: data.updated_at,
        });
      }

      case 'search_suppliers_kb': {
        const q = String(input.query ?? '').trim();
        const limit = Math.min(Math.max(Number(input.limit ?? 5), 1), 20);
        let rows: any[] = [];
        if (q) {
          const fts = await sb.from('kb_suppliers')
            .select('id, slug, name, categories, notes_md, is_active')
            .eq('is_active', true)
            .textSearch('search_tsv', q, { type: 'websearch', config: 'spanish' })
            .limit(limit);
          if (!fts.error && fts.data && fts.data.length > 0) rows = fts.data;
          if (rows.length === 0) {
            const fallback = await sb.from('kb_suppliers')
              .select('id, slug, name, categories, notes_md, is_active')
              .eq('is_active', true)
              .or(`name.ilike.%${q}%,categories.cs.{${q}}`)
              .limit(limit);
            if (!fallback.error && fallback.data) rows = fallback.data;
          }
        } else {
          const { data } = await sb.from('kb_suppliers')
            .select('id, slug, name, categories, notes_md, is_active')
            .eq('is_active', true)
            .limit(limit);
          rows = data ?? [];
        }
        const results = rows.map((s) => ({
          slug: s.slug,
          name: s.name,
          categories: s.categories ?? [],
          notes_excerpt: String(s.notes_md ?? '').replace(/\s+/g, ' ').slice(0, 240),
        }));
        return JSON.stringify({ count: results.length, results });
      }

      case 'get_project_management': {
        if (!projectId) return JSON.stringify({ error: 'No project open.' });
        const { data: q } = await sb.from('quotations').select('project_id').eq('id', projectId).single();
        const pid = q?.project_id ?? projectId;
        const [tasksRes, docsRes, logsRes] = await Promise.all([
          sb.from('project_tasks').select('id, title, details, due_date, status, assignee_id').eq('project_id', pid).order('display_order').limit(20),
          sb.from('project_documents').select('id, label, url').eq('project_id', pid).order('display_order').limit(20),
          sb.from('project_logs').select('id, comment, created_at').eq('project_id', pid).order('created_at', { ascending: false }).limit(10),
        ]);
        let teamMap: Record<string,string> = {};
        const assigneeIds = [...new Set((tasksRes.data ?? []).map((t:any) => t.assignee_id).filter(Boolean))];
        if (assigneeIds.length) {
          const { data: members } = await sb.from('team_members').select('id, name').in('id', assigneeIds);
          members?.forEach((m:any) => { teamMap[m.id] = m.name; });
        }
        return JSON.stringify({
          tasks: (tasksRes.data ?? []).map((t:any) => ({ ...t, assignee_name: teamMap[t.assignee_id] ?? null })),
          documents: docsRes.data ?? [],
          recent_logs: logsRes.data ?? [],
        });
      }

      // ─── Inventory / suppliers ──────────────────────────────────────────
      case 'get_inventory_stock': {
        let q = sb.from('price_list')
          .select('id, concept_description, type, unit, price, stock_quantity, min_stock_level, stock_location, average_cost, last_purchase_cost, price_list_suppliers(supplier_price, is_primary, suppliers(name))')
          .eq('is_active', true)
          .limit(10);
        if (input.item_id) {
          q = q.eq('id', input.item_id);
        } else if (input.query) {
          q = q.ilike('concept_description', `%${input.query}%`);
        }
        const { data, error } = await q;
        if (error) return JSON.stringify({ error: error.message });
        let rows = (data ?? []) as any[];
        if (input.only_below_min) {
          rows = rows.filter((r: any) =>
            Number(r.min_stock_level) > 0 && Number(r.stock_quantity) < Number(r.min_stock_level)
          );
        }
        return JSON.stringify({
          count: rows.length,
          results: rows.map((r: any) => {
            const primary = (r.price_list_suppliers ?? []).find((ps: any) => ps.is_primary);
            return {
              id: r.id,
              concept: r.concept_description,
              type: r.type,
              unit: r.unit,
              price: r.price,
              stock_quantity: r.stock_quantity,
              min_stock_level: r.min_stock_level,
              stock_location: r.stock_location,
              average_cost_wac: r.average_cost,
              last_purchase_cost: r.last_purchase_cost,
              primary_supplier: primary?.suppliers?.name ?? null,
              primary_supplier_price: primary?.supplier_price ?? null,
              below_min: Number(r.min_stock_level) > 0 && Number(r.stock_quantity) < Number(r.min_stock_level),
            };
          })
        });
      }

      case 'get_low_stock_items': {
        let q = sb.from('price_list')
          .select('id, concept_description, type, unit, stock_quantity, min_stock_level, stock_location, last_purchase_cost')
          .eq('is_active', true)
          .gt('min_stock_level', 0)
          .limit(25);
        if (input.type) q = q.eq('type', input.type);
        const { data, error } = await q;
        if (error) return JSON.stringify({ error: error.message });
        const low = (data ?? []).filter((r: any) => Number(r.stock_quantity) < Number(r.min_stock_level));
        return JSON.stringify({
          count: low.length,
          results: low.map((r: any) => ({
            id: r.id,
            concept: r.concept_description,
            type: r.type,
            unit: r.unit,
            stock_quantity: r.stock_quantity,
            min_stock_level: r.min_stock_level,
            missing: Number(r.min_stock_level) - Number(r.stock_quantity),
            stock_location: r.stock_location,
            last_purchase_cost: r.last_purchase_cost,
          }))
        });
      }

      case 'get_inventory_movements': {
        const limit = Math.min(Number(input.limit) || 20, 100);
        let q = sb.from('inventory_movements')
          .select('id, price_list_item_id, movement_type, quantity, reference_type, reference_id, unit_cost, running_average_cost, notes, created_at, price_list:price_list(concept_description, unit)')
          .order('created_at', { ascending: false })
          .limit(limit);
        if (input.item_id)       q = q.eq('price_list_item_id', input.item_id);
        if (input.movement_type) q = q.eq('movement_type', input.movement_type);
        if (input.project_id) {
          // project_id filter: match purchase item rows belonging to that project.
          const { data: items } = await sb.from('project_purchase_items')
            .select('id').eq('project_id', input.project_id);
          const ids = (items ?? []).map((i: any) => i.id);
          if (ids.length === 0) return JSON.stringify({ count: 0, results: [] });
          q = q.in('reference_id', ids);
        }
        const { data, error } = await q;
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify({
          count: data?.length ?? 0,
          results: (data ?? []).map((m: any) => ({
            id: m.id,
            item: m.price_list?.concept_description ?? m.price_list_item_id,
            unit: m.price_list?.unit,
            type: m.movement_type,
            qty: m.quantity,
            unit_cost: m.unit_cost,
            running_wac: m.running_average_cost,
            ref_type: m.reference_type,
            ref_id: m.reference_id,
            notes: m.notes,
            created_at: m.created_at,
          }))
        });
      }

      case 'search_suppliers': {
        const { data, error } = await sb.from('suppliers')
          .select('id, name, contact_name, phone, email, website, payment_terms, lead_time_days, is_active')
          .eq('is_active', true)
          .or(`name.ilike.%${input.query}%,contact_name.ilike.%${input.query}%,email.ilike.%${input.query}%`)
          .limit(10);
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify({ count: data?.length ?? 0, results: data ?? [] });
      }

      // ─── Purchase items (project-scoped) ────────────────────────────────
      case 'get_purchase_items': {
        if (!projectId) return JSON.stringify({ error: 'No quotation open. Open a quotation or project first.' });
        // Resolve business project id from the open quotation.
        const { data: q } = await sb.from('quotations').select('project_id').eq('id', projectId).single();
        const pid = q?.project_id ?? projectId;
        let query = sb.from('project_purchase_items')
          .select('id, concept, quantity, unit, price, subtotal, priority, status, deadline, notes, supplier:suppliers(name), assigned_member:team_members!assigned_to_member_id(name), price_list_item:price_list(concept_description)')
          .eq('project_id', pid)
          .order('display_order')
          .limit(50);
        if (input.status)   query = query.eq('status', input.status);
        if (input.priority) query = query.eq('priority', input.priority);
        const { data, error } = await query;
        if (error) return JSON.stringify({ error: error.message });
        let rows = (data ?? []) as any[];
        if (input.supplier_query) {
          const term = String(input.supplier_query).toLowerCase();
          rows = rows.filter((r: any) => r.supplier?.name?.toLowerCase()?.includes(term));
        }
        // Rollup counts by status and priority.
        const byStatus: Record<string, number> = {};
        const byPriority: Record<string, number> = {};
        for (const r of rows) {
          byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
          byPriority[r.priority] = (byPriority[r.priority] ?? 0) + 1;
        }
        return JSON.stringify({
          project_id: pid,
          count: rows.length,
          by_status: byStatus,
          by_priority: byPriority,
          items: rows.map((r: any) => ({
            id: r.id,
            concept: r.concept,
            qty: r.quantity,
            unit: r.unit,
            price: r.price,
            subtotal: r.subtotal,
            status: r.status,
            priority: r.priority,
            deadline: r.deadline,
            supplier: r.supplier?.name ?? null,
            assigned_to: r.assigned_member?.name ?? null,
            linked_item: r.price_list_item?.concept_description ?? null,
          }))
        });
      }

      case 'update_purchase_item_status': {
        if (!input.purchase_item_id || !input.new_status) {
          return JSON.stringify({ error: 'purchase_item_id and new_status are required.' });
        }
        const { data, error } = await sb.from('project_purchase_items')
          .update({ status: input.new_status })
          .eq('id', input.purchase_item_id)
          .select('id, concept, status, price_list_item_id')
          .single();
        if (error) return JSON.stringify({ error: error.message });
        const triggerNote = input.new_status === 'In Warehouse'
          ? ' DB trigger created an IN inventory movement (stock updated, WAC recalculated).'
          : input.new_status === 'Return'
            ? ' DB trigger created a RETURN inventory movement.'
            : '';
        return JSON.stringify({
          success: true,
          message: `Purchase item "${data?.concept}" status updated to "${input.new_status}".${triggerNote}`,
          item: data,
        });
      }

      // ─── Optimizer runs ─────────────────────────────────────────────────
      case 'get_optimizer_runs': {
        if (!projectId) return JSON.stringify({ error: 'No quotation open.' });
        const [runsRes, qRes] = await Promise.all([
          sb.from('quotation_optimizer_runs')
            .select('id, name, is_active, is_stale, total_cost, material_cost, edgeband_cost, waste_pct, board_count, total_piece_m2, cost_per_m2, notes, created_at')
            .eq('quotation_id', projectId)
            .order('created_at', { ascending: false }),
          sb.from('quotations')
            .select('pricing_method, active_optimizer_run_id, optimizer_total_amount, optimizer_is_stale, total_amount')
            .eq('id', projectId).single(),
        ]);
        if (runsRes.error) return JSON.stringify({ error: runsRes.error.message });
        return JSON.stringify({
          quotation_id: projectId,
          pricing_method: qRes.data?.pricing_method ?? 'sqft',
          optimizer_total_amount: qRes.data?.optimizer_total_amount ?? null,
          optimizer_is_stale: qRes.data?.optimizer_is_stale ?? false,
          active_run_id: qRes.data?.active_optimizer_run_id ?? null,
          quotation_total_amount: qRes.data?.total_amount ?? null,
          run_count: runsRes.data?.length ?? 0,
          runs: (runsRes.data ?? []).map((r: any) => ({
            id: r.id,
            name: r.name,
            is_active: r.is_active,
            is_stale: r.is_stale,
            total_cost: r.total_cost,
            material_cost: r.material_cost,
            edgeband_cost: r.edgeband_cost,
            waste_pct: r.waste_pct,
            board_count: r.board_count,
            total_piece_m2: r.total_piece_m2,
            cost_per_m2: r.cost_per_m2,
            notes: r.notes,
            created_at: r.created_at,
          }))
        });
      }

      case 'set_active_optimizer_run': {
        if (!projectId) return JSON.stringify({ error: 'No quotation open.' });
        if (!input.run_id) return JSON.stringify({ error: 'run_id is required.' });
        // Fetch the target run (must belong to the open quotation)
        const { data: target, error: tErr } = await sb.from('quotation_optimizer_runs')
          .select('id, quotation_id, name, total_cost, is_stale')
          .eq('id', input.run_id).single();
        if (tErr || !target) return JSON.stringify({ error: tErr?.message ?? 'Run not found.' });
        if (target.quotation_id !== projectId) {
          return JSON.stringify({ error: 'That run belongs to a different quotation.' });
        }
        // Clear siblings, then set target active (unique partial index enforces single active).
        const { error: clearErr } = await sb.from('quotation_optimizer_runs')
          .update({ is_active: false })
          .eq('quotation_id', projectId)
          .neq('id', input.run_id);
        if (clearErr) return JSON.stringify({ error: clearErr.message });
        const { error: actErr } = await sb.from('quotation_optimizer_runs')
          .update({ is_active: true })
          .eq('id', input.run_id);
        if (actErr) return JSON.stringify({ error: actErr.message });
        // Reflect on quotations row.
        const { error: qErr } = await sb.from('quotations')
          .update({
            active_optimizer_run_id: input.run_id,
            optimizer_total_amount: target.total_cost,
            optimizer_is_stale: target.is_stale,
          })
          .eq('id', projectId);
        if (qErr) return JSON.stringify({ error: qErr.message });
        return JSON.stringify({
          success: true,
          message: `Active run set to "${target.name}". Optimizer total: $${Number(target.total_cost).toLocaleString('en-US', { maximumFractionDigits: 2 })} MXN. Refresh the Breakdown tab to see changes.`
        });
      }

      case 'set_pricing_method': {
        if (!projectId) return JSON.stringify({ error: 'No quotation open.' });
        const method = input.method;
        if (method !== 'sqft' && method !== 'optimizer') {
          return JSON.stringify({ error: 'method must be "sqft" or "optimizer".' });
        }
        // Load current quotation so we know the optimizer total.
        const { data: q, error: qErr } = await sb.from('quotations')
          .select('id, total_amount, optimizer_total_amount, active_optimizer_run_id')
          .eq('id', projectId).single();
        if (qErr || !q) return JSON.stringify({ error: qErr?.message ?? 'Quotation not found.' });
        if (method === 'optimizer' && !q.active_optimizer_run_id) {
          return JSON.stringify({ error: 'Cannot switch to optimizer: no active run. Save and activate a run first in the Breakdown tab.' });
        }
        const updatePayload: Record<string, any> = { pricing_method: method };
        if (method === 'optimizer' && q.optimizer_total_amount != null) {
          // Mirror to total_amount to match the rollup contract.
          updatePayload.total_amount = q.optimizer_total_amount;
        }
        const { error: uErr } = await sb.from('quotations').update(updatePayload).eq('id', projectId);
        if (uErr) return JSON.stringify({ error: uErr.message });
        return JSON.stringify({
          success: true,
          message: `Pricing method switched to "${method}".${method === 'optimizer' ? ' Quotation total now reflects the optimizer run.' : ' Quotation total now reflects the ft² calculation.'} Refresh to see the new total.`
        });
      }

      // ─── BOM ────────────────────────────────────────────────────────────
      case 'get_quotation_bom': {
        if (!projectId) return JSON.stringify({ error: 'No quotation open.' });
        // Compute a simplified BOM by reading cost fields directly from area_cabinets.
        // Hardware and accessories are aggregated from JSONB hardware and accessories columns.
        const { data: areas, error: aErr } = await sb.from('project_areas')
          .select('id, name').eq('project_id', projectId);
        if (aErr) return JSON.stringify({ error: aErr.message });
        const areaIds = (areas ?? []).map((a: any) => a.id);
        if (areaIds.length === 0) {
          return JSON.stringify({ count: 0, categories: {}, totals: { materials: 0, hardware: 0, accessories: 0, grand_total: 0 } });
        }
        const { data: cabs, error: cErr } = await sb.from('area_cabinets')
          .select('id, product_sku, quantity, hardware, accessories, box_material_id, box_material_cost, doors_material_id, doors_material_cost, box_edgeband_id, box_edgeband_cost, doors_edgeband_id, doors_edgeband_cost, back_panel_material_id, back_panel_material_cost, labor_cost')
          .in('area_id', areaIds);
        if (cErr) return JSON.stringify({ error: cErr.message });
        // Pre-load material names.
        const matIds = new Set<string>();
        for (const c of cabs ?? []) {
          if (c.box_material_id)        matIds.add(c.box_material_id);
          if (c.doors_material_id)      matIds.add(c.doors_material_id);
          if (c.box_edgeband_id)        matIds.add(c.box_edgeband_id);
          if (c.doors_edgeband_id)      matIds.add(c.doors_edgeband_id);
          if (c.back_panel_material_id) matIds.add(c.back_panel_material_id);
        }
        const matNames: Record<string, string> = {};
        if (matIds.size > 0) {
          const { data: mats } = await sb.from('price_list')
            .select('id, concept_description')
            .in('id', Array.from(matIds));
          mats?.forEach((m: any) => { matNames[m.id] = m.concept_description; });
        }
        type Row = { concept: string; qty: number; subtotal: number };
        const categories: Record<string, Row[]> = {
          'Box Construction': [],
          'Doors & Fronts': [],
          'Edgeband': [],
          'Hardware': [],
          'Accessories': [],
        };
        const acc = (cat: string, concept: string, qty: number, cost: number) => {
          if (!concept || cost <= 0) return;
          const existing = categories[cat].find((r: Row) => r.concept === concept);
          if (existing) {
            existing.qty += qty;
            existing.subtotal += cost * qty;
          } else {
            categories[cat].push({ concept, qty, subtotal: cost * qty });
          }
        };
        let totalMaterials = 0, totalHardware = 0, totalAccessories = 0;
        for (const c of cabs ?? []) {
          const qty = Number(c.quantity) || 1;
          // Box
          if (c.box_material_id && Number(c.box_material_cost) > 0) {
            acc('Box Construction', matNames[c.box_material_id] ?? c.box_material_id, qty, Number(c.box_material_cost));
            totalMaterials += Number(c.box_material_cost) * qty;
          }
          if (c.back_panel_material_id && Number(c.back_panel_material_cost) > 0) {
            acc('Box Construction', matNames[c.back_panel_material_id] ?? c.back_panel_material_id, qty, Number(c.back_panel_material_cost));
            totalMaterials += Number(c.back_panel_material_cost) * qty;
          }
          // Doors
          if (c.doors_material_id && Number(c.doors_material_cost) > 0) {
            acc('Doors & Fronts', matNames[c.doors_material_id] ?? c.doors_material_id, qty, Number(c.doors_material_cost));
            totalMaterials += Number(c.doors_material_cost) * qty;
          }
          // Edgeband
          if (c.box_edgeband_id && Number(c.box_edgeband_cost) > 0) {
            acc('Edgeband', matNames[c.box_edgeband_id] ?? c.box_edgeband_id, qty, Number(c.box_edgeband_cost));
            totalMaterials += Number(c.box_edgeband_cost) * qty;
          }
          if (c.doors_edgeband_id && Number(c.doors_edgeband_cost) > 0) {
            acc('Edgeband', matNames[c.doors_edgeband_id] ?? c.doors_edgeband_id, qty, Number(c.doors_edgeband_cost));
            totalMaterials += Number(c.doors_edgeband_cost) * qty;
          }
          // Hardware (JSONB)
          const hw = c.hardware as Record<string, any> | null;
          if (hw) {
            for (const [, hwData] of Object.entries(hw)) {
              if (!hwData || typeof hwData !== 'object') continue;
              const name = (hwData as any).name ?? 'Hardware';
              const hwQty = Number((hwData as any).qty ?? 0);
              const price = Number((hwData as any).price ?? 0);
              acc('Hardware', name, hwQty * qty, price);
              totalHardware += price * hwQty * qty;
            }
          }
          // Accessories (JSONB)
          const accs = c.accessories as Record<string, any> | null;
          if (accs) {
            for (const [, accData] of Object.entries(accs)) {
              if (!accData || typeof accData !== 'object') continue;
              const name = (accData as any).name ?? 'Accessory';
              const accQty = Number((accData as any).qty ?? 0);
              const price = Number((accData as any).price ?? 0);
              acc('Accessories', name, accQty * qty, price);
              totalAccessories += price * accQty * qty;
            }
          }
        }
        return JSON.stringify({
          quotation_id: projectId,
          area_count: areas?.length ?? 0,
          cabinet_line_count: cabs?.length ?? 0,
          categories,
          totals: {
            materials_mxn: Math.round(totalMaterials),
            hardware_mxn: Math.round(totalHardware),
            accessories_mxn: Math.round(totalAccessories),
            grand_total_mxn: Math.round(totalMaterials + totalHardware + totalAccessories),
          }
        });
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  } catch (err: any) {
    return JSON.stringify({ error: err.message });
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  // Auth: accept EITHER a valid Supabase user JWT (Authorization: Bearer …)
  // OR the legacy x-evita-key shared secret. This keeps the function working
  // during the transition while the frontend rolls out the JWT path.
  const authHeader = req.headers.get('Authorization') ?? req.headers.get('authorization') ?? '';
  const jwt = authHeader.toLowerCase().startsWith('bearer ')
    ? authHeader.slice(7).trim()
    : '';
  const legacyKey = req.headers.get('x-evita-key') ?? '';

  let authOk = false;
  if (legacyKey && EVITA_SECRET && legacyKey === EVITA_SECRET) {
    authOk = true;
  } else if (jwt) {
    try {
      const authClient = createClient(SB_URL, SB_ANON || SB_SERVICE, {
        global: { headers: { Authorization: `Bearer ${jwt}` } },
      });
      const { data, error } = await authClient.auth.getUser(jwt);
      if (!error && data?.user) authOk = true;
    } catch { /* fall through */ }
  }

  if (!authOk) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS });
  }
  let body: any;
  try { body = await req.json(); }
  catch { return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: CORS }); }

  const { messages = [], projectId = null, pageKey = 'dashboard' } = body;
  const sb = createClient(SB_URL, SB_SERVICE);

  const [settingsRes, recentRes, matPricesRes, lowStockRes] = await Promise.all([
    sb.from('settings').select('key, value'),
    sb.from('quotations').select('id, project_id, name, customer, status, total_amount').order('updated_at', { ascending: false }).limit(5),
    sb.from('price_list').select('id, unit_price_mxn').or('id.like.f4953b9f%,id.like.d0eb99a2%,id.like.6d877ed9%,id.like.e3e9c098%'),
    // Low stock: items active, with min > 0 AND stock < min. Fetched client-side because
    // PostgREST does not support column-vs-column filters directly.
    sb.from('price_list').select('id, concept_description, stock_quantity, min_stock_level')
      .eq('is_active', true).gt('min_stock_level', 0),
  ]);

  const sData = settingsRes.data ?? [];
  const get = (k: string) => sData.find((x: any) => x.key === k)?.value ?? '0';
  const wBox  = 1 + Number(get('waste_percentage_box'))  / 100;
  const wDoor = 1 + Number(get('waste_percentage_doors')) / 100;
  const lBase = Number(get('labor_cost_no_drawers'));
  const lDraw = Number(get('labor_cost_with_drawers'));
  const fx    = Number(get('exchange_rate_usd_to_mxn'));

  const matPrices = matPricesRes.data ?? [];
  const priceOf = (prefix: string) =>
    Number(matPrices.find((m: any) => m.id.startsWith(prefix))?.unit_price_mxn) || 0;
  const pBoxMat  = priceOf('f4953b9f');
  const pDoorMat = priceOf('d0eb99a2');
  const pBoxEB   = priceOf('6d877ed9');
  const pDoorEB  = priceOf('e3e9c098');

  let liveData = `Exchange rate: ${fx} MXN/USD | Waste box: x${wBox} | Waste doors: x${wDoor} | Labor base: $${lBase} | Labor drawers: $${lDraw}`;
  if (recentRes.data?.length) {
    liveData += '\nRecent quotations: ' + recentRes.data.map((p: any) =>
      `${p.name} [project_id:${p.project_id}] [quotation_id:${p.id}] (${p.status}) $${Number(p.total_amount).toLocaleString()} MXN`
    ).join(' | ');
  }

  // Low stock alert — always emitted (cheap, helps Evita proactively mention it).
  const lowStockItems = (lowStockRes.data ?? []).filter((r: any) =>
    Number(r.stock_quantity) < Number(r.min_stock_level)
  );
  if (lowStockItems.length > 0) {
    liveData += `\nLow stock alerts: ${lowStockItems.length} item(s) below min level (use get_low_stock_items for details)`;
  }

  let proj: any = null;
  if (projectId) {
    const { data: projData } = await sb.from('quotations')
      .select('name, status, total_amount, profit_multiplier, tax_percentage, tariff_multiplier, install_delivery, install_delivery_usd, install_delivery_per_box_usd, referral_currency_rate, project_id, pricing_method, active_optimizer_run_id, optimizer_total_amount, optimizer_is_stale')
      .eq('id', projectId).single();
    proj = projData;
    if (proj) {
      const { data: areas } = await sb.from('project_areas')
        .select('id, name, subtotal, applies_tariff').eq('project_id', projectId).order('display_order');

      const areaIds = (areas ?? []).map((a: any) => a.id);
      let costBreakdown = { box_mat: 0, door_mat: 0, box_eb: 0, door_eb: 0, labor: 0, hardware: 0, accessories: 0, back_panel: 0, door_profile: 0 };
      if (areaIds.length) {
        const { data: cabCosts } = await sb.from('area_cabinets')
          .select('box_material_cost, box_edgeband_cost, doors_material_cost, doors_edgeband_cost, labor_cost, hardware_cost, accessories_cost, back_panel_material_cost, door_profile_cost, quantity')
          .in('area_id', areaIds);
        if (cabCosts) {
          for (const c of cabCosts) {
            const qty = Number(c.quantity) || 1;
            costBreakdown.box_mat    += (Number(c.box_material_cost)        || 0) * qty;
            costBreakdown.door_mat   += (Number(c.doors_material_cost)      || 0) * qty;
            costBreakdown.box_eb     += (Number(c.box_edgeband_cost)        || 0) * qty;
            costBreakdown.door_eb    += (Number(c.doors_edgeband_cost)      || 0) * qty;
            costBreakdown.labor      += (Number(c.labor_cost)               || 0) * qty;
            costBreakdown.hardware   += (Number(c.hardware_cost)            || 0) * qty;
            costBreakdown.accessories+= (Number(c.accessories_cost)         || 0) * qty;
            costBreakdown.back_panel += (Number(c.back_panel_material_cost) || 0) * qty;
            costBreakdown.door_profile += (Number(c.door_profile_cost)      || 0) * qty;
          }
        }
      }

      const fmt = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
      const totalMaterials = costBreakdown.box_mat + costBreakdown.door_mat + costBreakdown.box_eb + costBreakdown.door_eb + costBreakdown.accessories + costBreakdown.back_panel + costBreakdown.door_profile;
      const totalCabSubtotal = totalMaterials + costBreakdown.labor + costBreakdown.hardware;

      liveData += `\nOpen quotation: ${proj.name} [project_id:${proj.project_id}] [quotation_id:${projectId}] | ${proj.status} | $${Number(proj.total_amount).toLocaleString()} MXN`;
      liveData += ` | Profit: ${((proj.profit_multiplier??0)*100).toFixed(1)}% | Tax: ${proj.tax_percentage??0}% | Tariff: ${((proj.tariff_multiplier??0)*100).toFixed(1)}%`;
      if (proj.install_delivery_usd) liveData += ` | Install: $${proj.install_delivery_usd} USD`;
      liveData += ` | Referral: ${((proj.referral_currency_rate??0)*100).toFixed(0)}%`;
      if (areas?.length) liveData += '\nAreas: ' + areas.map((a:any) =>
        `${a.name} (subtotal: $${Number(a.subtotal).toLocaleString()} MXN${a.applies_tariff ? ' +tariff' : ''})`
      ).join(' | ');

      liveData += `\nCOST BREAKDOWN (sum of all cabinet lines, before profit/tariff/tax):`;
      liveData += `\n  Box material: ${fmt(costBreakdown.box_mat)} | Door material: ${fmt(costBreakdown.door_mat)}`;
      liveData += `\n  Box edgeband: ${fmt(costBreakdown.box_eb)} | Door edgeband: ${fmt(costBreakdown.door_eb)}`;
      liveData += `\n  Labor: ${fmt(costBreakdown.labor)} | Hardware: ${fmt(costBreakdown.hardware)}`;
      if (costBreakdown.accessories > 0) liveData += ` | Accessories: ${fmt(costBreakdown.accessories)}`;
      if (costBreakdown.back_panel > 0) liveData += ` | Back panel: ${fmt(costBreakdown.back_panel)}`;
      if (costBreakdown.door_profile > 0) liveData += ` | Door profile: ${fmt(costBreakdown.door_profile)}`;
      liveData += `\n  MATERIALS ONLY (no labor/hardware): ${fmt(totalMaterials)} MXN`;
      liveData += `\n  CABINET SUBTOTAL (mat+labor+hardware): ${fmt(totalCabSubtotal)} MXN`;
      liveData += `\n  NOTE: "area subtotal" in project = cabinet subtotal = raw cost BEFORE profit. area.subtotal is NOT price.`;

      // Pricing method + optimizer runs summary.
      const pmethod = proj.pricing_method ?? 'sqft';
      const { data: runsAgg } = await sb.from('quotation_optimizer_runs')
        .select('id, name, is_active, is_stale').eq('quotation_id', projectId);
      const runCount = runsAgg?.length ?? 0;
      const activeRun = (runsAgg ?? []).find((r: any) => r.is_active) ?? null;
      liveData += `\nPricing method: ${pmethod} | Optimizer runs: ${runCount} saved`;
      if (pmethod === 'optimizer' || activeRun) {
        const optTotal = proj.optimizer_total_amount != null ? fmt(Number(proj.optimizer_total_amount)) : 'n/a';
        const stale = proj.optimizer_is_stale || activeRun?.is_stale;
        liveData += ` | Optimizer total: ${optTotal} MXN | active_run=${activeRun?.name ?? 'none'} | stale=${stale ? 'yes' : 'no'}`;
      }

      // Purchase items rollup for the business project that owns this quotation.
      if (proj.project_id) {
        const { data: pItems } = await sb.from('project_purchase_items')
          .select('id, concept, status, priority, subtotal').eq('project_id', proj.project_id);
        if (pItems && pItems.length > 0) {
          const byStatus: Record<string, number> = {};
          const byPriority: Record<string, number> = {};
          for (const it of pItems) {
            byStatus[it.status] = (byStatus[it.status] ?? 0) + 1;
            byPriority[it.priority] = (byPriority[it.priority] ?? 0) + 1;
          }
          const statusSummary = Object.entries(byStatus).map(([k,v]) => `${k}: ${v}`).join(' | ');
          liveData += `\nPurchase items: ${pItems.length} total | ${statusSummary}`;
          // Highlight pending attention.
          const openStatuses = new Set(['Ordered','Paid','In Transit','Delay','Pending']);
          const openItems = pItems.filter((it: any) => openStatuses.has(it.status));
          if (openItems.length > 0) {
            const priorityRank: Record<string, number> = { Urgent: 0, High: 1, Medium: 2, Low: 3 };
            openItems.sort((a: any, b: any) => (priorityRank[a.priority] ?? 9) - (priorityRank[b.priority] ?? 9));
            const top3 = openItems.slice(0, 3).map((it: any) => `${it.concept} (${it.priority}/${it.status})`).join(', ');
            liveData += `\nOpen purchase items (needs attention): ${openItems.length} — top: ${top3}`;
          }
        }
      }
    }
  }

  let skuContext = '';
  const candidateSkus = extractSkus(messages);
  if (candidateSkus.length > 0) {
    const { data: products } = await sb.from('products_catalog')
      .select('sku, description, box_sf, doors_fronts_sf, box_edgeband, box_edgeband_color, doors_fronts_edgeband, has_drawers, boxes_per_unit')
      .in('sku', candidateSkus).eq('is_active', true);
    if (products?.length) {
      skuContext = '\n\n=== REAL SKU DATA FROM DATABASE - USE ONLY THESE VALUES ===\n';
      for (const p of products) {
        const bsf=Number(p.box_sf), dsf=Number(p.doors_fronts_sf);
        const beb=Number(p.box_edgeband), bebc=Number(p.box_edgeband_color), deb=Number(p.doors_fronts_edgeband);
        const labor = p.has_drawers ? lDraw : lBase;
        const boxMat  = Math.round((bsf*wBox/32)*pBoxMat*100)/100;
        const doorMat = Math.round((dsf*wDoor/32)*pDoorMat*100)/100;
        const boxEB   = Math.round((beb+bebc)*pBoxEB*100)/100;
        const doorEB  = Math.round(deb*pDoorEB*100)/100;
        const baseUnit = boxMat+doorMat+boxEB+doorEB+labor;
        skuContext += `\n${p.sku} | ${p.description} | drawers=${p.has_drawers}\n`;
        skuContext += `  box_sf=${bsf} | doors_sf=${dsf} | box_eb=${beb}m+${bebc}m | door_eb=${deb}m\n`;
        skuContext += `  Per unit: box=$${boxMat} | door=$${doorMat} | box_eb=$${boxEB} | door_eb=$${doorEB} | labor=$${labor}\n`;
        skuContext += `  BASE UNIT (before hardware): $${baseUnit} MXN | Blum=$130/pair | Stetik=$626.63/set\n`;
        skuContext += `  BOX COUNT: 1 unit = ${p.boxes_per_unit ?? 1} box(es). Total boxes for this line = qty x ${p.boxes_per_unit ?? 1}.\n`;
      }
      const found = new Set(products.map((p:any) => p.sku));
      const missing = candidateSkus.filter(s => !found.has(s));
      if (missing.length) skuContext += `\nNOT FOUND: ${missing.join(', ')}\n`;
    }
  }

  const modMode = hasModificationIntent(messages);
  const referralRate = proj?.referral_currency_rate ?? 0;

  const system = `You are Evita AI, quotation assistant for Evita Cabinets (Houston TX).

=== DATA MODEL ===
"Project" = business-level parent entity (name, customer, address).
"Quotation" = pricing version within a project (areas, cabinets, costs, totals).
A project has multiple quotations (e.g., "Plus", "Premium", "v2", "v3").
The projectId you receive is a QUOTATION ID. project_areas and area_cabinets belong to quotations.
When the user says "project" they usually mean the quotation they are currently viewing.

Quotations now carry a pricing_method ('sqft' default or 'optimizer'). When 'optimizer',
total_amount is mirrored from the active quotation_optimizer_runs row (optimizer_total_amount).
LIVE DATA tells you the current method, total, active run name, and stale flag.

Purchases, Inventory stock, Suppliers, and inventory movements are PROJECT-LEVEL (not quotation-level):
they key off projects.id, not the projectId you receive (which is a quotation id). To reach them
you must resolve the business project via quotations.project_id. The get_purchase_items tool does
this for you automatically.

=== CAPABILITIES ===
- Quick estimates (ft²) with full USD pricing breakdown
- Price, material, and stock lookups (search_materials for prices; get_inventory_stock for stock/WAC/location)
- Inventory queries: low-stock alerts, movement ledger, supplier lookup
- Purchase tracking: list items by status/priority, mark arrivals (triggers auto-inventory movements)
- Optimizer run review: KPIs, compare versions, set active run, toggle pricing method (sqft ↔ optimizer)
- Quotation BOM (bill of materials) by category — Box / Doors / Edgeband / Hardware / Accessories
- Quotation modifications (materials, quantities, quotation-level settings, hardware bulk updates)
- Project management: tasks, documents, logs (get_project_management)

=== MATERIAL COST FORMULA — CRITICAL ===
NEVER guess SF values. Use ONLY values from the database section.
Per unit (then x qty):
  box_mat    = (box_sf x waste_box / 32) x ${pBoxMat}
  door_mat   = (doors_fronts_sf x waste_door / 32) x ${pDoorMat}
  box_eb     = (box_edgeband_m + box_edgeband_color_m) x ${pBoxEB}
  door_eb    = doors_fronts_edgeband_m x ${pDoorEB}
  labor      = 400 (no drawers) | 600 (with drawers)
  hardware   = hinge_PAIRS x 130 + slide_SETS x 626.63
  subtotal   = (all above) x qty
  HINGE RULE: qty given is always PAIRS. 4 bisagras = 4 pairs = $520. Never divide by 2.

NOT APPLY IDs: mat=b7e31784 | eb=2ddf271c
- Series 460: box=Not Apply, box_eb=Not Apply
- Closets no doors (CAS,CSS,DH,H,HPO,HPT): doors=Not Apply, doors_eb=Not Apply
- Series 454: HAS box material (not 460 rule)

Default IDs: box=f4953b9f | door=d0eb99a2 | box_eb=6d877ed9 | door_eb=e3e9c098

=== SKU NAMING CONVENTION — USE TO INFER SKUs FROM DESCRIPTIONS ===
When a user describes a cabinet without a SKU, use this convention
to infer the likely SKU, then ALWAYS confirm with search_catalog
before calculating.

KITCHEN/BATH SERIES (products_catalog):
  1xx = Base cabinets (no drawers)
    101 = 1 door | 102 = 2 doors | 152 = sink base | 126 = blind corner
  2xx = Base cabinets with drawers
    211 = 1 drawer + 1 door | 212 = 1 drawer + 2 doors
    221 = 2 drawers + 1 door | 222 = 2 drawers + 2 doors
    230 = 3 drawers (no doors)
  3xx = Wall hung cabinets
    301 = 1 door | 302 = 2 doors | 326 = blind corner wall
  4xx = Tall/pantry/oven
    400 = open shelf tall | 424 = pantry tall | 454 = double oven
    460 = filler/panel (series 460 — NO box material)
  TPO = tall pull-out | KSC = knee space cabinet

CLOSET SERIES (also in products_catalog):
  CAS = open shelf (no doors) | CSS = sliding doors
  DH  = double hang | H = hang rod only
  HPO = hang + open | HPT = hang + top shelf
  CDB = dresser/drawers | DB  = open dresser

DIMENSIONS in SKU: WIDTH x HEIGHT x DEPTH (inches)
  Examples: 102-36"x30"x24" = 36" wide, 30" high, 24" deep
            CAS3051 = 30" wide, 51" high (standard depth)
  Standard depths: kitchen base=24", wall=12", tall=24"
  Standard heights: base=30", wall=12-42", tall=84-96"

INFERENCE WORKFLOW:
1. User says "base cabinet, 2 doors, 36 wide"
   → infer SKU candidate: 102-36"x30"x24"
   → call search_catalog with "base 2 door" to confirm
2. User says "wall cabinet 30 wide with 2 doors"
   → infer: 302-30"x30"x12"
   → call search_catalog with "wall hung 2 door" to confirm
3. User says "3-drawer base, 24 inches"
   → infer: 230-24x30x24
   → call search_catalog with "3 drawers" to confirm
4. ALWAYS show the matched SKU and ask user to confirm before calculating:
   "Encontré: 102-36\"x30\"x24\" — Base Cabinet 2 Door. ¿Es correcto?"

=== PRICING FORMULA — EXACT ORDER ===
  1. materials = sum of all cabinet subtotals (all areas)
  2. profit    = materials x 0.50
  3. price     = materials + profit
  4. tariff    = SUM(subtotals of kitchen areas only) x 0.25
  5. install   = total_boxes x 150 x fx
     TOTAL BOXES = SUM of (cabinet_qty x boxes_per_unit) for EVERY line across ALL areas
     EXAMPLE: CAS3051 qty=2, boxes_per_unit=2 → contributes 4 boxes (NOT 2)
  6. referral  = (price + install) x referral_rate
  7. tax       = (price + tariff + referral) x 0.0825
     TAX BASE IS: price + tariff + referral ONLY
     Install is NOT included in tax base
  8. TOTAL MXN = price + tariff + install + referral + tax
  9. TOTAL USD = TOTAL MXN / fx

WORKED EXAMPLE (verify your math matches this):
  102 x2 (bpu=1) + 222 x1 (bpu=1) + 302 x3 (bpu=1) + CAS3051 x2 (bpu=2)
  total_boxes = 2 + 1 + 3 + 4 = 10 boxes
  materials=$17,619 | profit=$8,810 | price=$26,429
  tariff=kitchen_only($14,957) x 0.25 = $3,739
  install = 10 x $150 x 17 = $25,500
  tax = ($26,429 + $3,739) x 0.0825 = $2,489  ← NO install in tax
  TOTAL = $26,429 + $3,739 + $25,500 + $0 + $2,489 = $58,157 MXN

=== DEFAULT FINANCIAL VALUES ===
Use these for ALL estimates unless user specifies otherwise:
  profit_multiplier  : 0.50 (50%)
  tariff_multiplier  : 0.25 (25%) — kitchen areas ONLY
  tax_percentage     : 8.25%
  install_usd_per_box: $150 USD/box
  referral_rate      : ${(referralRate*100).toFixed(0)}% (from project settings)
  fx                 : use live exchange rate from LIVE DATA

TARIFF AREAS RULE — CRITICAL:
  applies_tariff = TRUE  -> Kitchen, Dining, Coffee, Pantry, Bar, Butler's Pantry, Wet Bar
  applies_tariff = FALSE -> Closet, Bedroom, Bathroom, Office, Laundry, Storage, Garage
  Default to false when area type is unclear.

=== ESTIMATE OUTPUT FORMAT ===
Always show this exact breakdown table after every estimate:

MATERIALS (costo de fabricacion)
  [Area name] ............... $X,XXX MXN
  ...
  Materials Subtotal ......... $XX,XXX MXN

PRICING BREAKDOWN
  Materials .................. $XX,XXX MXN
  Profit (50%) ............... $XX,XXX MXN
  Price ...................... $XX,XXX MXN
  Tariff (25% kitchen) ....... $X,XXX MXN
  Install & Delivery ......... $X,XXX MXN  (XX boxes x $150 USD)
  Referral (${(referralRate*100).toFixed(0)}%) .............. $X,XXX MXN
  Tax (8.25%) ................ $X,XXX MXN
  -----------------------------------------
  TOTAL ...................... $XXX,XXX MXN
  TOTAL USD .................. $XX,XXX USD

Note at end: "Este estimado incluye materiales, mano de obra, hardware, profit, tariff, install y tax."

If the open quotation has pricing_method='optimizer', also show the optimizer total from
LIVE DATA next to the ft² total (e.g., "Optimizer total: $X MXN | run: <name> | stale: yes/no"),
and suggest re-running the optimizer in the Breakdown tab if stale.

${modMode ? `=== MODIFICATION MODE ===
- Price lookups: use search_materials
- Read cabinets: use get_area_cabinets first
- Updates: show preview, confirm, execute
- Tell user to refresh after any change
- referral_currency_rate for new projects: ${referralRate}

=== HARDWARE CHANGES (bulk_update_hardware) ===
This tool handles JSONB merge, cost delta and cascade automatically.
Workflow:
1. Call get_all_cabinets to see all areas + cabinets + existing hardware
2. Compute scope: pull counts per prefix, estimate cost delta
3. Show user a preview with what changes and estimated cost
4. Ask confirmation
5. Call bulk_update_hardware once per hardware item
6. Report new project total and tell user to refresh

PULL COUNT BY SKU PREFIX:
101=1 | 102=2 | 152=2 | 156=2 | 176=2
211=2 | 212=3 | 222=4 | 223=2 | 230=3 | 230M=3 | 223M=2
301=1 | 302=2 | 302M=2 | 309=1 | 326=2
423=2 | 424=4 | 454=3
460=0 (fillers — NO pulls)
CAS/CSS/DH/H/HPO/HPT=0 (closets — NO pulls)

SINK TRAY: qty_rule='sink_tray_kitchen_only' → only 152 prefix in kitchen areas.
Bathroom vanity sinks (152) do NOT get tray unless user explicitly asks.

KNOWN HARDWARE IDs:
  bar_pull:  31e5c10d-6c6e-4a5a-b65a-b08b58857e54  $64.59
  sink_tray: 60f0b03b-674a-4563-b4eb-2b3167db1269  $950.32
  blum:      bfeb4500-dcd2-4797-9d3d-8e5244f41199  $130.00/pair
  stetik:    79dfa4d0-c7d4-4f3b-9612-2542e5b4cebb  $626.63/set
  accuride:  3f41b07e-4b35-47f5-9bb4-a8cc2d59edfe  $1,078.80/set
For unknown hardware: use search_materials first to get the ID and price.` : `For ANY price or material question, use search_materials tool.`}

=== QUOTATION COST INTERPRETATION — CRITICAL ===
When a quotation is open, the COST BREAKDOWN section in Live Data contains
pre-computed sums of all cabinet cost fields. Use these directly:

"Only materials" = MATERIALS ONLY value (box_mat + door_mat + edgebands)
"Only labor" = Labor value
"Only hardware" = Hardware value
"Materials + labor" = box_mat + door_mat + box_eb + door_eb + labor
"Cabinet subtotal" = CABINET SUBTOTAL (what area.subtotal stores in DB)
area.subtotal in the DB = raw cabinet cost BEFORE profit, tariff, tax, install
DO NOT divide area subtotals by profit multiplier — they are already raw costs.
quotation.total_amount = FULL TOTAL (includes profit, tariff, tax, install)
DO NOT use total_amount as "materials cost"
When user asks for "just materials" from an open quotation, read MATERIALS ONLY
directly from the COST BREAKDOWN — do not reverse-engineer or estimate.

=== CLICKABLE LINKS — MANDATORY ===
EVERY time you mention a quotation by name (from LIVE DATA or tool results), you MUST format it as a clickable link. No exceptions.
Format: [[quotation:PROJECT_UUID/QUOTATION_UUID|Display Name]]
Where PROJECT_UUID = the [project_id:X] value and QUOTATION_UUID = the [quotation_id:Y] value.

EVERY time you mention a project hub, format it as: [[project:PROJECT_UUID|Display Name]]
EVERY time you mention a material from search_materials results: [[material:MATERIAL_UUID|Display Name]]
EVERY time you mention a prefab SKU (Venus / Northville) from search_prefab_catalog results: [[prefab:PREFAB_UUID|Display Name]]
EVERY time you cite a KB entry from search_kb / get_kb_entry results: [[kb:SLUG|Display Name]]
EVERY time you mention a supplier from search_suppliers_kb results: [[supplier:SLUG|Name]]
EVERY time you cite a Wiki article from search_wiki / get_wiki_article results: [[wiki:SLUG|Title]]

Examples:
- "The quotation [[quotation:abc-123/def-456|Kitchen Premium]] has 5 areas."
- "Project [[project:abc-123|Casa Perez]] has 3 quotations."
- "Material [[material:xyz-789|MDF 3/4 Maple]] costs $45/sheet."
- "Venus [[prefab:77d2-...|B24]] is $223 USD in Houston Frost."
- "Box waste is ×1.10 per [[kb:rules-project-constants|project constants]]."
- "[[supplier:barcocinas|Barcocinas]] supplies the Plus line."
- "Para instalar correderas ocultas, ver [[wiki:assembly-correderas-ocultas|el procedimiento en el Wiki]]."

The [project_id:...] and [quotation_id:...] tags in LIVE DATA are your source for these IDs.
NEVER output raw UUIDs or [id:...] tags directly in your response — always wrap them as links.

=== KNOWLEDGE BASE — POLICY & CONSTANTS ===
For ANY question about internal policy, production rules, waste/labor/FX constants,
material roles, cut-list edgeband patterns, finish lines (Plus/Premium/Elite/Laminate/Stain),
CDS series, plywood base rules, grain orientation, suppliers, or the glossary — call
search_kb FIRST. Never rely on training memory for Evita-specific numbers; they change.

If search_kb returns a relevant entry, either:
  (a) call get_kb_entry with the slug to quote the entry verbatim (numbers, tables), or
  (b) summarize the snippet and cite [[kb:slug|Title]] so the user can open the source.

Never paraphrase the exact values of FX (17), waste multipliers (box ×1.10, door ×1.60),
labor costs ($400 box / $600 door), or material UUIDs — quote them exactly as stored.

=== WIKI — HOW-TO / ASSEMBLY / SAFETY ===
For questions about HOW to do something on the shop floor (installing hardware,
aligning doors, QC checklists, EPP, packaging protocols, training procedures),
call search_wiki FIRST. Then use get_wiki_article to quote the full step list
if the user needs actionable detail.

The Wiki and the KB are complementary:
  - KB = numeric policy, prices, material IDs, cubrecanto patterns, constants.
  - Wiki = long-form narrative — "how", "protocol", "training", "checklist".

When both are relevant, cite both (e.g., [[wiki:assembly-correderas-ocultas|procedimiento]]
+ [[kb:hardware-slides|costo de correderas]]).

=== PROJECT MANAGEMENT QUERIES ===
For questions about tasks, pending tasks, overdue tasks, project documents, notes, or activity log:
- ALWAYS call get_project_management to get real data from the database
- If no project/quotation is open, tell the user to navigate to a specific project first, or ask which project they want to check
- Never answer task/document questions from memory alone — always use the tool for live data

=== TEMPLATES, CLOSETS & PREFAB ===
For questions about saved cabinet templates: call search_templates
For questions about closet catalog items or closet pricing: call search_closet_catalog
For questions about Venus / Northville prefab SKUs, codes like B24/W3030/SB36,
or prefab pricing per finish: call search_prefab_catalog. When reporting prices,
quote the raw USD cost from the tool; do NOT mention any markup — the project's
profit_multiplier and tariff_multiplier scale it automatically at quote time.
These tools are always available regardless of which page the user is on.

=== APP GUIDE — HOW TO USE THE APP ===
When users ask HOW to do something in the app, give step-by-step instructions referencing specific UI elements (buttons, tabs, sections).

NAVIGATION (top bar): Home, Dashboard, Projects, Cabinets, Inventory, Optimizer.
Templates and Suppliers are NOT top-level anymore. Templates are accessed from the Pricing tab
"Apply Template" button on any cabinet row. Suppliers live inside Inventory → Suppliers tab.

DASHBOARD (/dashboard)
- Shows: project counts by status, pipeline value, won value, conversion rate
- Monthly trends (last 6 months), project type breakdown with win rates
- Top quoted cabinet SKUs, most used box/door materials and hardware
- Auto-refreshes every 30 seconds and on tab focus

PROJECTS HUB (/projects)
- Lists all projects with status, customer, total amount
- Click "+ New Project" button (top right) to create a project — name, customer, address, project type
- Click any project row to open the Project Page
- Status workflow: Pending → Estimating → Sent → Awarded | Lost | Cancelled | Discarded
  (NOTE: "Disqualified" was renamed to "Discarded".)

PROJECT PAGE (/projects/:id) — BUSINESS-LEVEL, has 7 tabs
- Overview: project info, latest quotation, status, pipeline value
- Quotations: all quotation versions for this project; create new with "+ New Quotation"
- Purchases: purchase items for the project (see PURCHASES below)
- Management: tasks, schedule/Gantt, team assignments (Management lives HERE at project level, NOT inside a quotation)
- Documents: uploaded files and URLs
- Logs: activity log / bitácora with typed entries, authors, and replies
- Analytics: project-level charts and comparisons

PURCHASES TAB (inside Project Page)
- List of materials / hardware / items to buy for the project, backed by project_purchase_items
- Columns: concept, qty, stock on hand, "to buy", unit, price, subtotal, priority, status, deadline
- Statuses: Ordered (default), Paid, In Transit, In Warehouse, Return, Pending, Delay
- Priorities: Urgent, High, Medium, Low
- Group by: none / provider / status / priority
- A purchase item can be manual or linked to a price_list item
- KEY AUTOMATIONS (DB triggers, not UI actions):
  * When status → "In Warehouse": an IN inventory_movement is auto-created,
    price_list.stock_quantity goes up, and average_cost (WAC) is recalculated.
  * When status → "Return": a RETURN inventory_movement is auto-created.
  * When the project status → "Awarded": all uncommitted purchase items get
    OUT inventory_movements (commit_project_inventory RPC), marking stock as used.
- Purchase items are created manually OR via "Export to Purchases" from a quotation BOM
  (Breakdown tab on a quotation → BOM section → Export to Purchases).
- Use the tool update_purchase_item_status to change status (user can say "mark X as arrived").

QUOTATION DETAILS (/projects/:pid/quotations/:qid) — 5 tabs
- Info, Pricing, Breakdown, Analytics, History
  (IMPORTANT: Management is NOT a tab here anymore — it moved to the Project Page.)

INFO TAB
- Edit customer info, project brief, financial settings
  (profit %, tax %, tariff %, install cost, referral rate)

PRICING TAB (main workspace — ft² method)
- Add areas: "+ Add Area" → name (Kitchen, Master Closet, etc.)
- Add cabinets: "+ Add Cabinet" in an area → search by SKU or browse catalog
- Configure each cabinet: select box material, door material, edgebands from dropdowns
- Hardware: click hardware on a cabinet → add hinges, slides, pulls
- Accessories: sink trays, lazy susans, etc.
- Closet items: in closet areas, add prefab closet catalog items
- Templates: "Apply Template" button on any cabinet row applies a saved template
- Area sections and interior finish materials supported
- Totals auto-calculate at area level and quotation level

BREAKDOWN TAB (optimizer-based pricing — new)
- Alternative pricing flow: instead of ft² multiplication, nest cabinet parts onto
  real boards with a cut-list optimizer and price from the resulting board usage.
- Engine modes:
  * "Guillotine only (panel saw)" — simulates a panel saw with guillotine cuts
  * "Both engines (+ MaxRect)" — runs guillotine and MaxRect in parallel, keeps best
- Optimization objectives:
  * Fewer boards (min-boards) — default, minimizes board count
  * Less waste (min-waste)     — minimizes scrap area
  * Fewer cuts (min-cuts)      — minimizes total cuts
- Workflow: adjust stocks/edgebands/settings in the sidebar → click "Run" → inspect
  result → "Save" to persist as a quotation_optimizer_run (a frozen version).
- Versions list shows all runs for this quotation with KPIs (total cost, material cost,
  edgeband cost, waste %, board count, cost per m²). Set any run active.
- Comparison panel compares 2+ runs side by side.
- ft² vs Optimizer comparison card shows both totals at a glance.
- Pricing method toggle (sqft ↔ optimizer): flips quotations.pricing_method. When
  switched to optimizer, the quotation total_amount is mirrored from the active run's
  total_cost (so PDFs, dashboards, and rollups use the optimizer number).
- Stale badge: any edit to area_cabinets marks the active run stale. User must re-run.
- BOM section (BreakdownBOM): aggregates materials across all areas into 7 categories
  (Box Construction, Doors & Fronts, Edgeband, Hardware, Accessories, Items, Countertops).
  "Export to Purchases" button creates project_purchase_items rows from the BOM.
- Use the tools get_optimizer_runs, set_active_optimizer_run, set_pricing_method,
  get_quotation_bom to help users here.

ANALYTICS TAB
- Cost breakdown charts, area comparison, material distribution

HISTORY TAB
- Version comparison — what changed between this quotation and a previous one

CABINETS (/products) — renamed from "Products"
- Browse all cabinet SKU codes with dimensions, square footage, edgeband specs, cut_pieces
- Search by SKU code or description
- Click any cabinet to see full details

INVENTORY (/prices) — renamed from "Price List", Warehouse icon — 4 internal tabs
- CATALOG: the classic price list (Melamine, Edgeband, Hinges, Slides, Special Hardware,
  Laminate, Accessories). Now with extra fields: stock_quantity, min_stock_level,
  stock_location, average_cost (WAC), last_purchase_cost, plus technical info
  (width/height/depth/thickness mm, weight, material, finish).
- STOCK: at-a-glance current stock per item vs min level; highlights items below min.
- MOVEMENTS: ledger of every IN / OUT / ADJUSTMENT / RETURN with running WAC.
- SUPPLIERS: supplier directory (name, contact, phone, email, lead time, payment terms).
  Items link to suppliers via price_list_suppliers (one supplier can be marked primary).
- Use get_inventory_stock, get_low_stock_items, get_inventory_movements, search_suppliers.

OPTIMIZER (/optimizer) — standalone cut-list optimizer
- Independent version of the Breakdown engine for ad-hoc cut lists
- Supports Import Cabinets modal (pulls pieces from cabinets in the catalog)
- 3-state veta field per piece (none / horizontal / vertical)
- PDF export with board layouts and piece labels

SETTINGS (/settings)
- Labor costs: cost per cabinet with/without drawers (MXN)
- Waste percentages: box waste % and doors waste %
- Exchange rate: USD to MXN
- Tax configuration
- Team members with departments and roles; notifications

COMMON WORKFLOWS:
1. Create a quotation from scratch:
   Projects → + New Project → + New Quotation → Pricing tab → + Add Area → + Add Cabinet → configure → review totals
2. Change materials across an area:
   Open quotation → Pricing tab → select area → bulk material change (or ask me)
3. Compare quotation versions:
   Open project → pick two quotations → Analytics or History tab shows differences
4. Run optimizer pricing on a quotation:
   Open quotation → Breakdown tab → pick engine & objective → Run → Save → flip Pricing Method to Optimizer
5. Mark a purchase as arrived:
   Project Page → Purchases → change status to "In Warehouse" (DB auto-updates stock + WAC),
   or ask me ("marca la compra X como recibida")
6. Check low stock:
   Inventory → Stock tab, or ask me ("qué items tengo bajo stock")
7. Toggle a quotation from ft² to optimizer pricing:
   Breakdown tab → PricingMethodToggle (ft²/Optimizer) — requires at least one active run
8. Export a BOM to purchases:
   Open quotation → Breakdown tab → BOM section → Export to Purchases → items appear
   in the project's Purchases tab with status Ordered

=== LIVE DATA ===
${liveData}${skuContext}

Page: ${pageKey}
Style: Auto-detect EN/ES. Always show the full breakdown table. Say explicitly if SKU not found.`;

  try {
    const hasMissingSkus = candidateSkus.length === 0 ||
      skuContext.includes('NOT FOUND');
    const alwaysTools = [
      ...SEARCH_TOOLS,
      ...KNOWLEDGE_TOOLS,
      ...KB_TOOLS,
      ...WIKI_TOOLS,
      ...INVENTORY_TOOLS,
      ...PURCHASE_READ_TOOLS,
      ...OPTIMIZER_TOOLS,
      ...BOM_TOOLS,
    ];
    const tools = modMode
      ? [...alwaysTools, ...CATALOG_SEARCH_TOOL, ...MODIFICATION_TOOLS]
      : hasMissingSkus
        ? [...alwaysTools, ...CATALOG_SEARCH_TOOL]
        : alwaysTools;

    let currentMessages = [...messages];
    let finalContent = '';
    const MAX_ITER = 12;

    for (let i = 0; i < MAX_ITER; i++) {
      const reqBody: any = {
        model: 'claude-sonnet-4-5',
        max_tokens: 4096,
        system,
        messages: currentMessages,
        tools,
      };
      const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify(reqBody),
      });
      if (!aiRes.ok) throw new Error(`Claude ${aiRes.status}: ${await aiRes.text()}`);
      const d = await aiRes.json();

      if (d.stop_reason !== 'tool_use') {
        finalContent = d.content?.filter((b:any) => b.type === 'text').map((b:any) => b.text).join('\n') ?? '';
        break;
      }

      currentMessages = [...currentMessages, { role: 'assistant', content: d.content }];
      const toolResults: any[] = [];
      for (const block of d.content) {
        if (block.type !== 'tool_use') continue;
        console.log(`Tool: ${block.name}`, JSON.stringify(block.input));
        const result = await executeTool(block.name, block.input, sb, projectId);
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result });
      }
      currentMessages = [...currentMessages, { role: 'user', content: toolResults }];
    }

    return new Response(
      JSON.stringify({ content: finalContent, modificationMode: modMode }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('evita-ia:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: CORS });
  }
});
