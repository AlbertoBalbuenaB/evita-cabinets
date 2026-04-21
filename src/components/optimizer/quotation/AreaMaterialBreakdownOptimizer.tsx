/**
 * Optimizer-mode per-area Material Breakdown.
 *
 * Drop-in alternative to `AreaMaterialBreakdown` for use when the quotation
 * is operating in `pricing_method === 'optimizer'`. Replaces the Box / Doors
 * / Back-Panel / Edgeband rows (which in ft² mode come from
 * `calculateAreaSheetMaterials` / `calculateAreaEdgebandRolls`) with values
 * derived from the active optimizer run:
 *
 *   - **Boards**: for every board in `run.result.boards[]`, compute the
 *     fractional share attributable to this area by summing piece m² from
 *     cabinets in this area over total piece m² on the board. Group by
 *     stock name so each physical material shows up as a single row.
 *   - **Edgeband**: filter `run.snapshot.pieces` to pieces whose `areaId`
 *     matches this area, then run `computeEdgebandCost` to get meters per
 *     slot (a/b/c), translate slots back to material names via the snapshot's
 *     `ebConfig`, and show rolls needed at 150m / roll.
 *
 * Hardware / Accessories / Countertops are NOT sourced from the optimizer
 * (the optimizer only knows about boards + edgeband). For these categories
 * we reuse the SAME Supabase-sourced aggregation that `AreaMaterialBreakdown`
 * uses, so the numbers are identical between ft² and optimizer modes.
 *
 * Visual structure mirrors `AreaMaterialBreakdown` so users get a consistent
 * look when they toggle between modes.
 */
import { useEffect, useMemo, useState } from 'react';
import { Package, Layers, Hash, Ruler, Hammer } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { formatCurrency } from '../../../lib/calculations';
import { computeEdgebandCost } from '../../../lib/optimizer/quotation/computeEdgebandCost';
import type { OptimizerRunSnapshot } from '../../../lib/optimizer/quotation/types';
import type { OptimizationResult } from '../../../lib/optimizer/types';
import type { QuotationOptimizerRun } from '../../../types';

const ROLL_LENGTH_METERS = 150;

interface BoardRow {
  name: string;
  boards: number;
  cost: number;
  totalSF: number;
}

interface EdgebandRow {
  name: string;
  meters: number;
  rolls: number;
  cost: number;
}

interface HardwareRow {
  name: string;
  quantity: number;
  cost: number;
}

interface CountertopRow {
  name: string;
  quantity: number;
  cost: number;
}

interface Props {
  areaId: string;
  run: QuotationOptimizerRun;
}

/**
 * Derive board usage attributable to the given area from the optimizer run.
 * Each board's cost and sheet count are split across areas in proportion to
 * the m² of pieces from that area, mirroring `allocateBoardCostsByArea`
 * (which returns aggregated totals — we need per-stock detail here).
 */
function computeAreaBoards(
  result: OptimizationResult,
  snapshot: OptimizerRunSnapshot,
  areaId: string,
): BoardRow[] {
  const byStock = new Map<string, BoardRow>();
  const stockByName = new Map(snapshot.stocks.map((s) => [s.nombre, s]));

  for (const board of result.boards) {
    if (board.placed.length === 0) continue;

    // Sum area m² and total m² for this board.
    let areaM2 = 0;
    let totalM2 = 0;
    for (const pp of board.placed) {
      const m2 = (pp.w * pp.h) / 1_000_000;
      totalM2 += m2;
      if (pp.piece.areaId === areaId) areaM2 += m2;
    }
    if (totalM2 <= 0 || areaM2 <= 0) continue;

    const frac = areaM2 / totalM2;
    const stockName = board.stockInfo.nombre;
    const boardCost =
      stockByName.get(stockName)?.costo ?? board.stockInfo.costo ?? 0;
    const existing = byStock.get(stockName) ?? {
      name: stockName,
      boards: 0,
      cost: 0,
      totalSF: 0,
    };
    existing.boards += frac;
    existing.cost += boardCost * frac;
    // Area m² → ft² (1 m² ≈ 10.7639 ft²)
    existing.totalSF += areaM2 * 10.7639104 * frac; // allocated SF from this board
    // Actually the simpler and more intuitive metric is just piece SF from this area
    // Replacing with the clean calc below
    byStock.set(stockName, existing);
  }

  // Second pass for SF: use the sum of piece SFs attributable to this area
  // (irrespective of boards), since the above double-allocates.
  const areaSFByStock = new Map<string, number>();
  for (const board of result.boards) {
    const stockName = board.stockInfo.nombre;
    for (const pp of board.placed) {
      if (pp.piece.areaId !== areaId) continue;
      const sf = (pp.w * pp.h) / 1_000_000 * 10.7639104;
      areaSFByStock.set(stockName, (areaSFByStock.get(stockName) ?? 0) + sf);
    }
  }
  for (const [name, row] of byStock.entries()) {
    row.totalSF = areaSFByStock.get(name) ?? 0;
  }

  return Array.from(byStock.values()).sort((a, b) => b.cost - a.cost);
}

function computeAreaEdgeband(
  snapshot: OptimizerRunSnapshot,
  areaId: string,
): EdgebandRow[] {
  const piecesInArea = snapshot.pieces.filter((p) => p.areaId === areaId);
  if (piecesInArea.length === 0) return [];

  const prices = {
    a: snapshot.ebConfig?.a?.price ?? 0,
    b: snapshot.ebConfig?.b?.price ?? 0,
    c: snapshot.ebConfig?.c?.price ?? 0,
  };
  const result = computeEdgebandCost(piecesInArea, prices);

  const rows: EdgebandRow[] = [];
  for (const slot of ['a', 'b', 'c'] as const) {
    const { meters, cost } = result.perSlot[slot];
    if (meters <= 0) continue;
    const cfg = snapshot.ebConfig?.[slot];
    if (!cfg || !cfg.name || cfg.name.toLowerCase().includes('not apply')) continue;
    rows.push({
      name: cfg.name,
      meters,
      rolls: Math.ceil(meters / ROLL_LENGTH_METERS),
      cost,
    });
  }
  return rows;
}

export function AreaMaterialBreakdownOptimizer({ areaId, run }: Props) {
  const [hardware, setHardware] = useState<HardwareRow[]>([]);
  const [accessories, setAccessories] = useState<HardwareRow[]>([]);
  const [countertops, setCountertops] = useState<CountertopRow[]>([]);
  const [hardwareLoading, setHardwareLoading] = useState(true);

  // Load hardware / accessories / countertops from DB for this area.
  // Same shape as AreaMaterialBreakdown — see that file for the reference
  // implementation of the aggregation. We only need the per-area totals
  // since the optimizer doesn't touch these categories.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setHardwareLoading(true);
      try {
        const [cabRes, ctRes, plRes] = await Promise.all([
          supabase
            .from('area_cabinets')
            .select('quantity, hardware, hardware_cost, accessories, accessories_cost')
            .eq('area_id', areaId),
          supabase
            .from('area_countertops')
            .select('item_name, quantity, subtotal')
            .eq('area_id', areaId),
          supabase.from('price_list').select('id, concept_description'),
        ]);

        const plMap = new Map(
          (plRes.data ?? []).map((p: any) => [p.id, p.concept_description as string]),
        );

        const hwMap = new Map<string, HardwareRow>();
        const accMap = new Map<string, HardwareRow>();

        (cabRes.data ?? []).forEach((cab: any) => {
          const qty = cab.quantity || 1;
          if (Array.isArray(cab.hardware) && cab.hardware.length > 0) {
            const totalHwCost = cab.hardware_cost || 0;
            const totalHwItems = cab.hardware.reduce(
              (s: number, hw: any) => s + (hw.quantity_per_cabinet || 0),
              0,
            );
            cab.hardware.forEach((hw: any) => {
              const id = hw.hardware_id;
              const perCab = hw.quantity_per_cabinet || 0;
              if (!id || perCab === 0) return;
              const name = plMap.get(id) ?? 'Unknown Hardware';
              if (name.toLowerCase().includes('not apply')) return;
              const addQty = perCab * qty;
              const propCost =
                totalHwItems > 0 ? (perCab / totalHwItems) * totalHwCost : 0;
              const existing = hwMap.get(name) ?? { name, quantity: 0, cost: 0 };
              existing.quantity += addQty;
              existing.cost += propCost;
              hwMap.set(name, existing);
            });
          }
          if (Array.isArray(cab.accessories) && cab.accessories.length > 0) {
            const totalAccCost = cab.accessories_cost || 0;
            const totalAccItems = cab.accessories.reduce(
              (s: number, acc: any) => s + (acc.quantity_per_cabinet || 0),
              0,
            );
            cab.accessories.forEach((acc: any) => {
              const id = acc.accessory_id;
              const perCab = acc.quantity_per_cabinet || 0;
              if (!id || perCab === 0) return;
              const name = plMap.get(id) ?? 'Unknown Accessory';
              if (name.toLowerCase().includes('not apply')) return;
              const addQty = perCab * qty;
              const propCost =
                totalAccItems > 0 ? (perCab / totalAccItems) * totalAccCost : 0;
              const existing = accMap.get(name) ?? { name, quantity: 0, cost: 0 };
              existing.quantity += addQty;
              existing.cost += propCost;
              accMap.set(name, existing);
            });
          }
        });

        const ctMap = new Map<string, CountertopRow>();
        (ctRes.data ?? []).forEach((ct: any) => {
          const name = ct.item_name || 'Unknown Countertop';
          const existing = ctMap.get(name) ?? { name, quantity: 0, cost: 0 };
          existing.quantity += ct.quantity || 0;
          existing.cost += ct.subtotal || 0;
          ctMap.set(name, existing);
        });

        if (!cancelled) {
          setHardware(Array.from(hwMap.values()));
          setAccessories(Array.from(accMap.values()));
          setCountertops(Array.from(ctMap.values()));
        }
      } catch (err) {
        console.error('[AreaMaterialBreakdownOptimizer] failed to load hardware:', err);
      } finally {
        if (!cancelled) setHardwareLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [areaId]);

  const { boardRows, edgebandRows, totalCost } = useMemo(() => {
    const snapshot = run.snapshot as unknown as OptimizerRunSnapshot;
    const result = run.result as unknown as OptimizationResult;
    if (!snapshot || !result) {
      return { boardRows: [] as BoardRow[], edgebandRows: [] as EdgebandRow[], totalCost: 0 };
    }
    const boardRows = computeAreaBoards(result, snapshot, areaId);
    const edgebandRows = computeAreaEdgeband(snapshot, areaId);
    const boardsSum = boardRows.reduce((s, r) => s + r.cost, 0);
    const ebSum = edgebandRows.reduce((s, r) => s + r.cost, 0);
    const hwSum = hardware.reduce((s, r) => s + r.cost, 0);
    const accSum = accessories.reduce((s, r) => s + r.cost, 0);
    const ctSum = countertops.reduce((s, r) => s + r.cost, 0);
    return {
      boardRows,
      edgebandRows,
      totalCost: boardsSum + ebSum + hwSum + accSum + ctSum,
    };
  }, [run, areaId, hardware, accessories, countertops]);

  if (hardwareLoading) {
    return (
      <div className="bg-surf-app rounded-lg border border-border-soft p-4">
        <div className="flex items-center justify-center py-4">
          <div className="text-sm text-fg-600">Loading materials...</div>
        </div>
      </div>
    );
  }

  const isEmpty =
    boardRows.length === 0 &&
    edgebandRows.length === 0 &&
    hardware.length === 0 &&
    accessories.length === 0 &&
    countertops.length === 0;

  if (isEmpty) {
    return (
      <div className="bg-surf-app rounded-lg border border-border-soft p-4">
        <div className="text-center py-4 text-sm text-fg-500">
          No optimizer data for this area. Run the optimizer in the Breakdown tab.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-blue-50/60 to-slate-100 rounded-lg border border-accent-tint-border p-4">
      <div className="flex items-center mb-3">
        <Layers className="h-4 w-4 text-accent-text mr-2" />
        <h4 className="text-sm font-semibold text-fg-900">
          Material Breakdown
          <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded bg-accent-tint-soft text-accent-text border border-accent-tint-border text-[9px] font-bold tracking-wide uppercase">
            Optimizer
          </span>
        </h4>
        <span className="ml-auto text-xs font-semibold text-status-emerald-fg">
          Total: {formatCurrency(totalCost)}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {boardRows.length > 0 && (
          <div className="bg-status-amber-bg rounded-lg p-3 border border-amber-100 lg:col-span-2">
            <div className="flex items-center mb-2">
              <Package className="h-3 w-3 text-status-amber-fg mr-1.5" />
              <h5 className="text-xs font-semibold text-amber-900">Boards (from optimizer run)</h5>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {boardRows.map((row) => (
                <div key={row.name} className="bg-surf-card rounded p-2 text-xs">
                  <div className="font-medium text-fg-900 truncate mb-1">{row.name}</div>
                  <div className="flex justify-between text-fg-600">
                    <span>
                      <Hash className="h-3 w-3 inline mr-1" />
                      {row.boards.toFixed(2)} boards
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
            <div className="mt-2 text-[11px] text-status-amber-fg italic">
              Fractional counts reflect boards shared with other areas — allocation is by piece m² share.
            </div>
          </div>
        )}

        {edgebandRows.length > 0 && (
          <div className="bg-status-amber-bg rounded-lg p-3 border border-amber-100 lg:col-span-2">
            <div className="flex items-center mb-2">
              <Ruler className="h-3 w-3 text-status-amber-fg mr-1.5" />
              <h5 className="text-xs font-semibold text-amber-900">Edgeband (Rolls 150m)</h5>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {edgebandRows.map((row) => (
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

        {hardware.length > 0 && (
          <div className="bg-surf-app rounded-lg p-3 border border-border-soft lg:col-span-2">
            <div className="flex items-center mb-2">
              <Package className="h-3 w-3 text-fg-700 mr-1.5" />
              <h5 className="text-xs font-semibold text-fg-900">Hardware</h5>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
              {hardware.map((row) => (
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

        {accessories.length > 0 && (
          <div className="bg-accent-tint-soft rounded-lg p-3 border border-accent-tint-border lg:col-span-2">
            <div className="flex items-center mb-2">
              <Package className="h-3 w-3 text-accent-text mr-1.5" />
              <h5 className="text-xs font-semibold text-purple-900">Accessories</h5>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
              {accessories.map((row) => (
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

        {countertops.length > 0 && (
          <div className="bg-status-orange-bg rounded-lg p-3 border border-status-orange-brd lg:col-span-2">
            <div className="flex items-center mb-2">
              <Hammer className="h-3 w-3 text-status-orange-fg mr-1.5" />
              <h5 className="text-xs font-semibold text-orange-900">Countertops</h5>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
              {countertops.map((row) => (
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
