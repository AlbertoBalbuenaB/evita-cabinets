import { useMemo } from 'react';
import { BarChart3, Package, Truck, TrendingUp, DollarSign, Layers, Boxes } from 'lucide-react';
import { formatCurrency } from '../lib/calculations';
import { countActualCabinets } from '../lib/cabinetFilters';
import { calculateAreaBoxesAndPallets } from '../lib/boxesAndPallets';
import { getCabinetTotalCost } from '../lib/pricing/getCabinetTotalCost';
import type { ProjectArea, AreaCabinet, AreaItem, AreaCountertop, AreaClosetItem, Product } from '../types';

/** Live recompute of a cabinet's total cost; falls back to the cached
 *  `subtotal` field for legacy data. Mirrors the rule used by
 *  computeQuotationTotalsSqft / computeOptimizerQuotationTotal so the
 *  Analytics tab agrees with the Info and Breakdown tabs. */
function cabSubtotal(c: AreaCabinet): number {
  const live = getCabinetTotalCost(c as unknown as Record<string, unknown>);
  return live > 0 ? live : (c.subtotal ?? 0);
}

type EnrichedArea = ProjectArea & {
  cabinets: AreaCabinet[];
  items: AreaItem[];
  countertops: AreaCountertop[];
  closetItems?: AreaClosetItem[];
};

interface ProjectChartsProps {
  areas: EnrichedArea[];
  products: Product[];
  /**
   * Current pricing method for the quotation. When 'optimizer' AND
   * `optimizerOverrides` is provided, the charts below source their
   * per-area cabinet totals + materials breakdown from the optimizer run
   * instead of the sqft per-cabinet fields. Backwards compatible — when
   * this prop is omitted the component behaves exactly as before.
   */
  pricingMethod?: 'sqft' | 'optimizer';
  /**
   * Risk factor amount from `quotationView.riskAmount` (already scoped to
   * the active pricing path via the applies_{sqft,optimizer} flags).
   * Rolled into the "Project Value" KPI so Analytics reflects the same
   * Subtotal shown in Breakdown's Project Cost Summary (Materials + Labor
   * + Risk). Default 0 keeps the pre-risk-factor behaviour.
   */
  riskAmount?: number;
  riskFactorPct?: number;
  optimizerOverrides?: {
    /** From `quotationView.perAreaCabinetSubtotal` — per-area cabinet cost in optimizer mode (no quantity multiplier). */
    perAreaCabinetSubtotal: Record<string, number>;
    /** Full per-category breakdown from the unified totals. Mandatory for
     *  the materials breakdown + Project Value KPI to agree with Info. */
    byCategory: {
      boards: number;
      edgeband: number;
      hardware: number;
      accessories: number;
      interiorFinish: number;
      doorProfile: number;
      labor: number;
      items: number;
      countertops: number;
      closetItems: number;
      prefabItems: number;
    };
    /** Materials subtotal from the unified totals — the authoritative
     *  "Project Value" number. Matches Info's Materials Subtotal exactly. */
    materialsSubtotal: number;
  };
}

const COLOR_PALETTE: Record<string, string> = {
  'bg-blue-500': '#3b82f6',
  'bg-blue-400': '#60a5fa',
  'bg-blue-300': '#93c5fd',
  'bg-green-500': '#22c55e',
  'bg-green-400': '#4ade80',
  'bg-green-300': '#86efac',
  'bg-amber-500': '#f59e0b',
  'bg-amber-600': '#d97706',
  'bg-orange-500': '#f97316',
  'bg-teal-500': '#14b8a6',
  'bg-red-500': '#ef4444',
  'bg-slate-500': '#64748b',
};

function KpiCard({
  label,
  value,
  sub,
  icon,
  accent = 'text-slate-900',
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  icon: React.ReactNode;
  accent?: string;
}) {
  return (
    <div className="glass-blue p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</span>
        <span className="text-slate-300">{icon}</span>
      </div>
      <div className={`text-2xl font-bold leading-none ${accent}`}>{value}</div>
      {sub && <div className="text-xs text-slate-400">{sub}</div>}
    </div>
  );
}

export function ProjectCharts({ areas, products, pricingMethod, riskAmount = 0, riskFactorPct = 0, optimizerOverrides }: ProjectChartsProps) {
  const isOptimizerMode = pricingMethod === 'optimizer' && optimizerOverrides != null;

  const analytics = useMemo(() => {
    const calculateTaxesForArea = (cabinets: AreaCabinet[], areaQty: number) => {
      return cabinets.reduce((sum, cabinet) => {
        const totalBaseCost =
          (cabinet.box_material_cost ?? 0) + (cabinet.box_edgeband_cost ?? 0) + (cabinet.box_interior_finish_cost ?? 0) +
          (cabinet.doors_material_cost ?? 0) + (cabinet.doors_edgeband_cost ?? 0) + (cabinet.doors_interior_finish_cost ?? 0) +
          (cabinet.hardware_cost ?? 0);
        const taxAmount = cabSubtotal(cabinet) - (cabinet.labor_cost ?? 0) - totalBaseCost;
        return sum + Math.max(0, taxAmount);
      }, 0) * areaQty;
    };

    const areasCosts = areas.map((area) => {
      const areaQty = area.quantity ?? 1;
      // Cabinets portion switches on pricing method: sqft sums cabinet.subtotal
      // (raw per-cabinet fields); optimizer uses the per-area allocated cost
      // from quotationView.perAreaCabinetSubtotal (board + edgeband share +
      // non-material extras + ft² fallback for skipped cabinets).
      const cabinetsTotal = isOptimizerMode
        ? (optimizerOverrides!.perAreaCabinetSubtotal[area.id] ?? 0) * areaQty
        : (area.cabinets || []).reduce((sum, c) => sum + cabSubtotal(c), 0) * areaQty;
      const itemsTotal = (area.items || []).reduce((sum, i) => sum + i.subtotal, 0) * areaQty;
      const countertopsTotal = (area.countertops || []).reduce((sum, ct) => sum + ct.subtotal, 0) * areaQty;
      const closetItemsTotal = (area.closetItems || []).reduce((sum, ci) => sum + ci.subtotal_mxn, 0) * areaQty;
      const cabinetsCount = countActualCabinets(area.cabinets || []) * areaQty;
      const displayName = areaQty > 1 ? `${area.name} (x${areaQty})` : area.name;
      return {
        name: displayName,
        quantity: areaQty,
        total: cabinetsTotal + itemsTotal + countertopsTotal + closetItemsTotal,
        cabinets: cabinetsCount,
        items: (area.items || []).length,
        countertops: (area.countertops || []).length,
        closetItems: (area.closetItems || []).length,
        cabinetsRaw: cabinetsTotal,
        itemsRaw: itemsTotal,
        countertopsRaw: countertopsTotal,
        closetItemsRaw: closetItemsTotal,
      };
    });

    const totalItemsCost = areas.reduce(
      (sum, area) => sum + (area.items || []).reduce((s, i) => s + i.subtotal, 0) * (area.quantity ?? 1),
      0
    );
    const totalCountertopsCost = areas.reduce(
      (sum, area) => sum + (area.countertops || []).reduce((s, ct) => s + ct.subtotal, 0) * (area.quantity ?? 1),
      0
    );
    const totalClosetItemsCost = areas.reduce(
      (sum, area) => sum + (area.closetItems || []).reduce((s, ci) => s + ci.subtotal_mxn, 0) * (area.quantity ?? 1),
      0
    );

    const totalProjectTaxes = areas.reduce(
      (sum, area) => sum + calculateTaxesForArea(area.cabinets || [], area.quantity ?? 1),
      0
    );

    const materialsCosts = {
      boxMaterial: areas.reduce((sum, area) => sum + (area.cabinets || []).reduce((s, c) => s + (c.box_material_cost ?? 0), 0) * (area.quantity ?? 1), 0),
      boxEdgeband: areas.reduce((sum, area) => sum + (area.cabinets || []).reduce((s, c) => s + (c.box_edgeband_cost ?? 0), 0) * (area.quantity ?? 1), 0),
      boxInterior: areas.reduce((sum, area) => sum + (area.cabinets || []).reduce((s, c) => s + (c.box_interior_finish_cost ?? 0), 0) * (area.quantity ?? 1), 0),
      doorsMaterial: areas.reduce((sum, area) => sum + (area.cabinets || []).reduce((s, c) => s + (c.doors_material_cost ?? 0), 0) * (area.quantity ?? 1), 0),
      doorsEdgeband: areas.reduce((sum, area) => sum + (area.cabinets || []).reduce((s, c) => s + (c.doors_edgeband_cost ?? 0), 0) * (area.quantity ?? 1), 0),
      doorsInterior: areas.reduce((sum, area) => sum + (area.cabinets || []).reduce((s, c) => s + (c.doors_interior_finish_cost ?? 0), 0) * (area.quantity ?? 1), 0),
      hardware: areas.reduce((sum, area) => sum + (area.cabinets || []).reduce((s, c) => s + (c.hardware_cost ?? 0), 0) * (area.quantity ?? 1), 0),
      labor: areas.reduce((sum, area) => sum + (area.cabinets || []).reduce((s, c) => s + (c.labor_cost ?? 0), 0) * (area.quantity ?? 1), 0),
      taxes: totalProjectTaxes,
    };

    // In optimizer mode, read every category directly from the unified
    // `byCategory` breakdown (same source the Info tab uses), so Analytics
    // agrees with Info's Materials Subtotal to the cent. Categories that
    // were previously missing from the optimizer-mode breakdown and caused
    // the "Project Value" to diverge: Accessories, Interior Finish,
    // Door Profile, Prefab Items. All included now.
    //
    // In sqft mode the legacy per-category view is kept — it's the
    // pre-existing breakdown and changing it is out of scope for this fix.
    const materialsBreakdown = (
      isOptimizerMode
        ? [
            { name: 'Boards (optimizer)',   cost: optimizerOverrides!.byCategory.boards,         color: 'bg-blue-500' },
            { name: 'Edgeband (optimizer)', cost: optimizerOverrides!.byCategory.edgeband,       color: 'bg-amber-500' },
            { name: 'Interior Finish',      cost: optimizerOverrides!.byCategory.interiorFinish, color: 'bg-blue-300' },
            { name: 'Door Profile',         cost: optimizerOverrides!.byCategory.doorProfile,    color: 'bg-green-400' },
            { name: 'Hardware',             cost: optimizerOverrides!.byCategory.hardware,       color: 'bg-amber-600' },
            { name: 'Accessories',          cost: optimizerOverrides!.byCategory.accessories,    color: 'bg-green-300' },
            { name: 'Countertops',          cost: optimizerOverrides!.byCategory.countertops,    color: 'bg-orange-500' },
            { name: 'Prefab Closets',       cost: optimizerOverrides!.byCategory.closetItems,    color: 'bg-teal-500' },
            { name: 'Prefab Items',         cost: optimizerOverrides!.byCategory.prefabItems,    color: 'bg-red-500' },
            { name: 'Individual Items',     cost: optimizerOverrides!.byCategory.items,          color: 'bg-green-500' },
            { name: 'Labor',                cost: optimizerOverrides!.byCategory.labor,          color: 'bg-slate-500' },
          ]
        : [
            { name: 'Box Material', cost: materialsCosts.boxMaterial, color: 'bg-blue-500' },
            { name: 'Box Edgeband', cost: materialsCosts.boxEdgeband, color: 'bg-blue-400' },
            { name: 'Box Interior', cost: materialsCosts.boxInterior, color: 'bg-blue-300' },
            { name: 'Doors Material', cost: materialsCosts.doorsMaterial, color: 'bg-green-500' },
            { name: 'Doors Edgeband', cost: materialsCosts.doorsEdgeband, color: 'bg-green-400' },
            { name: 'Doors Interior', cost: materialsCosts.doorsInterior, color: 'bg-green-300' },
            { name: 'Hardware', cost: materialsCosts.hardware, color: 'bg-amber-500' },
            { name: 'Countertops', cost: totalCountertopsCost, color: 'bg-orange-500' },
            { name: 'Prefab Closets', cost: totalClosetItemsCost, color: 'bg-teal-500' },
            { name: 'Individual Items', cost: totalItemsCost, color: 'bg-amber-600' },
            { name: 'Taxes', cost: materialsCosts.taxes, color: 'bg-red-500' },
            { name: 'Labor', cost: materialsCosts.labor, color: 'bg-slate-500' },
          ]
    ).filter((item) => item.cost > 0);

    // In optimizer mode, the "Project Value" KPI is the authoritative
    // materialsSubtotal from the unified totals — this includes the ft²
    // fallback for cabinets the optimizer couldn't pack (mixed mode),
    // which a simple sum of breakdown categories would miss. In sqft mode
    // keep the legacy behaviour (sum of breakdown). We then add `riskAmount`
    // so "Project Value" matches the "Subtotal" shown in Breakdown's
    // Project Cost Summary (Materials + Labor + Risk).
    const materialsPreRisk = isOptimizerMode
      ? optimizerOverrides!.materialsSubtotal
      : materialsBreakdown.reduce((sum, item) => sum + item.cost, 0);
    const totalCost = materialsPreRisk + riskAmount;
    const maxAreaCost = Math.max(...areasCosts.map((a) => a.total), 1);
    const maxMaterialCost = Math.max(...materialsBreakdown.map((m) => m.cost), 1);

    const totalCabinets = areas.reduce(
      (sum, area) => sum + countActualCabinets(area.cabinets || []) * (area.quantity ?? 1),
      0
    );
    const totalSKUs = new Set(areas.flatMap((a) => (a.cabinets || []).map((c) => c.product_sku))).size;
    // In optimizer mode this sums the allocated per-area optimizer values;
    // in sqft mode it sums raw cabinet.subtotal. The distinction feeds
    // `avgCostPerCabinet` below, which is the "Avg / Cabinet" KPI.
    const cabinetsCost = isOptimizerMode
      ? areas.reduce(
          (sum, area) =>
            sum +
            (optimizerOverrides!.perAreaCabinetSubtotal[area.id] ?? 0) * (area.quantity ?? 1),
          0,
        )
      : areas.reduce(
          (sum, area) => sum + (area.cabinets || []).reduce((s, c) => s + cabSubtotal(c), 0) * (area.quantity ?? 1),
          0
        );
    const avgCostPerCabinet = totalCabinets > 0 ? cabinetsCost / totalCabinets : 0;
    const totalEffectiveAreas = areas.reduce((sum, area) => sum + (area.quantity ?? 1), 0);

    const totalBoxes = areas.reduce((sum, area) => {
      const { boxes } = calculateAreaBoxesAndPallets(area.cabinets, products, area.closetItems || []);
      return sum + boxes * (area.quantity ?? 1);
    }, 0);
    const totalPallets = Math.ceil(areas.reduce((sum, area) => {
      const { palletsRaw } = calculateAreaBoxesAndPallets(area.cabinets, products, area.closetItems || []);
      return sum + palletsRaw * (area.quantity ?? 1);
    }, 0));

    return {
      areasCosts,
      materialsBreakdown,
      maxAreaCost,
      maxMaterialCost,
      totalCost,
      totalCabinets,
      totalSKUs,
      avgCostPerCabinet,
      distinctAreas: areas.length,
      totalEffectiveAreas,
      totalBoxes,
      totalPallets,
    };
  }, [areas, products, isOptimizerMode, optimizerOverrides, riskAmount]);

  if (areas.length === 0) return null;

  const { areasCosts, materialsBreakdown, totalCost, maxAreaCost, maxMaterialCost } = analytics;

  return (
    <div className="no-print space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard
          label="Project Value"
          value={formatCurrency(analytics.totalCost)}
          sub={riskAmount > 0 ? `Subtotal · incl ${riskFactorPct}% risk` : 'Total materials cost'}
          icon={<DollarSign className="h-5 w-5" />}
        />
        <KpiCard
          label="Areas"
          value={analytics.totalEffectiveAreas}
          sub={analytics.distinctAreas !== analytics.totalEffectiveAreas ? `${analytics.distinctAreas} entries` : undefined}
          icon={<Layers className="h-5 w-5" />}
        />
        <KpiCard
          label="Total Cabinets"
          value={analytics.totalCabinets}
          sub={`${analytics.totalSKUs} unique SKUs`}
          icon={<Boxes className="h-5 w-5" />}
          accent="text-blue-700"
        />
        <KpiCard
          label="Avg / Cabinet"
          value={formatCurrency(analytics.avgCostPerCabinet)}
          sub="Per cabinet unit"
          icon={<TrendingUp className="h-5 w-5" />}
        />
        <KpiCard
          label="Total Boxes"
          value={analytics.totalBoxes}
          sub="Shipping units"
          icon={<Package className="h-5 w-5" />}
        />
        <KpiCard
          label="Total Pallets"
          value={analytics.totalPallets}
          sub="Pallet count"
          icon={<Truck className="h-5 w-5" />}
        />
      </div>

      <div className="glass-white p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-slate-900">Cost Distribution by Area</h3>
          <BarChart3 className="h-4 w-4 text-slate-400" />
        </div>
        <div className="space-y-3">
          {areasCosts.map((area) => {
            const pct = totalCost > 0 ? (area.total / totalCost) * 100 : 0;
            const barPct = (area.total / maxAreaCost) * 100;
            const parts = [
              { label: 'Cabinets', value: area.cabinetsRaw, color: 'bg-blue-500' },
              { label: 'Countertops', value: area.countertopsRaw, color: 'bg-orange-400' },
              { label: 'Closets', value: area.closetItemsRaw, color: 'bg-teal-500' },
              { label: 'Items', value: area.itemsRaw, color: 'bg-amber-500' },
            ].filter((p) => p.value > 0);

            return (
              <div key={area.name}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium text-slate-800 truncate max-w-xs">{area.name}</span>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                    <span className="text-sm font-semibold text-slate-900">{formatCurrency(area.total)}</span>
                    <span className="text-xs text-slate-400 w-10 text-right">{pct.toFixed(1)}%</span>
                  </div>
                </div>
                <div className="relative h-7 bg-slate-100 rounded-lg overflow-hidden">
                  {parts.length > 0 ? (
                    (() => {
                      let offset = 0;
                      return parts.map((part) => {
                        const partPct = area.total > 0 ? (part.value / area.total) * barPct : 0;
                        const el = (
                          <div
                            key={part.label}
                            title={`${part.label}: ${formatCurrency(part.value)}`}
                            className={`absolute top-0 h-full ${part.color} transition-all duration-500`}
                            style={{ left: `${offset}%`, width: `${partPct}%` }}
                          />
                        );
                        offset += partPct;
                        return el;
                      });
                    })()
                  ) : (
                    <div
                      className="absolute top-0 left-0 h-full bg-blue-400 transition-all duration-500 rounded-lg"
                      style={{ width: `${barPct}%` }}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-4 pt-4 border-t border-slate-100">
          {[
            { label: 'Cabinets', color: 'bg-blue-500' },
            { label: 'Countertops', color: 'bg-orange-400' },
            { label: 'Closets', color: 'bg-teal-500' },
            { label: 'Items', color: 'bg-amber-500' },
          ].map((l) => (
            <div key={l.label} className="flex items-center gap-1.5">
              <div className={`w-2.5 h-2.5 rounded-sm ${l.color}`} />
              <span className="text-xs text-slate-500">{l.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="glass-white p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-slate-900">Cost Composition by Category</h3>
          <span className="text-xs text-slate-400">% of total project cost</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 space-y-2.5">
            {materialsBreakdown.map((material) => {
              const barPct = (material.cost / maxMaterialCost) * 100;
              const totalPct = totalCost > 0 ? (material.cost / totalCost) * 100 : 0;
              return (
                <div key={material.name}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-sm flex-shrink-0 ${material.color}`} />
                      <span className="text-sm text-slate-700">{material.name}</span>
                    </div>
                    <div className="flex items-center gap-3 ml-4">
                      <span className="text-sm font-semibold text-slate-900">{formatCurrency(material.cost)}</span>
                      <span className="text-xs text-slate-400 w-10 text-right">{totalPct.toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className="relative h-5 bg-slate-100 rounded overflow-hidden">
                    <div
                      className={`absolute top-0 left-0 h-full ${material.color} transition-all duration-500 rounded`}
                      style={{ width: `${barPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="lg:col-span-2 flex items-center justify-center">
            <div className="relative w-52 h-52">
              <svg viewBox="0 0 200 200" className="transform -rotate-90 w-full h-full">
                {materialsBreakdown.reduce(
                  (acc, material, index) => {
                    const percentage = (material.cost / totalCost) * 100;
                    const circumference = 2 * Math.PI * 75;
                    const strokeDasharray = `${(percentage / 100) * circumference} ${circumference}`;
                    const strokeDashoffset = -acc.offset;
                    acc.offset += (percentage / 100) * circumference;
                    acc.elements.push(
                      <circle
                        key={index}
                        cx="100"
                        cy="100"
                        r="75"
                        fill="none"
                        stroke={COLOR_PALETTE[material.color] || '#3b82f6'}
                        strokeWidth="32"
                        strokeDasharray={strokeDasharray}
                        strokeDashoffset={strokeDashoffset}
                        className="transition-all duration-500"
                      />
                    );
                    return acc;
                  },
                  { offset: 0, elements: [] as JSX.Element[] }
                ).elements}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                <div className="text-xs text-slate-500 mb-0.5">Total</div>
                <div className="text-base font-bold text-slate-900 leading-tight">
                  {formatCurrency(totalCost)}
                </div>
                {materialsBreakdown.length > 0 && (() => {
                  const top = materialsBreakdown.reduce((max, m) => (m.cost > max.cost ? m : max));
                  const topPct = totalCost > 0 ? (top.cost / totalCost) * 100 : 0;
                  return (
                    <div className="text-xs text-slate-400 mt-1 leading-tight">
                      {top.name}<br />{topPct.toFixed(0)}%
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
