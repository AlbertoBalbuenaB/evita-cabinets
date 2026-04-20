/**
 * Bill of Materials + Project Cost Summary for the Breakdown tab.
 *
 * Uses the optimizer run data (actual boards from the engine) rather than
 * ft²-calculated sheets. Rendered after PerAreaBoardsBreakdown when a run
 * is loaded.
 *
 * BOM categories:
 *   Boards      — from loadedRun.result.boards[], grouped by stock id
 *   Edgeband    — recomputed from snapshot.pieces via computeEdgebandCost()
 *   Hardware    — from areas (same aggregation as QuotationBOM)
 *   Accessories — from areas
 *   Items       — from area.items[]
 *   Countertops — from area.countertops[]
 *
 * Cost Summary uses computeOptimizerQuotationTotal() — same calculation
 * as the quotation rollup in optimizer mode.
 */
import { useEffect, useMemo, useState } from 'react';
import { ShoppingCart, FileText } from 'lucide-react';
import { formatCurrency } from '../../../lib/calculations';
import { supabase } from '../../../lib/supabase';
import { useSettingsStore } from '../../../lib/settingsStore';
import {
  computeEdgebandCost,
  computeEdgebandRollsCost,
  type EbSlotMeta,
} from '../../../lib/optimizer/quotation/computeEdgebandCost';
import { computeQuotationTotals } from '../../../lib/pricing/computeQuotationTotals';
import { computeOptimizerTariffableMaterialsCost } from '../../../lib/optimizer/quotation/computeOptimizerAreaSubtotals';
import type { OptimizerRunSnapshot } from '../../../lib/optimizer/quotation/types';
import type { OptimizationResult } from '../../../lib/optimizer/types';
import type {
  PriceListItem,
  ProjectArea,
  AreaCabinet,
  AreaItem,
  AreaCountertop,
  AreaClosetItem,
  AreaPrefabItem,
  Quotation,
} from '../../../types';

type EnrichedArea = ProjectArea & {
  cabinets: AreaCabinet[];
  items: AreaItem[];
  countertops: AreaCountertop[];
  closetItems?: AreaClosetItem[];
  prefabItems?: AreaPrefabItem[];
};

export interface BreakdownBOMProps {
  loadedRun: {
    snapshot: OptimizerRunSnapshot;
    result: OptimizationResult;
    /** DB-persisted material_cost for the active run. When present, used
     *  as the `materialCost` input to computeQuotationTotals so Breakdown
     *  agrees with Info (which also reads from the DB row). Falls back
     *  to `result.totalCost` when absent (legacy or in-memory-only). */
    materialCostDb?: number;
    /** DB-persisted edgeband_cost, same rationale as materialCostDb.
     *  Falls back to the live recompute from snapshot + ebConfig. */
    edgebandCostDb?: number;
  };
  areas: EnrichedArea[];
  quotation: Quotation;
  /** Price list fetched by the parent (QuotationOptimizerTab) so the
   *  fetch can run in parallel with the optimizer store init instead of
   *  waiting for this component to mount. When `null` we fall back to
   *  fetching locally — backwards compatible. */
  priceList?: PriceListItem[] | null;
}

// ── Types ─────────────────────────────────────────────────────────────────────

type BOMCategory =
  | 'Boards'
  | 'Edgeband'
  | 'Hardware'
  | 'Accessories'
  | 'Interior Finish'
  | 'Door Profile'
  | 'Items'
  | 'Countertops'
  | 'Closet Items'
  | 'Prefab Items'
  | 'Fallback Cabinets';

const CATEGORY_ORDER: BOMCategory[] = [
  'Boards',
  'Edgeband',
  'Hardware',
  'Accessories',
  'Interior Finish',
  'Door Profile',
  'Items',
  'Countertops',
  'Closet Items',
  'Prefab Items',
  'Fallback Cabinets',
];

const CATEGORY_COLORS: Record<BOMCategory, string> = {
  'Boards':            'bg-amber-50 text-amber-800',
  'Edgeband':          'bg-purple-50 text-purple-800',
  'Hardware':          'bg-slate-100 text-slate-700',
  'Accessories':       'bg-green-50 text-green-800',
  'Interior Finish':   'bg-sky-50 text-sky-800',
  'Door Profile':      'bg-indigo-50 text-indigo-800',
  'Items':             'bg-orange-50 text-orange-800',
  'Countertops':       'bg-teal-50 text-teal-800',
  'Closet Items':      'bg-pink-50 text-pink-800',
  'Prefab Items':      'bg-red-50 text-red-800',
  'Fallback Cabinets': 'bg-yellow-50 text-yellow-800',
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

const ROLL_LENGTH_METERS = 150;

// ── Component ─────────────────────────────────────────────────────────────────

export function BreakdownBOM({ loadedRun, areas, quotation, priceList: priceListProp }: BreakdownBOMProps) {
  // Prop convention: `undefined` means no parent provided one (use local
  // fetch as fallback); `null` means parent is fetching (wait); array means
  // parent-fetched and ready. Arrays from the parent short-circuit the
  // local fetch, which saves a whole Supabase round-trip on Breakdown open.
  const hasProp = priceListProp !== undefined;
  const [priceListLocal, setPriceListLocal] = useState<PriceListItem[]>([]);
  const [loadingLocalPrices, setLoadingLocalPrices] = useState(!hasProp);
  const [exporting, setExporting] = useState(false);
  const exchangeRate = useSettingsStore(s => s.settings.exchangeRateUsdToMxn);

  useEffect(() => {
    if (hasProp) return;
    let cancelled = false;
    (async () => {
      try {
        const PAGE = 1000;
        let all: PriceListItem[] = [];
        let from = 0;
        while (true) {
          const { data, error } = await supabase
            .from('price_list')
            .select('*')
            .range(from, from + PAGE - 1);
          if (error || !data || data.length === 0) break;
          all = all.concat(data);
          if (data.length < PAGE) break;
          from += PAGE;
        }
        if (!cancelled) {
          setPriceListLocal(all);
          setLoadingLocalPrices(false);
        }
      } catch {
        if (!cancelled) setLoadingLocalPrices(false);
      }
    })();
    return () => { cancelled = true; };
  }, [hasProp]);

  const priceList = hasProp ? (priceListProp ?? []) : priceListLocal;
  const loadingPrices = hasProp ? priceListProp === null : loadingLocalPrices;

  // ── BOM aggregation ──────────────────────────────────────────────────────
  const bom = useMemo<BOMRow[] | null>(() => {
    if (loadingPrices) return null;

    const { snapshot, result } = loadedRun;
    const rows: BOMRow[] = [];

    // ── 1. Boards ────────────────────────────────────────────────────────
    const stockCountMap = new Map<string, number>();
    for (const board of result.boards) {
      stockCountMap.set(board.material, (stockCountMap.get(board.material) ?? 0) + 1);
    }
    for (const [stockId, count] of stockCountMap) {
      const stock = snapshot.stocks.find(s => s.nombre === stockId);
      if (!stock) continue;
      rows.push({
        category: 'Boards',
        concept: stock.nombre,
        unit: 'Board',
        qty: count,
        price: stock.costo,
        subtotal: count * stock.costo,
        priceListItemId: stock.materialId ?? null,
      });
    }

    // ── 2. Edgeband ───────────────────────────────────────────────────────
    // Per-cabinet pricing: uses ebCabinetMap when available (new snapshots)
    // to price each piece at its cabinet's actual edgeband rate. Falls back
    // to the legacy 3-slot system for old snapshots without ebCabinetMap.
    const ebPriceBySlot = {
      a: snapshot.ebConfig?.a?.price ?? 0,
      b: snapshot.ebConfig?.b?.price ?? 0,
      c: snapshot.ebConfig?.c?.price ?? 0,
    };
    // Slot → plId+name lookup so fallback-priced pieces (cabinets missing
    // from ebCabinetMap) still aggregate into perEdgebandType and appear in
    // the BOM. Without this, they silently drop out of the displayed total.
    const ebSlotMeta: EbSlotMeta = {
      a: snapshot.ebConfig?.a?.id && snapshot.ebConfig?.a?.name
        ? { plId: snapshot.ebConfig.a.id, name: snapshot.ebConfig.a.name }
        : undefined,
      b: snapshot.ebConfig?.b?.id && snapshot.ebConfig?.b?.name
        ? { plId: snapshot.ebConfig.b.id, name: snapshot.ebConfig.b.name }
        : undefined,
      c: snapshot.ebConfig?.c?.id && snapshot.ebConfig?.c?.name
        ? { plId: snapshot.ebConfig.c.id, name: snapshot.ebConfig.c.name }
        : undefined,
    };
    const ebResult = computeEdgebandCost(
      snapshot.pieces,
      ebPriceBySlot,
      snapshot.ebCabinetMap,
      ebSlotMeta,
    );

    // Prefer per-type breakdown (accurate for N edgeband types)
    const hasPerType = Object.keys(ebResult.perEdgebandType).length > 0;
    if (hasPerType) {
      for (const [plId, eb] of Object.entries(ebResult.perEdgebandType)) {
        if (eb.meters <= 0) continue;
        if (eb.name.toLowerCase().includes('not apply')) continue;
        const rollsNeeded = Math.ceil(eb.meters / ROLL_LENGTH_METERS);
        const pricePerMeter = eb.meters > 0 ? eb.cost / eb.meters : 0;
        const pricePerRoll = pricePerMeter * ROLL_LENGTH_METERS;
        rows.push({
          category: 'Edgeband',
          concept: eb.name,
          unit: `Roll (${ROLL_LENGTH_METERS}m)`,
          qty: rollsNeeded,
          price: pricePerRoll,
          subtotal: rollsNeeded * pricePerRoll,
          priceListItemId: plId,
        });
      }
    } else {
      // Legacy fallback: iterate 3 fixed slots
      for (const slot of ['a', 'b', 'c'] as const) {
        const { meters } = ebResult.perSlot[slot];
        if (meters <= 0) continue;
        const ebConfig = snapshot.ebConfig?.[slot];
        if (!ebConfig || !ebConfig.name || ebConfig.name.toLowerCase().includes('not apply')) continue;
        const rollsNeeded = Math.ceil(meters / ROLL_LENGTH_METERS);
        const pricePerRoll = (ebConfig.price ?? 0) * ROLL_LENGTH_METERS;
        rows.push({
          category: 'Edgeband',
          concept: ebConfig.name,
          unit: `Roll (${ROLL_LENGTH_METERS}m)`,
          qty: rollsNeeded,
          price: pricePerRoll,
          subtotal: rollsNeeded * pricePerRoll,
          priceListItemId: snapshot.ebSlotToPriceListId?.[slot] ?? null,
        });
      }
    }

    // ── 3. Hardware ───────────────────────────────────────────────────────
    const hardwareMap = new Map<string, BOMRow>();
    areas.forEach(area => {
      const areaQty = area.quantity ?? 1;
      area.cabinets.forEach(cabinet => {
        const effectiveQty = cabinet.quantity * areaQty;
        if (!Array.isArray(cabinet.hardware)) return;
        (cabinet.hardware as any[]).forEach((hw: any) => {
          const hwId = hw.hardware_id || hw.priceListId;
          if (!hwId) return;
          const item = priceList.find(p => p.id === hwId);
          if (!item || item.concept_description.toLowerCase().includes('not apply')) return;
          const qty = (hw.quantity_per_cabinet || hw.quantity || 1) * effectiveQty;
          const unitPrice = item.price_with_tax ?? item.price;
          if (hardwareMap.has(hwId)) {
            const row = hardwareMap.get(hwId)!;
            row.qty += qty;
            row.subtotal = row.qty * row.price;
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
      });
    });
    hardwareMap.forEach(row => { if (row.qty > 0 && row.subtotal > 0) rows.push(row); });

    // ── 4. Accessories ────────────────────────────────────────────────────
    const accessoriesMap = new Map<string, BOMRow>();
    areas.forEach(area => {
      const areaQty = area.quantity ?? 1;
      area.cabinets.forEach(cabinet => {
        const effectiveQty = cabinet.quantity * areaQty;
        if (!Array.isArray(cabinet.accessories)) return;
        (cabinet.accessories as any[]).forEach((acc: any) => {
          const accId = acc.accessory_id;
          if (!accId) return;
          const item = priceList.find(p => p.id === accId);
          if (!item || item.concept_description.toLowerCase().includes('not apply')) return;
          const qty = (acc.quantity_per_cabinet || 1) * effectiveQty;
          const unitPrice = item.price_with_tax ?? item.price;
          if (accessoriesMap.has(accId)) {
            const row = accessoriesMap.get(accId)!;
            row.qty += qty;
            row.subtotal = row.qty * row.price;
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
      });
    });
    accessoriesMap.forEach(row => { if (row.qty > 0 && row.subtotal > 0) rows.push(row); });

    // ── 5. Items ──────────────────────────────────────────────────────────
    // Aggregate across areas by (price_list_item_id ?? item_name) + unit_price
    // so the same item appearing in multiple areas shows as one row.
    const itemsMap = new Map<string, BOMRow>();
    areas.forEach(area => {
      const areaQty = area.quantity ?? 1;
      area.items.forEach(item => {
        const qty = item.quantity * areaQty;
        if (qty <= 0) return;
        const key = (item.price_list_item_id ?? item.item_name) + '|' + item.unit_price;
        const plItem = priceList.find(p => p.id === item.price_list_item_id);
        if (itemsMap.has(key)) {
          const row = itemsMap.get(key)!;
          row.qty += qty;
          row.subtotal = row.qty * row.price;
        } else {
          itemsMap.set(key, {
            category: 'Items',
            concept: item.item_name,
            unit: (plItem as any)?.unit || 'pcs',
            qty,
            price: item.unit_price,
            subtotal: item.unit_price * qty,
            priceListItemId: item.price_list_item_id,
          });
        }
      });
    });
    itemsMap.forEach(row => { if (row.qty > 0) rows.push(row); });

    // ── 6. Countertops ────────────────────────────────────────────────────
    const countertopsMap = new Map<string, BOMRow>();
    areas.forEach(area => {
      const areaQty = area.quantity ?? 1;
      area.countertops.forEach(ct => {
        const qty = ct.quantity * areaQty;
        if (qty <= 0) return;
        const key = (ct.price_list_item_id ?? ct.item_name) + '|' + ct.unit_price;
        const plItem = priceList.find(p => p.id === ct.price_list_item_id);
        if (countertopsMap.has(key)) {
          const row = countertopsMap.get(key)!;
          row.qty += qty;
          row.subtotal = row.qty * row.price;
        } else {
          countertopsMap.set(key, {
            category: 'Countertops',
            concept: ct.item_name,
            unit: (plItem as any)?.unit || 'lft',
            qty,
            price: ct.unit_price,
            subtotal: ct.unit_price * qty,
            priceListItemId: ct.price_list_item_id,
          });
        }
      });
    });
    countertopsMap.forEach(row => { if (row.qty > 0) rows.push(row); });

    // ── 7. Interior Finish ────────────────────────────────────────────────
    // Aggregated cost of interior finish (applied to box + doors) across
    // every cabinet × area quantity. Surfaced as a single BOM row so that
    // the BOM total matches the "Materials Cost" line in the Cost Summary
    // (which derives from totals.byCategory.interiorFinish).
    let interiorFinishTotal = 0;
    areas.forEach(area => {
      const areaQty = area.quantity ?? 1;
      area.cabinets.forEach(cabinet => {
        interiorFinishTotal +=
          ((cabinet.box_interior_finish_cost ?? 0) +
            (cabinet.doors_interior_finish_cost ?? 0)) * areaQty;
      });
    });
    if (interiorFinishTotal > 0) {
      rows.push({
        category: 'Interior Finish',
        concept: 'Box + Doors Interior Finish',
        unit: 'project',
        qty: 1,
        price: interiorFinishTotal,
        subtotal: interiorFinishTotal,
        priceListItemId: null,
      });
    }

    // ── 8. Door Profile ───────────────────────────────────────────────────
    let doorProfileTotal = 0;
    areas.forEach(area => {
      const areaQty = area.quantity ?? 1;
      area.cabinets.forEach(cabinet => {
        doorProfileTotal += (cabinet.door_profile_cost ?? 0) * areaQty;
      });
    });
    if (doorProfileTotal > 0) {
      rows.push({
        category: 'Door Profile',
        concept: 'Door Profile',
        unit: 'project',
        qty: 1,
        price: doorProfileTotal,
        subtotal: doorProfileTotal,
        priceListItemId: null,
      });
    }

    // ── 9. Closet Items (Evita Plus/Premium) ─────────────────────────────
    const closetItemsMap = new Map<string, BOMRow>();
    areas.forEach(area => {
      const areaQty = area.quantity ?? 1;
      (area.closetItems ?? []).forEach(ci => {
        const qty = (ci.quantity ?? 1) * areaQty;
        const lineTotal = (ci.subtotal_mxn ?? 0) * areaQty;
        if (lineTotal <= 0) return;
        const concept =
          ci.catalog_item?.description ??
          ci.catalog_item?.cabinet_code ??
          `Closet ${ci.closet_catalog_id?.slice(0, 8) ?? ''}`;
        const key = `${ci.closet_catalog_id}|${ci.unit_price_mxn}`;
        if (closetItemsMap.has(key)) {
          const row = closetItemsMap.get(key)!;
          row.qty += qty;
          row.subtotal += lineTotal;
        } else {
          closetItemsMap.set(key, {
            category: 'Closet Items',
            concept,
            unit: 'pcs',
            qty,
            price: qty > 0 ? lineTotal / qty : 0,
            subtotal: lineTotal,
            priceListItemId: null,
          });
        }
      });
    });
    closetItemsMap.forEach(row => { if (row.subtotal > 0) rows.push(row); });

    // ── 10. Prefab Items (Venus / Northville) ─────────────────────────────
    const prefabItemsMap = new Map<string, BOMRow>();
    areas.forEach(area => {
      const areaQty = area.quantity ?? 1;
      (area.prefabItems ?? []).forEach(pi => {
        const qty = (pi.quantity ?? 1) * areaQty;
        const lineTotal = (pi.cost_mxn ?? 0) * areaQty;
        if (lineTotal <= 0) return;
        const concept =
          pi.catalog_item?.description ??
          pi.catalog_item?.cabinet_code ??
          `Prefab ${pi.prefab_catalog_id?.slice(0, 8) ?? ''}`;
        const key = `${pi.prefab_catalog_id}|${pi.finish}|${pi.cost_usd}`;
        if (prefabItemsMap.has(key)) {
          const row = prefabItemsMap.get(key)!;
          row.qty += qty;
          row.subtotal += lineTotal;
        } else {
          prefabItemsMap.set(key, {
            category: 'Prefab Items',
            concept,
            unit: 'pcs',
            qty,
            price: qty > 0 ? lineTotal / qty : 0,
            subtotal: lineTotal,
            priceListItemId: null,
          });
        }
      });
    });
    prefabItemsMap.forEach(row => { if (row.subtotal > 0) rows.push(row); });

    // ── 11. Fallback Cabinets (mixed mode — not packed by optimizer) ─────
    // Raw board + edgeband cost for cabinets the optimizer couldn't pack.
    // Other categories (hardware, labor, interior finish, etc.) are already
    // aggregated in their own rows — this row is ONLY the ft²-estimated
    // board/edgeband cost that the optimizer's `Boards` and `Edgeband`
    // rows miss for uncovered cabinets.
    const cabinetsCovered = new Set(snapshot.cabinetsCovered);
    let fallbackMatTotal = 0;
    areas.forEach(area => {
      const areaQty = area.quantity ?? 1;
      area.cabinets.forEach(cabinet => {
        if (cabinetsCovered.has(cabinet.id)) return;
        fallbackMatTotal +=
          ((cabinet.box_material_cost ?? 0) +
            (cabinet.box_edgeband_cost ?? 0) +
            (cabinet.doors_material_cost ?? 0) +
            (cabinet.doors_edgeband_cost ?? 0) +
            (cabinet.back_panel_material_cost ?? 0) +
            (cabinet.drawer_box_material_cost ?? 0) +
            (cabinet.drawer_box_edgeband_cost ?? 0) +
            (cabinet.shelf_material_cost ?? 0) +
            (cabinet.shelf_edgeband_cost ?? 0)) *
          areaQty;
      });
    });
    if (fallbackMatTotal > 0) {
      rows.push({
        category: 'Fallback Cabinets',
        concept: 'Cabinets not packed by optimizer (ft² boards + edgeband)',
        unit: 'project',
        qty: 1,
        price: fallbackMatTotal,
        subtotal: fallbackMatTotal,
        priceListItemId: null,
      });
    }

    return rows;
  }, [loadedRun, areas, priceList, loadingPrices]);

  // ── Cost Summary ─────────────────────────────────────────────────────────
  const costSummary = useMemo(() => {
    if (!bom) return null;

    const { snapshot, result } = loadedRun;
    const ebPriceBySlot = {
      a: snapshot.ebConfig?.a?.price ?? 0,
      b: snapshot.ebConfig?.b?.price ?? 0,
      c: snapshot.ebConfig?.c?.price ?? 0,
    };
    // Same slot meta used in the BOM aggregation above — keeps the fallback
    // pieces (cabinets missing from ebCabinetMap) counted consistently.
    const ebSlotMeta: EbSlotMeta = {
      a: snapshot.ebConfig?.a?.id && snapshot.ebConfig?.a?.name
        ? { plId: snapshot.ebConfig.a.id, name: snapshot.ebConfig.a.name }
        : undefined,
      b: snapshot.ebConfig?.b?.id && snapshot.ebConfig?.b?.name
        ? { plId: snapshot.ebConfig.b.id, name: snapshot.ebConfig.b.name }
        : undefined,
      c: snapshot.ebConfig?.c?.id && snapshot.ebConfig?.c?.name
        ? { plId: snapshot.ebConfig.c.id, name: snapshot.ebConfig.c.name }
        : undefined,
    };
    const ebResult = computeEdgebandCost(
      snapshot.pieces,
      ebPriceBySlot,
      snapshot.ebCabinetMap,
      ebSlotMeta,
    );
    const cabinetsCovered = new Set(snapshot.cabinetsCovered);
    const installDeliveryMxn = (quotation.install_delivery_usd ?? 0) * (exchangeRate || 1);

    // Normalise area shape once so both helpers see the same data.
    const normalisedAreas = areas.map(a => ({ ...a, closetItems: a.closetItems ?? [] }));

    // Proportional tariffable-materials allocation (mirrors the rule used
    // by ProjectDetails so the Breakdown BOM summary agrees with the
    // UI and the PDF exports). Reads edgebandByCabinet from the persisted
    // snapshot — same source Info uses — so the tariff allocation matches
    // exactly; falling back to the live recompute only if the snapshot
    // predates the edgebandCostByCabinet field.
    const tariffableMaterialsCost = computeOptimizerTariffableMaterialsCost({
      result,
      snapshot,
      areasData: normalisedAreas,
      edgebandByCabinet: snapshot.edgebandCostByCabinet ?? ebResult.perCabinet,
    });

    const riskAppliesOptimizer = quotation.risk_factor_applies_optimizer ?? false;
    const riskPct = riskAppliesOptimizer ? (quotation.risk_factor_percentage ?? 0) : 0;
    const totals = computeQuotationTotals({
      pricingMethod: 'optimizer',
      areasData: normalisedAreas,
      multipliers: {
        profitMultiplier: quotation.profit_multiplier        ?? 0,
        tariffMultiplier: quotation.tariff_multiplier        ?? 0,
        referralRate:     quotation.referral_currency_rate   ?? 0,
        taxPercentage:    quotation.tax_percentage           ?? 0,
        installDeliveryMxn,
        otherExpenses:    quotation.other_expenses           ?? 0,
        riskFactorPct:    riskPct,
      },
      optimizerRun: {
        // Boards cost: DB-persisted value (computed at optimizer save time
        // from result.boards × stock.costo; Info reads the same row).
        materialCost: loadedRun.materialCostDb ?? result.totalCost,
        // Edgeband cost: whole-roll rounding per edgeband type, mirroring
        // ft² mode (edgeband is sold by the roll). The DB-persisted
        // edgeband_cost is meters × price — kept for history but NOT used
        // for pricing since it would underprice the roll-denominated
        // purchase cost. Info and this path use the same computation so
        // Materials Cost converges exactly with the BOM footer.
        edgebandCost: computeEdgebandRollsCost(
          snapshot.pieces,
          ebPriceBySlot,
          snapshot.ebCabinetMap,
          ebSlotMeta,
        ),
        cabinetsCovered,
        tariffableMaterialsCost,
      },
    });

    // Displayed Materials / Subtotal / Profit come from the unified totals so
    // Breakdown converges with the Info tab exactly. The BOM table footer
    // (bomTotal) is a separate sourcing view and keeps its own sum.
    const labor = totals.byCategory.labor;
    return {
      materialsCostOnly:  totals.materialsSubtotal - labor,
      totalLaborCost:     labor,
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
  }, [bom, loadedRun, areas, quotation, exchangeRate]);

  // ── Export to Purchases ──────────────────────────────────────────────────
  async function handleExportToPurchases() {
    if (!bom || bom.length === 0 || exporting) return;
    setExporting(true);
    try {
      const { data: existing } = await supabase
        .from('project_purchase_items')
        .select('display_order')
        .eq('project_id', quotation.project_id)
        .order('display_order', { ascending: false })
        .limit(1);

      const maxOrder = (existing?.[0]?.display_order ?? -1) as number;

      const insertRows = bom
        .filter(r => r.qty > 0)
        .map((r, i) => ({
          project_id:           quotation.project_id,
          concept:              r.concept,
          quantity:             r.qty,
          unit:                 r.unit,
          price:                r.price,
          price_list_item_id:   r.priceListItemId,
          status:               'Ordered' as const,
          display_order:        maxOrder + 1 + i,
        }));

      const { error } = await supabase.from('project_purchase_items').insert(insertRows);
      if (error) throw error;
      alert(`${insertRows.length} item${insertRows.length !== 1 ? 's' : ''} exported to Purchases successfully.`);
    } catch (err) {
      console.error('Error exporting BOM to purchases:', err);
      alert('Error exporting to Purchases. Please try again.');
    } finally {
      setExporting(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (loadingPrices) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6 text-center text-slate-500 text-sm">
        Loading Bill of Materials…
      </div>
    );
  }

  if (!bom || bom.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6 text-center text-slate-400 text-sm">
        No materials found for this run.
      </div>
    );
  }

  const grouped = new Map<BOMCategory, BOMRow[]>();
  CATEGORY_ORDER.forEach(cat => grouped.set(cat, []));
  bom.forEach(row => grouped.get(row.category)?.push(row));
  const bomTotal = bom.reduce((s, r) => s + r.subtotal, 0);

  return (
    <div className="space-y-6">
      {/* ── BOM Table ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-slate-500" />
            <h2 className="text-base font-semibold text-slate-800">Bill of Materials</h2>
            <span className="ml-1 text-xs text-slate-400 font-normal">({bom.length} items)</span>
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

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-2.5 font-semibold text-slate-600 w-[40%]">Concept</th>
                <th className="text-left px-3 py-2.5 font-semibold text-slate-600 w-[12%]">Unit</th>
                <th className="text-right px-3 py-2.5 font-semibold text-slate-600 w-[10%]">Qty</th>
                <th className="text-right px-3 py-2.5 font-semibold text-slate-600 w-[16%]">Price</th>
                <th className="text-right px-4 py-2.5 font-semibold text-slate-600 w-[16%]">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {CATEGORY_ORDER.map(cat => {
                const catRows = grouped.get(cat) ?? [];
                if (catRows.length === 0) return null;
                const catSubtotal = catRows.reduce((s, r) => s + r.subtotal, 0);
                const colorClass = CATEGORY_COLORS[cat];
                return (
                  <>
                    <tr key={`hdr-${cat}`} className={`${colorClass} border-t border-b border-slate-200`}>
                      <td colSpan={4} className="px-4 py-2 font-semibold text-xs uppercase tracking-wide">
                        {cat}
                      </td>
                      <td className="px-4 py-2 text-right font-semibold text-xs">
                        {formatCurrency(catSubtotal)}
                      </td>
                    </tr>
                    {catRows.map((row, idx) => (
                      <tr
                        key={`${cat}-${idx}`}
                        className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                      >
                        <td className="px-4 py-2 text-slate-700">{row.concept}</td>
                        <td className="px-3 py-2 text-slate-500">{row.unit}</td>
                        <td className="px-3 py-2 text-right text-slate-700 font-mono">
                          {Number.isInteger(row.qty) ? row.qty : row.qty.toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-right text-slate-600 font-mono">
                          {formatCurrency(row.price)}
                        </td>
                        <td className="px-4 py-2 text-right text-slate-800 font-semibold font-mono">
                          {formatCurrency(row.subtotal)}
                        </td>
                      </tr>
                    ))}
                  </>
                );
              })}
              <tr className="bg-slate-800 text-white">
                <td colSpan={4} className="px-4 py-3 font-bold text-sm">Total Materials</td>
                <td className="px-4 py-3 text-right font-bold text-sm font-mono">{formatCurrency(bomTotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Project Cost Summary ──────────────────────────────────────── */}
      {costSummary && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-200">
            <FileText className="h-5 w-5 text-slate-500" />
            <h2 className="text-base font-semibold text-slate-800">Project Cost Summary</h2>
          </div>
          <div className="px-5 py-4 flex justify-end">
            <table className="text-sm w-full max-w-lg">
              <tbody>
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

                {costSummary.profitMarginAmount > 0 && (
                  <>
                    <SummaryRow label="Profit Margin" value={costSummary.profitMarginAmount} muted />
                    <SummaryDivider />
                  </>
                )}
                <SummaryRow label="Price (pre-tax)"  value={costSummary.price} bold />

                {costSummary.tariffAmount      > 0 && <SummaryRow label="Tariff"              value={costSummary.tariffAmount}     muted />}
                {costSummary.referralAmount    > 0 && <SummaryRow label="Referral"             value={costSummary.referralAmount}   muted />}
                {costSummary.taxAmount         > 0 && <SummaryRow label="Tax (IVA)"            value={costSummary.taxAmount}        muted />}
                {costSummary.installDeliveryMxn > 0 && <SummaryRow label="Install & Delivery"  value={costSummary.installDeliveryMxn} muted />}
                {costSummary.otherExpenses     > 0 && <SummaryRow label={costSummary.otherExpensesLabel} value={costSummary.otherExpenses} muted />}

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

// ── Summary sub-components ────────────────────────────────────────────────────
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
  const rowClass = grandTotal ? 'bg-slate-800 text-white rounded' : '';
  const labelClass = grandTotal
    ? 'font-bold text-base py-3 pl-3'
    : bold
      ? 'font-semibold text-slate-800 py-2'
      : muted
        ? 'text-slate-500 py-1.5'
        : 'text-slate-700 py-1.5';
  const valueClass = grandTotal
    ? 'font-bold text-base py-3 pr-3 text-right font-mono'
    : bold
      ? 'font-semibold text-slate-800 py-2 text-right font-mono'
      : muted
        ? 'text-slate-500 py-1.5 text-right font-mono'
        : 'text-slate-700 py-1.5 text-right font-mono';

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
      <td colSpan={2} className={`py-0.5 ${thick ? 'border-t-2 border-slate-300' : 'border-t border-slate-200'}`} />
    </tr>
  );
}
