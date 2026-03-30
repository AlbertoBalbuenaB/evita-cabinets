import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const EVITA_SECRET  = Deno.env.get('EVITA_IA_SECRET')  ?? '';
const SB_URL        = Deno.env.get('SUPABASE_URL')      ?? '';
const SB_SERVICE    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-evita-key',
};

function hasModificationIntent(messages: {role:string;content:string}[]): boolean {
  const last = [...messages].reverse().find(m => m.role === 'user')?.content ?? '';
  const kw = ['cambia','cambiar','actualiza','actualizar','modifica','modificar',
    'pon','poner','agrega','agregar','quita','quitar','elimina','eliminar',
    'change','update','modify','set','add','remove','delete','switch',
    'reemplaza','reemplazar','aplica','aplicar',
    'hardware','pull','pulls','jaladera','jaladora','jaladores','jaladeras',
    'bisagra','bisagras','hinge','hinges','slide','slides','correderas',
    'sink tray','tray','herraje','herrajes','manija','manijas'];
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
    name: 'get_project_management',
    description: 'Get project management data: tasks, documents, and activity log for the currently open project. Use when user asks about tasks, documents, or project notes.',
    input_schema: {
      type: 'object',
      properties: {},
      required: []
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
        return JSON.stringify({ project_id: projectId, total_areas: (areas ?? []).length,
          total_cabinet_lines: (cabs ?? []).length, areas: result });
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

      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  } catch (err: any) {
    return JSON.stringify({ error: err.message });
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.headers.get('x-evita-key') !== EVITA_SECRET) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS });
  }
  let body: any;
  try { body = await req.json(); }
  catch { return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: CORS }); }

  const { messages = [], projectId = null, pageKey = 'dashboard' } = body;
  const sb = createClient(SB_URL, SB_SERVICE);

  const [settingsRes, recentRes, matPricesRes] = await Promise.all([
    sb.from('settings').select('key, value'),
    sb.from('quotations').select('id, project_id, name, customer, status, total_amount').order('updated_at', { ascending: false }).limit(5),
    sb.from('price_list').select('id, unit_price_mxn').or('id.like.f4953b9f%,id.like.d0eb99a2%,id.like.6d877ed9%,id.like.e3e9c098%'),
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
      `${p.name} [id:${p.project_id}] (${p.status}) $${Number(p.total_amount).toLocaleString()} MXN`
    ).join(' | ');
  }

  let proj: any = null;
  if (projectId) {
    const { data: projData } = await sb.from('quotations')
      .select('name, status, total_amount, profit_multiplier, tax_percentage, tariff_multiplier, install_delivery, install_delivery_usd, install_delivery_per_box_usd, referral_currency_rate')
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

      liveData += `\nOpen quotation: ${proj.name} [id:${projectId}] | ${proj.status} | $${Number(proj.total_amount).toLocaleString()} MXN`;
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

  const system = `You are Evita IA, quotation assistant for Evita Cabinets (Houston TX).

=== DATA MODEL ===
"Project" = business-level parent entity (name, customer, address).
"Quotation" = pricing version within a project (areas, cabinets, costs, totals).
A project has multiple quotations (e.g., "Plus", "Premium", "v2", "v3").
The projectId you receive is a QUOTATION ID. project_areas and area_cabinets belong to quotations.
When the user says "project" they usually mean the quotation they are currently viewing.

=== CAPABILITIES ===
- Quick estimates with full USD pricing breakdown
- Price and material lookups (use search_materials for ANY price question)
- Quotation modifications (materials, quantities, settings)

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

=== CLICKABLE LINKS ===
When mentioning a project by name from LIVE DATA, wrap it as: [[project:PROJECT_UUID|Display Name]]
When mentioning a material from search_materials results, wrap it as: [[material:MATERIAL_UUID|Display Name]]
Example: "Your project [[project:abc-123|Kitchen Remodel]] has 5 areas."
Example: "The material [[material:def-456|MDF 3/4 Maple]] costs $45.20/sheet."
Always use these formats when an ID is available. The [id:...] in LIVE DATA is for your reference only — never output it directly.

=== PROJECT MANAGEMENT QUERIES ===
For questions about tasks, pending tasks, overdue tasks, project documents, notes, or activity log:
- ALWAYS call get_project_management to get real data from the database
- If no project/quotation is open, tell the user to navigate to a specific project first, or ask which project they want to check
- Never answer task/document questions from memory alone — always use the tool for live data

=== TEMPLATES & CLOSETS ===
For questions about saved cabinet templates: call search_templates
For questions about closet catalog items or closet pricing: call search_closet_catalog
These tools are always available regardless of which page the user is on.

=== APP GUIDE — HOW TO USE THE APP ===
When users ask HOW to do something in the app, give step-by-step instructions referencing specific UI elements (buttons, tabs, sections).

DASHBOARD (/)
- Shows: project counts by status, pipeline value, won value, conversion rate
- Monthly trends (last 6 months), project type breakdown with win rates
- Top quoted cabinet SKUs, most used box/door materials and hardware
- Auto-refreshes every 30 seconds and on tab focus

PROJECTS HUB (/projects)
- Lists all projects with status, customer, total amount
- Click "+ New Project" button (top right) to create a project — enter name, customer, address, project type
- Click any project row to open it and see its quotations
- Status workflow: Pending → Estimating → Sent → Awarded | Lost | Cancelled | Disqualified

PROJECT PAGE (/projects/:id)
- Shows project info (name, customer, address) and all quotation versions
- Create new quotation version with "+ New Quotation" button
- Click a quotation card to open Quotation Details

QUOTATION DETAILS (/projects/:id/quotations/:qid)
- 5 tabs: Info, Pricing, Analytics, History, Management
- INFO TAB: Edit customer info, project brief, financial settings (profit %, tax %, tariff %, install cost, referral rate)
- PRICING TAB (main workspace):
  * Add areas: Click "+ Add Area" → name it (Kitchen, Master Closet, etc.)
  * Add cabinets: Click "+ Add Cabinet" in an area → search by SKU or browse catalog
  * Configure each cabinet: select box material, door material, edgebands from dropdowns
  * Hardware: Click hardware section on a cabinet → add hinges, slides, pulls
  * Accessories: Add items like sink trays, lazy susans
  * Closet items: In closet areas, add prefab closet catalog items
  * Templates: Click "Apply Template" to quickly configure a cabinet from saved template
  * Totals auto-calculate at area level and quotation level
- ANALYTICS TAB: Cost breakdown charts, area comparison, material distribution
- HISTORY TAB: Version comparison — see what changed between quotation versions
- MANAGEMENT TAB: Documents, tasks, activity log, schedule/Gantt

PRODUCTS CATALOG (/products)
- Browse all cabinet SKU codes with dimensions, square footage, edgeband specs
- Search by SKU code or description using the search bar at top
- Click any product to see full details

PRICE LIST (/prices)
- All materials, hardware, accessories with current prices
- Types: Melamine, Edgeband, Hinges, Slides, Special Hardware, Laminate, Accessories
- Search and filter by type using the tabs at top
- Click any item to see details including notes and product URL
- Prices stored in MXN, converted to USD using the exchange rate in Settings

TEMPLATES (/templates)
- Saved cabinet configurations for quick reuse across projects
- To save a template: In Pricing tab, fully configure a cabinet → click "Save as Template" → give it a name
- To apply a template: In Pricing tab, click "Apply Template" button on any cabinet row → select template
- Templates store: SKU, materials, edgebands, hardware, accessories, back panel config

SETTINGS (/settings)
- Labor costs: cost per cabinet with/without drawers (MXN)
- Waste percentages: box waste % and doors waste %
- Exchange rate: USD to MXN conversion rate
- Tax configuration: tax percentage for quotations
- Team members: Add/edit team members (name, role, email) for task assignment

COMMON WORKFLOWS:
1. Create a quotation from scratch:
   Projects → + New Project → fill info → + New Quotation → Pricing tab → + Add Area → + Add Cabinet → configure materials → review totals
2. Change materials across an area:
   Open quotation → Pricing tab → select area → use bulk material change (or ask me to do it!)
3. Compare quotation versions:
   Open project → click two quotation cards → Analytics or History tab shows differences

=== LIVE DATA ===
${liveData}${skuContext}

Page: ${pageKey}
Style: Auto-detect EN/ES. Always show the full breakdown table. Say explicitly if SKU not found.`;

  try {
    const hasMissingSkus = candidateSkus.length === 0 ||
      skuContext.includes('NOT FOUND');
    const alwaysTools = [...SEARCH_TOOLS, ...KNOWLEDGE_TOOLS];
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
