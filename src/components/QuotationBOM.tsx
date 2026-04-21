import { useEffect, useMemo, useState } from 'react';
import { ShoppingCart, FileText } from 'lucide-react';
import { formatCurrency } from '../lib/calculations';
import { supabase } from '../lib/supabase';
import { fetchAllProducts } from '../lib/fetchAllProducts';
import { useSettingsStore } from '../lib/settingsStore';
import { computeQuotationTotals } from '../lib/pricing/computeQuotationTotals';
import type {
  Product,
  PriceListItem,
  ProjectArea,
  AreaCabinet,
  AreaItem,
  AreaCountertop,
  AreaClosetItem,
  AreaPrefabItem,
  Quotation,
} from '../types';

type EnrichedArea = ProjectArea & {
  cabinets: AreaCabinet[];
  items: AreaItem[];
  countertops: AreaCountertop[];
  closetItems?: AreaClosetItem[];
  prefabItems?: AreaPrefabItem[];
};

interface QuotationBOMProps {
  areas: EnrichedArea[];
  projectId: string;
  quotation: Quotation;
}

type BOMCategory =
  | 'Box Construction'
  | 'Doors & Fronts'
  | 'Edgeband'
  | 'Hardware'
  | 'Accessories'
  | 'Items'
  | 'Countertops'
  | 'Prefab Cabinets';

const CATEGORY_ORDER: BOMCategory[] = [
  'Box Construction',
  'Doors & Fronts',
  'Edgeband',
  'Hardware',
  'Accessories',
  'Items',
  'Countertops',
  'Prefab Cabinets',
];

const CATEGORY_COLORS: Record<BOMCategory, string> = {
  'Box Construction': 'bg-status-amber-bg text-status-amber-fg',
  'Doors & Fronts':   'bg-sky-50 text-accent-text',
  'Edgeband':         'bg-accent-tint-soft text-accent-text',
  'Hardware':         'bg-surf-muted text-fg-700',
  'Accessories':      'bg-status-emerald-bg text-status-emerald-fg',
  'Items':            'bg-status-orange-bg text-status-orange-fg',
  'Countertops':      'bg-teal-50 text-teal-800',
  'Prefab Cabinets':  'bg-accent-tint-soft text-accent-text',
};

interface BOMRow {
  category: BOMCategory;
  concept: string;
  unit: string;
  qty: number;
  price: number;
  subtotal: number;
  priceListItemId: string | null;
}

// Internal extended row used during accumulation (tracks raw SF/meters)
interface AccumSheetRow extends BOMRow {
  _totalSF: number;
  _sfPerSheet: number;
}
interface AccumEbRow {
  totalMeters: number;
  price: number;
  priceListItemId: string | null;
}
interface AccumDpRow extends BOMRow {
  _totalMeters: number;
}

const ROLL_LENGTH_METERS = 150;

export function QuotationBOM({ areas, projectId, quotation }: QuotationBOMProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [priceList, setPriceList] = useState<PriceListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const exchangeRate = useSettingsStore(s => s.settings.exchangeRateUsdToMxn);

  useEffect(() => {
    async function loadData() {
      try {
        const [productsData, pricesRes] = await Promise.all([
          fetchAllProducts({ onlyActive: false }),
          supabase.from('price_list').select('*'),
        ]);
        setProducts(productsData);
        setPriceList(pricesRes.data || []);
      } catch (err) {
        console.error('Error loading BOM data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const bom = useMemo<BOMRow[] | null>(() => {
    if (loading || products.length === 0) return null;

    // ── Accumulation maps ──────────────────────────────────────────────────
    const boxBoardsMap   = new Map<string, AccumSheetRow>();
    const backPanelMap   = new Map<string, AccumSheetRow>();
    const boxFinishMap   = new Map<string, AccumSheetRow>();
    const doorBoardsMap  = new Map<string, AccumSheetRow>();
    const doorFinishMap  = new Map<string, AccumSheetRow>();
    const doorProfileMap = new Map<string, AccumDpRow>();
    const edgebandMap    = new Map<string, AccumEbRow>();  // keyed by concept_description
    const hardwareMap    = new Map<string, BOMRow>();
    const accessoriesMap = new Map<string, BOMRow>();
    const itemsRows: BOMRow[] = [];
    const countertopsRows: BOMRow[] = [];
    const prefabRows: BOMRow[] = [];

    // ── Helper: accumulate sheet-type material ─────────────────────────────
    function accumulateSheet(
      map: Map<string, AccumSheetRow>,
      category: BOMCategory,
      materialId: string | null | undefined,
      sfField: number,
      effectiveQty: number,
    ) {
      if (!materialId || sfField <= 0) return;
      const material = priceList.find(p => p.id === materialId);
      if (!material) return;
      if (material.concept_description.toLowerCase().includes('not apply')) return;
      const sfPerSheet = material.sf_per_sheet || 32;
      const unitPrice  = material.price_with_tax ?? material.price;
      const totalSF    = sfField * effectiveQty;

      if (map.has(materialId)) {
        const row = map.get(materialId)!;
        row._totalSF += totalSF;
        row.qty      = Math.ceil(row._totalSF / row._sfPerSheet);
        row.subtotal = row.qty * row.price;
      } else {
        const qty = Math.ceil(totalSF / sfPerSheet);
        map.set(materialId, {
          category,
          concept: material.concept_description,
          unit: 'Sheet',
          qty,
          price: unitPrice,
          subtotal: qty * unitPrice,
          priceListItemId: material.id,
          _totalSF: totalSF,
          _sfPerSheet: sfPerSheet,
        });
      }
    }

    // ── Per-cabinet iteration ──────────────────────────────────────────────
    areas.forEach(area => {
      const areaQty = area.quantity ?? 1;

      area.cabinets.forEach(cabinet => {
        const product = products.find(p => p.sku === cabinet.product_sku);
        if (!product) return;

        const effectiveQty = cabinet.quantity * areaQty;

        // Box boards + interior finish + back panel
        accumulateSheet(boxBoardsMap,  'Box Construction', cabinet.box_material_id,           product.box_sf,             effectiveQty);
        accumulateSheet(boxFinishMap,  'Box Construction', cabinet.box_interior_finish_id,     product.box_sf,             effectiveQty);
        if (cabinet.use_back_panel_material && cabinet.back_panel_sf && (cabinet.back_panel_sf > 0)) {
          accumulateSheet(backPanelMap, 'Box Construction', cabinet.back_panel_material_id,   cabinet.back_panel_sf / cabinet.quantity, effectiveQty);
        }

        // Door boards + interior finish
        accumulateSheet(doorBoardsMap, 'Doors & Fronts', cabinet.doors_material_id,           product.doors_fronts_sf,    effectiveQty);
        accumulateSheet(doorFinishMap, 'Doors & Fronts', cabinet.doors_interior_finish_id,    product.doors_fronts_sf,    effectiveQty);

        // Door profile (continuous meters, not rolled)
        if (cabinet.door_profile_id) {
          const dp = priceList.find(p => p.id === cabinet.door_profile_id);
          if (dp && !dp.concept_description.toLowerCase().includes('not apply')) {
            const metersThisCabinet = (product.doors_fronts_edgeband ?? 0) * effectiveQty;
            const unitPrice = dp.price_with_tax ?? dp.price;
            if (doorProfileMap.has(cabinet.door_profile_id)) {
              const row = doorProfileMap.get(cabinet.door_profile_id)!;
              row._totalMeters += metersThisCabinet;
              row.qty      = row._totalMeters;
              row.subtotal = row.qty * row.price;
            } else {
              doorProfileMap.set(cabinet.door_profile_id, {
                category: 'Doors & Fronts',
                concept: dp.concept_description,
                unit: 'm',
                qty: metersThisCabinet,
                price: unitPrice,
                subtotal: metersThisCabinet * unitPrice,
                priceListItemId: dp.id,
                _totalMeters: metersThisCabinet,
              });
            }
          }
        }

        // Edgeband (box + doors merged by concept_description)
        function accumulateEdgeband(ebId: string | null | undefined, metersField: number) {
          if (!ebId) return;
          const eb = priceList.find(p => p.id === ebId);
          if (!eb || eb.concept_description.toLowerCase().includes('not apply')) return;
          const key         = eb.concept_description;
          const totalMeters = metersField * effectiveQty;
          if (edgebandMap.has(key)) {
            edgebandMap.get(key)!.totalMeters += totalMeters;
          } else {
            edgebandMap.set(key, {
              totalMeters,
              price: (eb.price_with_tax ?? eb.price) * ROLL_LENGTH_METERS,
              priceListItemId: eb.id,
            });
          }
        }
        accumulateEdgeband(cabinet.box_edgeband_id,   product.box_edgeband ?? 0);
        accumulateEdgeband(cabinet.doors_edgeband_id, product.doors_fronts_edgeband ?? 0);

        // Hardware
        if (Array.isArray(cabinet.hardware)) {
          (cabinet.hardware as any[]).forEach((hw: any) => {
            const hwId = hw.hardware_id || hw.priceListId;
            if (!hwId) return;
            const item = priceList.find(p => p.id === hwId);
            if (!item || item.concept_description.toLowerCase().includes('not apply')) return;
            const qty       = (hw.quantity_per_cabinet || hw.quantity || 1) * effectiveQty;
            const unitPrice = item.price_with_tax ?? item.price;
            if (hardwareMap.has(hwId)) {
              const row = hardwareMap.get(hwId)!;
              row.qty      += qty;
              row.subtotal  = row.qty * row.price;
            } else {
              hardwareMap.set(hwId, {
                category: 'Hardware',
                concept: item.concept_description,
                unit: (item as any).unit || 'pcs',
                qty,
                price: unitPrice,
                subtotal: qty * unitPrice,
                priceListItemId: item.id,
              });
            }
          });
        }

        // Accessories
        if (Array.isArray(cabinet.accessories)) {
          (cabinet.accessories as any[]).forEach((acc: any) => {
            const accId = acc.accessory_id;
            if (!accId) return;
            const item = priceList.find(p => p.id === accId);
            if (!item || item.concept_description.toLowerCase().includes('not apply')) return;
            const qty       = (acc.quantity_per_cabinet || 1) * effectiveQty;
            const unitPrice = item.price_with_tax ?? item.price;
            if (accessoriesMap.has(accId)) {
              const row = accessoriesMap.get(accId)!;
              row.qty      += qty;
              row.subtotal  = row.qty * row.price;
            } else {
              accessoriesMap.set(accId, {
                category: 'Accessories',
                concept: item.concept_description,
                unit: (item as any).unit || 'pcs',
                qty,
                price: unitPrice,
                subtotal: qty * unitPrice,
                priceListItemId: item.id,
              });
            }
          });
        }
      });

      // Area items
      area.items.forEach(item => {
        const plItem = priceList.find(p => p.id === item.price_list_item_id);
        const qty    = item.quantity * areaQty;
        itemsRows.push({
          category: 'Items',
          concept: item.item_name,
          unit: (plItem as any)?.unit || 'pcs',
          qty,
          price: item.unit_price,
          subtotal: item.unit_price * qty,
          priceListItemId: item.price_list_item_id,
        });
      });

      // Area countertops
      area.countertops.forEach(ct => {
        const plItem = priceList.find(p => p.id === ct.price_list_item_id);
        const qty    = ct.quantity * areaQty;
        countertopsRows.push({
          category: 'Countertops',
          concept: ct.item_name,
          unit: (plItem as any)?.unit || 'lft',
          qty,
          price: ct.unit_price,
          subtotal: ct.unit_price * qty,
          priceListItemId: ct.price_list_item_id,
        });
      });

      // Area prefab items (Venus / Northville reseller rows). Each line is
      // one (code, finish) pair. Price is the USD MSRP snapshot, subtotal is
      // the MXN snapshot already multiplied by cost_usd × fx_rate × quantity;
      // we only multiply by areaQty here to honor the area-level quantity.
      (area.prefabItems ?? []).forEach(pi => {
        const cat = (pi as AreaPrefabItem & { catalog_item?: { cabinet_code?: string; description?: string | null; brand?: { name?: string } | null } }).catalog_item;
        const brand = cat?.brand?.name ?? '';
        const code  = cat?.cabinet_code ?? '—';
        const desc  = cat?.description ? ` — ${cat.description}` : '';
        const label = `${brand ? brand + ' ' : ''}${code}${desc} · ${pi.finish}`;
        prefabRows.push({
          category: 'Prefab Cabinets',
          concept: label,
          unit: 'pc',
          qty: pi.quantity * areaQty,
          price: pi.cost_usd,
          subtotal: pi.cost_mxn * areaQty,
          priceListItemId: null,
        });
      });
    });

    // ── Build final BOM rows ───────────────────────────────────────────────
    const rows: BOMRow[] = [];

    // Sheet materials (filter zero-cost and "not apply")
    for (const map of [boxBoardsMap, backPanelMap, boxFinishMap]) {
      map.forEach(row => { if (row.qty > 0 && row.subtotal > 0) rows.push(row); });
    }
    for (const map of [doorBoardsMap, doorFinishMap]) {
      map.forEach(row => { if (row.qty > 0 && row.subtotal > 0) rows.push(row); });
    }
    doorProfileMap.forEach(row => { if (row.qty > 0 && row.subtotal > 0) rows.push(row); });

    // Edgeband — convert meter totals to rolls
    edgebandMap.forEach((eb, conceptName) => {
      if (eb.totalMeters <= 0) return;
      const rollsNeeded = Math.ceil(eb.totalMeters / ROLL_LENGTH_METERS);
      rows.push({
        category: 'Edgeband',
        concept: conceptName,
        unit: 'Roll (150m)',
        qty: rollsNeeded,
        price: eb.price,
        subtotal: rollsNeeded * eb.price,
        priceListItemId: eb.priceListItemId,
      });
    });

    hardwareMap.forEach(row    => { if (row.qty > 0 && row.subtotal > 0) rows.push(row); });
    accessoriesMap.forEach(row => { if (row.qty > 0 && row.subtotal > 0) rows.push(row); });
    rows.push(...itemsRows.filter(r => r.qty > 0));
    rows.push(...countertopsRows.filter(r => r.qty > 0));
    rows.push(...prefabRows.filter(r => r.qty > 0));

    return rows;
  }, [areas, products, priceList, loading]);

  // ── Cost summary ─────────────────────────────────────────────────────────
  const costSummary = useMemo(() => {
    if (!bom) return null;

    const installDeliveryMxn = (quotation.install_delivery_usd ?? 0) * (exchangeRate || 1);
    const areasNorm = areas.map(a => ({
      ...a,
      closetItems: a.closetItems ?? [],
      prefabItems: a.prefabItems ?? [],
    }));

    const riskPct = (quotation as any).risk_factor_applies_sqft !== false
      ? ((quotation as any).risk_factor_percentage ?? 0) : 0;
    const totals = computeQuotationTotals({
      pricingMethod: 'sqft',
      areasData: areasNorm,
      multipliers: {
        profitMultiplier:  quotation.profit_multiplier        ?? 0,
        tariffMultiplier:  quotation.tariff_multiplier        ?? 0,
        referralRate:      quotation.referral_currency_rate   ?? 0,
        taxPercentage:     quotation.tax_percentage           ?? 0,
        installDeliveryMxn,
        otherExpenses:     quotation.other_expenses           ?? 0,
        riskFactorPct:     riskPct,
      },
    });

    const totalLaborCost = areas.reduce((sum, area) => {
      const qty = area.quantity ?? 1;
      return sum + area.cabinets.reduce((s, c) => s + (c.labor_cost ?? 0) * qty, 0);
    }, 0);

    return {
      materialsCostOnly:  totals.materialsSubtotal - totalLaborCost,
      totalLaborCost,
      materialsSubtotal:  totals.materialsSubtotal,
      riskFactorPct:      riskPct,
      riskAmount:         totals.riskAmount,
      profitMarginAmount: totals.profitAmount,
      price:              totals.price,
      tariffAmount:       totals.tariffAmount,
      referralAmount:     totals.referralAmount,
      taxAmount:          totals.taxAmount,
      installDeliveryMxn,
      otherExpenses:      quotation.other_expenses ?? 0,
      otherExpensesLabel: quotation.other_expenses_label || 'Other Expenses',
      fullProjectTotal:   totals.fullProjectTotal,
    };
  }, [bom, areas, quotation, exchangeRate]);

  // ── Export to Purchases ───────────────────────────────────────────────────
  async function handleExportToPurchases() {
    if (!bom || bom.length === 0 || exporting) return;
    setExporting(true);
    try {
      const { data: existing } = await supabase
        .from('project_purchase_items')
        .select('display_order')
        .eq('project_id', projectId)
        .order('display_order', { ascending: false })
        .limit(1);

      const maxOrder = (existing?.[0]?.display_order ?? -1) as number;

      const rows = bom
        .filter(r => r.qty > 0)
        .map((r, i) => ({
          project_id:           projectId,
          concept:              r.concept,
          quantity:             r.qty,
          unit:                 r.unit,
          price:                r.price,
          subtotal:             r.subtotal,
          price_list_item_id:   r.priceListItemId,
          status:               'Pending' as const,
          display_order:        maxOrder + 1 + i,
        }));

      const { error } = await supabase.from('project_purchase_items').insert(rows);
      if (error) throw error;
      alert(`${rows.length} item${rows.length !== 1 ? 's' : ''} exported to Purchases successfully.`);
    } catch (err) {
      console.error('Error exporting BOM to purchases:', err);
      alert('Error exporting to Purchases. Please try again.');
    } finally {
      setExporting(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="bg-surf-card rounded-xl shadow-sm border border-border-soft p-6 text-center text-fg-500 text-sm">
        Loading Bill of Materials…
      </div>
    );
  }

  if (!bom || bom.length === 0) {
    return (
      <div className="bg-surf-card rounded-xl shadow-sm border border-border-soft p-6 text-center text-fg-400 text-sm">
        No materials found. Add areas with cabinets to generate the BOM.
      </div>
    );
  }

  // Group rows by category in defined order
  const grouped = new Map<BOMCategory, BOMRow[]>();
  CATEGORY_ORDER.forEach(cat => grouped.set(cat, []));
  bom.forEach(row => grouped.get(row.category)?.push(row));

  const bomTotal = bom.reduce((s, r) => s + r.subtotal, 0);

  return (
    <div className="space-y-6">
      {/* ── BOM Table ─────────────────────────────────────────────────────── */}
      <div className="bg-surf-card rounded-xl shadow-sm border border-border-soft overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-soft">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-fg-500" />
            <h2 className="text-base font-semibold text-fg-800">Bill of Materials</h2>
            <span className="ml-1 text-xs text-fg-400 font-normal">({bom.length} items)</span>
          </div>
          <button
            onClick={handleExportToPurchases}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ShoppingCart className="h-3.5 w-3.5" />
            {exporting ? 'Exporting…' : 'Export to Purchases'}
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surf-app border-b border-border-soft">
                <th className="text-left px-4 py-2.5 font-semibold text-fg-600 w-[40%]">Concept</th>
                <th className="text-left px-3 py-2.5 font-semibold text-fg-600 w-[12%]">Unit</th>
                <th className="text-right px-3 py-2.5 font-semibold text-fg-600 w-[10%]">Qty</th>
                <th className="text-right px-3 py-2.5 font-semibold text-fg-600 w-[16%]">Price</th>
                <th className="text-right px-4 py-2.5 font-semibold text-fg-600 w-[16%]">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {CATEGORY_ORDER.map(cat => {
                const rows = grouped.get(cat) ?? [];
                if (rows.length === 0) return null;
                const catSubtotal = rows.reduce((s, r) => s + r.subtotal, 0);
                const colorClass  = CATEGORY_COLORS[cat];

                return (
                  <>
                    {/* Category header */}
                    <tr key={`hdr-${cat}`} className={`${colorClass} border-t border-b border-border-soft`}>
                      <td colSpan={4} className="px-4 py-2 font-semibold text-xs uppercase tracking-wide">
                        {cat}
                      </td>
                      <td className="px-4 py-2 text-right font-semibold text-xs">
                        {formatCurrency(catSubtotal)}
                      </td>
                    </tr>

                    {/* Category rows */}
                    {rows.map((row, idx) => (
                      <tr
                        key={`${cat}-${idx}`}
                        className="border-b border-border-soft hover:bg-surf-app transition-colors"
                      >
                        <td className="px-4 py-2 text-fg-700">{row.concept}</td>
                        <td className="px-3 py-2 text-fg-500">{row.unit}</td>
                        <td className="px-3 py-2 text-right text-fg-700 font-mono">
                          {Number.isInteger(row.qty) ? row.qty : row.qty.toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-right text-fg-600 font-mono">
                          {formatCurrency(row.price)}
                        </td>
                        <td className="px-4 py-2 text-right text-fg-800 font-semibold font-mono">
                          {formatCurrency(row.subtotal)}
                        </td>
                      </tr>
                    ))}
                  </>
                );
              })}

              {/* BOM Grand Total */}
              <tr className="bg-slate-800 text-white">
                <td colSpan={4} className="px-4 py-3 font-bold text-sm">Total Materials</td>
                <td className="px-4 py-3 text-right font-bold text-sm font-mono">{formatCurrency(bomTotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Project Cost Summary ──────────────────────────────────────────── */}
      {costSummary && (
        <div className="bg-surf-card rounded-xl shadow-sm border border-border-soft overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-border-soft">
            <FileText className="h-5 w-5 text-fg-500" />
            <h2 className="text-base font-semibold text-fg-800">Project Cost Summary</h2>
          </div>

          <div className="px-5 py-4">
            <table className="w-full text-sm max-w-lg">
              <tbody>
                {/* Materials + Labor + Risk → Subtotal */}
                <SummaryRow label="Materials Cost"   value={costSummary.materialsCostOnly} />
                <SummaryRow label="Labor Cost"       value={costSummary.totalLaborCost} />
                {costSummary.riskAmount > 0 && (
                  <SummaryRow
                    label={`Risk Factor (${costSummary.riskFactorPct}%)`}
                    value={costSummary.riskAmount}
                    muted
                  />
                )}
                <SummaryDivider />
                <SummaryRow label="Subtotal"         value={costSummary.materialsSubtotal + costSummary.riskAmount} bold />

                {/* Profit */}
                {costSummary.profitMarginAmount > 0 && (
                  <>
                    <SummaryRow label="Profit Margin" value={costSummary.profitMarginAmount} muted />
                    <SummaryDivider />
                  </>
                )}
                <SummaryRow label="Price (pre-tax)"  value={costSummary.price} bold />

                {/* Optional add-ons */}
                {costSummary.tariffAmount    > 0 && <SummaryRow label="Tariff"            value={costSummary.tariffAmount}    muted />}
                {costSummary.referralAmount  > 0 && <SummaryRow label="Referral"           value={costSummary.referralAmount}  muted />}
                {costSummary.taxAmount       > 0 && <SummaryRow label="Tax (IVA)"          value={costSummary.taxAmount}       muted />}
                {costSummary.installDeliveryMxn > 0 && <SummaryRow label="Install & Delivery" value={costSummary.installDeliveryMxn} muted />}
                {costSummary.otherExpenses   > 0 && <SummaryRow label={costSummary.otherExpensesLabel} value={costSummary.otherExpenses} muted />}

                {/* Grand Total */}
                <SummaryDivider thick />
                <SummaryRow label="Grand Total" value={costSummary.fullProjectTotal} grandTotal />
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Small helper sub-components ───────────────────────────────────────────────
function SummaryRow({
  label,
  value,
  bold = false,
  muted = false,
  grandTotal = false,
}: {
  label: string;
  value: number;
  bold?: boolean;
  muted?: boolean;
  grandTotal?: boolean;
}) {
  const rowClass = grandTotal
    ? 'bg-slate-800 text-white rounded'
    : '';
  const labelClass = grandTotal
    ? 'font-bold text-base py-3 pl-3'
    : bold
      ? 'font-semibold text-fg-800 py-2'
      : muted
        ? 'text-fg-500 py-1.5'
        : 'text-fg-700 py-1.5';
  const valueClass = grandTotal
    ? 'font-bold text-base py-3 pr-3 text-right font-mono'
    : bold
      ? 'font-semibold text-fg-800 py-2 text-right font-mono'
      : muted
        ? 'text-fg-500 py-1.5 text-right font-mono'
        : 'text-fg-700 py-1.5 text-right font-mono';

  return (
    <tr className={rowClass}>
      <td className={`${labelClass} w-[60%]`}>{label}</td>
      <td className={`${valueClass} w-[40%]`}>{formatCurrency(value)}</td>
    </tr>
  );
}

function SummaryDivider({ thick = false }: { thick?: boolean }) {
  return (
    <tr>
      <td colSpan={2} className={`py-0.5 ${thick ? 'border-t-2 border-border-solid' : 'border-t border-border-soft'}`} />
    </tr>
  );
}
