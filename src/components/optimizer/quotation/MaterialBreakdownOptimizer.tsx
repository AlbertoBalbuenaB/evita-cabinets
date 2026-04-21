/**
 * Optimizer-mode project-wide Material Breakdown.
 *
 * Drop-in alternative to `MaterialBreakdown` (Analytics tab) for use when
 * the quotation is in `pricing_method === 'optimizer'`. Displays the same
 * visual structure but sources Boards + Edgeband from the active optimizer
 * run instead of per-cabinet ft² calculations. Hardware / Accessories /
 * Countertops / Items are aggregated from the same `areas` props as the
 * legacy component so they match.
 */
import { useMemo } from 'react';
import { Package, Layers, Hash, Ruler, Hammer, Wrench, ListChecks } from 'lucide-react';
import { formatCurrency } from '../../../lib/calculations';
import { computeEdgebandCost } from '../../../lib/optimizer/quotation/computeEdgebandCost';
import type { OptimizerRunSnapshot } from '../../../lib/optimizer/quotation/types';
import type { OptimizationResult } from '../../../lib/optimizer/types';
import type {
  QuotationOptimizerRun,
  ProjectArea,
  AreaCabinet,
  AreaItem,
  AreaCountertop,
  AreaClosetItem,
} from '../../../types';

const ROLL_LENGTH_METERS = 150;

type EnrichedArea = ProjectArea & {
  cabinets: AreaCabinet[];
  items: AreaItem[];
  countertops: AreaCountertop[];
  closetItems?: AreaClosetItem[];
};

interface Props {
  run: QuotationOptimizerRun;
  areas: EnrichedArea[];
}

export function MaterialBreakdownOptimizer({ run, areas }: Props) {
  const data = useMemo(() => {
    const snapshot = run.snapshot as unknown as OptimizerRunSnapshot;
    const result = run.result as unknown as OptimizationResult;
    if (!snapshot || !result) {
      return null;
    }

    // Boards: group by stock across the whole run.
    const stockByName = new Map(snapshot.stocks.map((s) => [s.nombre, s]));
    const boardMap = new Map<
      string,
      { name: string; boards: number; cost: number; totalSF: number }
    >();
    for (const board of result.boards) {
      const name = board.stockInfo.nombre;
      const cost =
        stockByName.get(name)?.costo ?? board.stockInfo.costo ?? 0;
      const pieceSF = board.placed.reduce(
        (s, pp) => s + ((pp.w * pp.h) / 1_000_000) * 10.7639104,
        0,
      );
      const existing = boardMap.get(name) ?? { name, boards: 0, cost: 0, totalSF: 0 };
      existing.boards += 1;
      existing.cost += cost;
      existing.totalSF += pieceSF;
      boardMap.set(name, existing);
    }

    // Edgeband: run computeEdgebandCost over ALL pieces.
    // Per-cabinet pricing when ebCabinetMap is available (new snapshots).
    const prices = {
      a: snapshot.ebConfig?.a?.price ?? 0,
      b: snapshot.ebConfig?.b?.price ?? 0,
      c: snapshot.ebConfig?.c?.price ?? 0,
    };
    const ebResult = computeEdgebandCost(snapshot.pieces, prices, snapshot.ebCabinetMap);
    const edgebandRows: Array<{ name: string; meters: number; rolls: number; cost: number }> = [];
    const hasPerType = Object.keys(ebResult.perEdgebandType).length > 0;
    if (hasPerType) {
      for (const [, eb] of Object.entries(ebResult.perEdgebandType)) {
        if (eb.meters <= 0) continue;
        if (eb.name.toLowerCase().includes('not apply')) continue;
        edgebandRows.push({
          name: eb.name,
          meters: eb.meters,
          rolls: Math.ceil(eb.meters / ROLL_LENGTH_METERS),
          cost: eb.cost,
        });
      }
    } else {
      // Legacy fallback: iterate 3 fixed slots
      for (const slot of ['a', 'b', 'c'] as const) {
        const { meters, cost } = ebResult.perSlot[slot];
        if (meters <= 0) continue;
        const cfg = snapshot.ebConfig?.[slot];
        if (!cfg || !cfg.name || cfg.name.toLowerCase().includes('not apply')) continue;
        edgebandRows.push({ name: cfg.name, meters, rolls: Math.ceil(meters / ROLL_LENGTH_METERS), cost });
      }
    }

    // Hardware, Accessories, Items, Countertops: aggregate across areas.
    // Source: area.cabinets.{hardware,accessories,hardware_cost,accessories_cost}
    // and area.items / area.countertops.
    const hardwareMap = new Map<string, { name: string; quantity: number; cost: number }>();
    const accessoriesMap = new Map<string, { name: string; quantity: number; cost: number }>();
    const itemsMap = new Map<string, { name: string; quantity: number; cost: number }>();
    const countertopsMap = new Map<string, { name: string; quantity: number; cost: number }>();

    for (const area of areas) {
      const areaQty = area.quantity ?? 1;
      for (const cab of area.cabinets) {
        const qty = (cab.quantity || 1) * areaQty;
        if (Array.isArray(cab.hardware) && cab.hardware.length > 0) {
          const totalHwCost = (cab as any).hardware_cost || 0;
          const totalHwItems = (cab.hardware as any[]).reduce(
            (s: number, hw: any) => s + (hw.quantity_per_cabinet || 0),
            0,
          );
          (cab.hardware as any[]).forEach((hw: any) => {
            const id = hw.hardware_id;
            const perCab = hw.quantity_per_cabinet || 0;
            if (!id || perCab === 0) return;
            // Fallback label — callers don't have the concept map here.
            const name = hw.name || id;
            const addQty = perCab * qty;
            const propCost =
              totalHwItems > 0 ? (perCab / totalHwItems) * totalHwCost * areaQty : 0;
            const existing = hardwareMap.get(name) ?? { name, quantity: 0, cost: 0 };
            existing.quantity += addQty;
            existing.cost += propCost;
            hardwareMap.set(name, existing);
          });
        }
        if (Array.isArray(cab.accessories) && cab.accessories.length > 0) {
          const totalAccCost = (cab as any).accessories_cost || 0;
          const totalAccItems = (cab.accessories as any[]).reduce(
            (s: number, acc: any) => s + (acc.quantity_per_cabinet || 0),
            0,
          );
          (cab.accessories as any[]).forEach((acc: any) => {
            const id = acc.accessory_id;
            const perCab = acc.quantity_per_cabinet || 0;
            if (!id || perCab === 0) return;
            const name = acc.name || id;
            const addQty = perCab * qty;
            const propCost =
              totalAccItems > 0 ? (perCab / totalAccItems) * totalAccCost * areaQty : 0;
            const existing = accessoriesMap.get(name) ?? { name, quantity: 0, cost: 0 };
            existing.quantity += addQty;
            existing.cost += propCost;
            accessoriesMap.set(name, existing);
          });
        }
      }
      for (const item of area.items) {
        const name = item.item_name || 'Item';
        const addQty = (item.quantity || 0) * areaQty;
        const cost = (item.subtotal || 0) * areaQty;
        const existing = itemsMap.get(name) ?? { name, quantity: 0, cost: 0 };
        existing.quantity += addQty;
        existing.cost += cost;
        itemsMap.set(name, existing);
      }
      for (const ct of area.countertops) {
        const name = ct.item_name || 'Countertop';
        const addQty = (ct.quantity || 0) * areaQty;
        const cost = (ct.subtotal || 0) * areaQty;
        const existing = countertopsMap.get(name) ?? { name, quantity: 0, cost: 0 };
        existing.quantity += addQty;
        existing.cost += cost;
        countertopsMap.set(name, existing);
      }
    }

    const boardRows = Array.from(boardMap.values()).sort((a, b) => b.cost - a.cost);
    const hardwareRows = Array.from(hardwareMap.values());
    const accessoriesRows = Array.from(accessoriesMap.values());
    const itemsRows = Array.from(itemsMap.values());
    const countertopsRows = Array.from(countertopsMap.values());

    const totalCost =
      boardRows.reduce((s, r) => s + r.cost, 0) +
      edgebandRows.reduce((s, r) => s + r.cost, 0) +
      hardwareRows.reduce((s, r) => s + r.cost, 0) +
      accessoriesRows.reduce((s, r) => s + r.cost, 0) +
      itemsRows.reduce((s, r) => s + r.cost, 0) +
      countertopsRows.reduce((s, r) => s + r.cost, 0);

    return {
      boardRows,
      edgebandRows,
      hardwareRows,
      accessoriesRows,
      itemsRows,
      countertopsRows,
      totalCost,
    };
  }, [run, areas]);

  if (!data) {
    return (
      <div className="bg-surf-card rounded-lg border border-border-soft p-4">
        <div className="text-center py-4 text-sm text-fg-500">
          No optimizer data available. Run the optimizer in the Breakdown tab.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surf-card rounded-lg border border-accent-tint-border p-4">
      <div className="flex items-center mb-4">
        <Layers className="h-5 w-5 text-accent-text mr-2" />
        <h3 className="text-lg font-semibold text-fg-900">
          Material Breakdown
          <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded bg-accent-tint-soft text-accent-text border border-accent-tint-border text-[9px] font-bold tracking-wide uppercase align-middle">
            Optimizer
          </span>
        </h3>
        <span className="ml-auto text-sm font-semibold text-status-emerald-fg">
          Total: {formatCurrency(data.totalCost)}
        </span>
      </div>

      <div className="space-y-3">
        {data.boardRows.length > 0 && (
          <div className="bg-status-amber-bg rounded-lg p-3 border border-amber-100">
            <div className="flex items-center mb-2">
              <Package className="h-4 w-4 text-status-amber-fg mr-1.5" />
              <h4 className="text-sm font-semibold text-status-amber-fg">Boards (from optimizer run)</h4>
              <span className="ml-auto text-xs font-semibold text-status-amber-fg">
                {formatCurrency(data.boardRows.reduce((s, r) => s + r.cost, 0))}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {data.boardRows.map((row) => (
                <div key={row.name} className="bg-surf-card rounded p-2 text-xs">
                  <div className="font-medium text-fg-900 truncate mb-1">{row.name}</div>
                  <div className="flex justify-between text-fg-600">
                    <span>
                      <Hash className="h-3 w-3 inline mr-1" />
                      {row.boards} boards
                    </span>
                    <span>
                      <Ruler className="h-3 w-3 inline mr-1" />
                      {row.totalSF.toFixed(1)} SF
                    </span>
                    <span className="font-semibold text-status-amber-fg">{formatCurrency(row.cost)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {data.edgebandRows.length > 0 && (
          <div className="bg-status-amber-bg rounded-lg p-3 border border-amber-100">
            <div className="flex items-center mb-2">
              <Ruler className="h-4 w-4 text-status-amber-fg mr-1.5" />
              <h4 className="text-sm font-semibold text-status-amber-fg">Edgeband (Rolls 150m)</h4>
              <span className="ml-auto text-xs font-semibold text-status-amber-fg">
                {formatCurrency(data.edgebandRows.reduce((s, r) => s + r.cost, 0))}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {data.edgebandRows.map((row) => (
                <div key={row.name} className="bg-surf-card rounded p-2 text-xs">
                  <div className="font-medium text-fg-900 truncate mb-1">{row.name}</div>
                  <div className="flex justify-between text-fg-600">
                    <span>
                      <Hash className="h-3 w-3 inline mr-1" />
                      {row.rolls} rolls
                    </span>
                    <span>
                      <Ruler className="h-3 w-3 inline mr-1" />
                      {row.meters.toFixed(1)}m
                    </span>
                    <span className="font-semibold text-status-amber-fg">{formatCurrency(row.cost)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {data.hardwareRows.length > 0 && (
          <div className="bg-surf-app rounded-lg p-3 border border-border-soft">
            <div className="flex items-center mb-2">
              <Wrench className="h-4 w-4 text-fg-700 mr-1.5" />
              <h4 className="text-sm font-semibold text-fg-900">Hardware</h4>
              <span className="ml-auto text-xs font-semibold text-fg-800">
                {formatCurrency(data.hardwareRows.reduce((s, r) => s + r.cost, 0))}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {data.hardwareRows.map((row) => (
                <div key={row.name} className="bg-surf-card rounded p-2 text-xs">
                  <div className="font-medium text-fg-900 truncate mb-1">{row.name}</div>
                  <div className="flex justify-between text-fg-600">
                    <span>
                      <Hash className="h-3 w-3 inline mr-1" />
                      {row.quantity} pcs
                    </span>
                    <span className="font-semibold text-fg-700">{formatCurrency(row.cost)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {data.accessoriesRows.length > 0 && (
          <div className="bg-accent-tint-soft rounded-lg p-3 border border-accent-tint-border">
            <div className="flex items-center mb-2">
              <Package className="h-4 w-4 text-accent-text mr-1.5" />
              <h4 className="text-sm font-semibold text-accent-text">Accessories</h4>
              <span className="ml-auto text-xs font-semibold text-accent-text">
                {formatCurrency(data.accessoriesRows.reduce((s, r) => s + r.cost, 0))}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {data.accessoriesRows.map((row) => (
                <div key={row.name} className="bg-surf-card rounded p-2 text-xs">
                  <div className="font-medium text-fg-900 truncate mb-1">{row.name}</div>
                  <div className="flex justify-between text-fg-600">
                    <span>
                      <Hash className="h-3 w-3 inline mr-1" />
                      {row.quantity} pcs
                    </span>
                    <span className="font-semibold text-accent-text">{formatCurrency(row.cost)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {data.itemsRows.length > 0 && (
          <div className="bg-status-orange-bg rounded-lg p-3 border border-status-orange-brd">
            <div className="flex items-center mb-2">
              <ListChecks className="h-4 w-4 text-status-orange-fg mr-1.5" />
              <h4 className="text-sm font-semibold text-status-orange-fg">Individual Items</h4>
              <span className="ml-auto text-xs font-semibold text-status-orange-fg">
                {formatCurrency(data.itemsRows.reduce((s, r) => s + r.cost, 0))}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {data.itemsRows.map((row) => (
                <div key={row.name} className="bg-surf-card rounded p-2 text-xs">
                  <div className="font-medium text-fg-900 truncate mb-1">{row.name}</div>
                  <div className="flex justify-between text-fg-600">
                    <span>
                      <Hash className="h-3 w-3 inline mr-1" />
                      {row.quantity} pcs
                    </span>
                    <span className="font-semibold text-status-orange-fg">{formatCurrency(row.cost)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {data.countertopsRows.length > 0 && (
          <div className="bg-status-orange-bg rounded-lg p-3 border border-status-orange-brd">
            <div className="flex items-center mb-2">
              <Hammer className="h-4 w-4 text-status-orange-fg mr-1.5" />
              <h4 className="text-sm font-semibold text-status-orange-fg">Countertops</h4>
              <span className="ml-auto text-xs font-semibold text-status-orange-fg">
                {formatCurrency(data.countertopsRows.reduce((s, r) => s + r.cost, 0))}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {data.countertopsRows.map((row) => (
                <div key={row.name} className="bg-surf-card rounded p-2 text-xs">
                  <div className="font-medium text-fg-900 truncate mb-1">{row.name}</div>
                  <div className="flex justify-between text-fg-600">
                    <span>
                      <Hash className="h-3 w-3 inline mr-1" />
                      {row.quantity.toFixed(2)} units
                    </span>
                    <span className="font-semibold text-status-orange-fg">{formatCurrency(row.cost)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
