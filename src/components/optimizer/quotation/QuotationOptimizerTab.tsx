/**
 * Breakdown tab (formerly "Optimizer", originally "Cut-list Pricing").
 *
 * Entry point for the optimizer-based quotation pricing path. Composes
 * the Phase 3 library + Phase 4 store factory + Phase 5/6 UI components
 * into a single tab inside ProjectDetails. Wired into the Phase 7 rollup
 * so flipping `pricing_method` actually affects the quotation total.
 *
 * -----------------------------------------------------------------------
 * Known follow-ups (not in scope for Phase 9):
 * -----------------------------------------------------------------------
 *  1. PDF export integration. When `pricing_method === 'optimizer'`, the
 *     quotation PDF should include extra pages with the optimizer board
 *     layouts and a per-area boards breakdown. Current PDF path lives in
 *     `src/utils/printQuotation.ts` and would need a new section that
 *     renders each BoardResult's placed pieces as an SVG. Scope estimate:
 *     medium, ~1 day. Requires coordinating with the existing page-break
 *     logic in printQuotation.
 *
 *  2. "Load into editor" action on old runs. Currently `loadRun` only
 *     populates `loadedRun` (view-only). A parallel `loadRunIntoEditor`
 *     would also populate `pendingPieces/pendingStocks/pendingEbConfig`
 *     so the user can tweak settings and re-run without losing the
 *     historical inputs. Trivial to add when needed.
 *
 *  3. Price-change stale propagation. A DB trigger on `price_list.price`
 *     updates could mark all active runs stale when a referenced
 *     material's price changes. For now, users can click "Refresh
 *     stocks" in the sidebar to pull fresh prices on demand.
 * -----------------------------------------------------------------------
 */
import { useEffect, useMemo, useState, useCallback } from 'react';
import { Hammer, Play, Save, Loader2, RefreshCw, Layers } from 'lucide-react';
import { Button } from '../../Button';
import { CADViewer } from '../CADViewer';
import { RightStatsPanel } from '../RightStatsPanel';
import { getQuotationOptimizerStore } from '../../../hooks/createQuotationOptimizerStore';
import { useOptimizerStore } from '../../../hooks/useOptimizerStore';
import { supabase } from '../../../lib/supabase';
import { QuotationOptimizerSidebar } from './QuotationOptimizerSidebar';
import { OptimizerWarningsPanel } from './OptimizerWarningsPanel';
import { OptimizerVersionsList } from './OptimizerVersionsList';
import { OptimizerComparisonPanel } from './OptimizerComparisonPanel';
import { PricingMethodToggle } from './PricingMethodToggle';
import { FtVsOptimizerComparisonCard } from './FtVsOptimizerComparisonCard';
import { PerAreaBoardsBreakdown } from './PerAreaBoardsBreakdown';
import { CutListDetailPanel } from './CutListDetailPanel';
import { StaleBadge } from './StaleBadge';
import { BreakdownBOM } from './BreakdownBOM';
import type { OptimizationResult } from '../../../lib/optimizer/types';
import type {
  PricingMethod,
  ProjectArea,
  AreaCabinet,
  AreaItem,
  AreaCountertop,
  AreaClosetItem,
  Quotation,
} from '../../../types';

type EnrichedArea = ProjectArea & {
  cabinets: AreaCabinet[];
  items: AreaItem[];
  countertops: AreaCountertop[];
  closetItems?: AreaClosetItem[];
};

interface Props {
  quotationId: string;
  totalCabinetsCount: number;
  /** Map of area_id → area name, so the per-area breakdown can show labels. */
  areasById: Record<string, string>;
  /** Full area data — used by BreakdownBOM for hardware/accessories/items/countertops. */
  areas: EnrichedArea[];
  /** Quotation record — provides pricing multipliers and project_id for BreakdownBOM. */
  quotation: Quotation;
  /**
   * Invoked after any action that could have changed the quotation total
   * (toggle pricing method, save a new run, set a different run active,
   * stale re-run, delete a run). Triggers the parent ProjectDetails to
   * re-run updateProjectTotal and write the fresh total to Supabase.
   */
  onRecomputeRollup?: () => Promise<void> | void;
}

interface QuotationHeaderSlice {
  sqftTotal: number;
  optimizerTotal: number | null;
  pricingMethod: PricingMethod;
  optimizerIsStale: boolean;
}

/**
 * Top-level component for the "Breakdown" tab inside ProjectDetails.
 *
 * Phase 5 added: build/run/save workflow + 3-panel layout.
 * Phase 6 adds: versions dropdown, comparison modal, pricing-method
 * toggle (writes quotations.pricing_method), ft²-vs-optimizer card,
 * per-area boards breakdown, stale badge with re-run action.
 *
 * The tab does NOT change the quotation rollup yet — that wiring lives
 * in Phase 7 (updateProjectTotal branch). Flipping the toggle here
 * only updates the DB column; the user will see the total change once
 * Phase 7 lands.
 */
export function QuotationOptimizerTab({
  quotationId,
  totalCabinetsCount,
  areasById,
  areas,
  quotation,
  onRecomputeRollup,
}: Props) {
  const useStore = useMemo(() => getQuotationOptimizerStore(quotationId), [quotationId]);

  // Reactive slices from the per-quotation store.
  const isBuilding        = useStore((s) => s.isBuilding);
  const isOptimizing      = useStore((s) => s.isOptimizing);
  const isSaving          = useStore((s) => s.isSaving);
  const lastError          = useStore((s) => s.lastError);
  const pendingResult      = useStore((s) => s.pendingResult);
  const pendingPieces      = useStore((s) => s.pendingPieces);
  const pendingWarnings    = useStore((s) => s.pendingWarnings);
  const pendingCabCovered  = useStore((s) => s.pendingCabinetsCovered);
  const pendingCabSkipped  = useStore((s) => s.pendingCabinetsSkipped);
  const pendingCabinetDetails = useStore((s) => s.pendingCabinetDetails);
  const loadedRun          = useStore((s) => s.loadedRun);
  const runs               = useStore((s) => s.runs);
  const activeRunId        = useStore((s) => s.activeRunId);

  // Actions
  const refreshRunsList = useStore((s) => s.refreshRunsList);
  const build           = useStore((s) => s.build);
  const runOptimize     = useStore((s) => s.runOptimize);
  const saveAsRun       = useStore((s) => s.saveAsRun);
  const loadRun         = useStore((s) => s.loadRun);
  const setActive       = useStore((s) => s.setActive);
  const renameRun       = useStore((s) => s.renameRun);
  const deleteRun       = useStore((s) => s.deleteRun);

  // Local UI state
  const [selectedBoardIdx, setSelectedBoardIdx] = useState(0);
  const [saveName, setSaveName] = useState('');
  const [compareOpen, setCompareOpen] = useState(false);

  // Quotation header fields (pricing_method + totals + stale flag).
  const [header, setHeader] = useState<QuotationHeaderSlice>({
    sqftTotal: 0,
    optimizerTotal: null,
    pricingMethod: 'sqft',
    optimizerIsStale: false,
  });

  const refreshHeader = useCallback(async () => {
    const { data, error } = await supabase
      .from('quotations')
      .select('total_amount, optimizer_total_amount, pricing_method, optimizer_is_stale')
      .eq('id', quotationId)
      .single();
    if (error || !data) return;
    setHeader({
      sqftTotal:        Number(data.total_amount ?? 0),
      optimizerTotal:   data.optimizer_total_amount != null ? Number(data.optimizer_total_amount) : null,
      pricingMethod:    (data.pricing_method as PricingMethod) ?? 'sqft',
      optimizerIsStale: data.optimizer_is_stale === true,
    });
  }, [quotationId]);

  // On mount: fetch header + runs + auto-load active run.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await Promise.all([refreshRunsList(), refreshHeader()]);
      if (cancelled) return;
      const state = useStore.getState();
      if (state.activeRunId) {
        try { await loadRun(state.activeRunId); } catch { /* non-fatal */ }
      }
    })();
    return () => { cancelled = true; };
  }, [quotationId, refreshRunsList, refreshHeader, loadRun, useStore]);

  // Sync the standalone-optimizer singleton store with this quotation's
  // engine settings on mount. CADViewer and RightStatsPanel read a few
  // cosmetic fields (unit, labelScale, globalSierra, boardTrim) directly
  // from that singleton for header display strings. We want those strings
  // to reflect the values from the per-quotation store instead of whatever
  // the standalone OptimizerPage was last configured with.
  //
  // This is a one-shot side-effect — we don't keep them in sync after
  // initial mount, because the sidebar settings inputs only flow into the
  // quotation store. If the user changes a value in the sidebar, the
  // singleton's cosmetic strings will go out of date; that's an accepted
  // edge case and a much smaller bug than the initial-load mismatch.
  useEffect(() => {
    const quotationState = useStore.getState();
    const singleton = useOptimizerStore.getState();
    singleton.setUnit('mm');
    singleton.setLabelScale(1.0);
    singleton.setGlobalSierra(quotationState.globalSierra);
    singleton.setBoardTrim(quotationState.boardTrim);
  }, [quotationId, useStore]);

  // Pick result to display: pending (unsaved) > loaded active.
  const displayResult: OptimizationResult | null =
    pendingResult ?? loadedRun?.result ?? null;

  const selectedBoard = displayResult && displayResult.boards.length > 0
    ? displayResult.boards[Math.min(selectedBoardIdx, displayResult.boards.length - 1)]
    : null;

  // Default save name
  const nextRunNumber = runs.length + 1;
  const defaultName = `Run #${nextRunNumber}`;

  async function handleSave() {
    const name = saveName.trim() || defaultName;
    try {
      await saveAsRun(name);
      setSaveName('');
      if (onRecomputeRollup) await onRecomputeRollup();
      await refreshHeader();
    } catch { /* surfaced via lastError */ }
  }

  async function handleSetActive(runId: string) {
    await setActive(runId);
    if (onRecomputeRollup) await onRecomputeRollup();
    await refreshHeader();
  }

  async function handleDeleteRun(runId: string) {
    await deleteRun(runId);
    if (onRecomputeRollup) await onRecomputeRollup();
    await refreshHeader();
  }

  async function handlePricingMethodChange(next: PricingMethod) {
    // Optimistic UI
    setHeader((h) => ({ ...h, pricingMethod: next }));
    const { error } = await supabase
      .from('quotations')
      .update({ pricing_method: next })
      .eq('id', quotationId);
    if (error) {
      // Rollback
      await refreshHeader();
      alert(`Failed to switch pricing method: ${error.message}`);
      return;
    }
    // Trigger the parent rollup so total_amount reflects the new choice
    // immediately (no need to navigate away and back).
    if (onRecomputeRollup) await onRecomputeRollup();
    await refreshHeader();
  }

  async function handleStaleRerun() {
    try {
      await build();
      await runOptimize();
      // Auto-save as a new run (stale → fresh). User can rename later.
      const state = useStore.getState();
      if (state.pendingResult) {
        const runNum = state.runs.length + 1;
        await saveAsRun(`Re-run #${runNum}`);
        if (onRecomputeRollup) await onRecomputeRollup();
        await refreshHeader();
      }
    } catch { /* surfaced via lastError */ }
  }

  // Reset board index when the result changes.
  useEffect(() => { setSelectedBoardIdx(0); }, [displayResult]);

  // Per-area breakdown rows — recomputed from result.boards + snapshot.stocks
  // each time a run is loaded, so costs are always current (not stale zeros).
  const perAreaRows = useMemo(() => {
    if (!loadedRun) return [];
    const { result, snapshot } = loadedRun;
    const stockByName = new Map(snapshot.stocks.map((s) => [s.nombre, s]));
    const attr: Record<string, { m2: number; cost: number; boards: number }> = {};

    for (const board of result.boards) {
      if (board.placed.length === 0) continue;
      const boardCost =
        stockByName.get(board.stockInfo.nombre)?.costo ?? board.stockInfo.costo;
      const perAreaM2: Record<string, number> = {};
      let totalM2 = 0;
      for (const pp of board.placed) {
        const areaId = pp.piece.areaId;
        if (!areaId) continue;
        const m2 = (pp.w * pp.h) / 1_000_000;
        perAreaM2[areaId] = (perAreaM2[areaId] ?? 0) + m2;
        totalM2 += m2;
      }
      if (totalM2 <= 0) continue;
      for (const [areaId, m2] of Object.entries(perAreaM2)) {
        const f = m2 / totalM2;
        const b = (attr[areaId] ??= { m2: 0, cost: 0, boards: 0 });
        b.m2 += m2;
        b.cost += boardCost * f;
        b.boards += f;
      }
    }
    return Object.entries(attr)
      .map(([areaId, v]) => ({
        areaId,
        areaName: areasById[areaId] ?? '(unknown area)',
        m2: v.m2,
        cost: v.cost,
        boards: v.boards,
      }))
      .sort((a, b) => b.cost - a.cost);
  }, [loadedRun, areasById]);

  // Source of truth for the cut-list detail panel: prefer the pending build
  // (the user's current editing session); fall back to the loaded run's
  // snapshot so users auditing an old run still see its despiece.
  // When falling back, `cabinetDetails` is reconstructed from the snapshot
  // pieces' tags — we have cabinetId, areaId and the per-piece `area`
  // string, but we don't know productSku or quantity, so the labels are
  // slightly degraded (no SKU, no ×qty suffix). That's the documented
  // limitation in the plan.
  const cutListSource = useMemo(() => {
    if (pendingPieces.length > 0) {
      return { pieces: pendingPieces, cabinetDetails: pendingCabinetDetails };
    }
    if (loadedRun) {
      const derived: Record<string, {
        productSku: string | null;
        quantity: number;
        areaId: string;
        areaName: string;
      }> = {};
      for (const p of loadedRun.snapshot.pieces) {
        if (!p.cabinetId || derived[p.cabinetId]) continue;
        derived[p.cabinetId] = {
          productSku: null,
          quantity: 1,
          areaId: p.areaId ?? '',
          areaName: p.area ?? '(unknown area)',
        };
      }
      return { pieces: loadedRun.snapshot.pieces, cabinetDetails: derived };
    }
    return null;
  }, [pendingPieces, pendingCabinetDetails, loadedRun]);

  const canSelectOptimizer = activeRunId != null;

  return (
    <div className="flex flex-col" style={{ minHeight: 'calc(100vh - 104px)' }}>

      {/* ── Header bar ────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 px-4 py-2.5 flex items-center gap-2 flex-wrap">
        <Layers className="h-5 w-5 text-blue-600 shrink-0" />
        <span className="font-semibold text-slate-800 text-sm">Breakdown</span>

        <PricingMethodToggle
          value={header.pricingMethod}
          onChange={handlePricingMethodChange}
          canSelectOptimizer={canSelectOptimizer}
        />

        {header.pricingMethod === 'optimizer' && header.optimizerIsStale && (
          <StaleBadge onRerun={handleStaleRerun} />
        )}

        <div className="flex-1" />

        <OptimizerVersionsList
          runs={runs}
          activeRunId={activeRunId}
          onSetActive={handleSetActive}
          onLoad={loadRun}
          onRename={renameRun}
          onDelete={handleDeleteRun}
          onOpenCompare={() => setCompareOpen(true)}
        />

        <Button
          variant="secondary"
          size="sm"
          onClick={() => build()}
          disabled={isBuilding}
          className="flex items-center gap-1"
        >
          {isBuilding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Hammer className="h-3.5 w-3.5" />}
          {pendingPieces.length > 0 ? 'Rebuild' : 'Build from Quotation'}
        </Button>

        <Button
          variant="primary"
          size="sm"
          onClick={() => runOptimize()}
          disabled={isOptimizing || pendingPieces.length === 0}
          className="flex items-center gap-1"
        >
          {isOptimizing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
          Run
        </Button>

        {pendingResult && (
          <>
            <input
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder={defaultName}
              className="px-2 py-1 text-xs border border-slate-200 rounded w-32 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-1"
            >
              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save
            </Button>
          </>
        )}

        <Button
          variant="secondary"
          size="sm"
          onClick={() => { refreshRunsList(); refreshHeader(); }}
          className="flex items-center gap-1"
          title="Refresh runs list"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {lastError && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-xs text-red-800">
          {lastError}
        </div>
      )}

      {/* ── Comparison strip (ft² vs optimizer total) ─────── */}
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
        <FtVsOptimizerComparisonCard
          sqftTotal={header.sqftTotal}
          optimizerTotal={header.optimizerTotal}
          activeMethod={header.pricingMethod}
        />
      </div>

      {/* ── Warnings strip ────────────────────────────────── */}
      {(pendingWarnings.length > 0 || pendingCabSkipped.length > 0 || pendingPieces.length > 0) && (
        <div className="px-4 py-2 border-b border-slate-200 bg-slate-50">
          <OptimizerWarningsPanel
            warnings={pendingWarnings}
            cabinetsSkipped={pendingCabSkipped}
            cabinetsCoveredCount={pendingCabCovered.size}
            totalCabinetsCount={totalCabinetsCount}
          />
        </div>
      )}

      {/* ── Main three-panel layout ───────────────────────── */}
      <div className="flex flex-1 min-h-[600px]">
        <div className="w-64 shrink-0">
          <QuotationOptimizerSidebar useStore={useStore} />
        </div>

        <div className="flex-1 flex flex-col">
          {displayResult ? (
            <CADViewer board={selectedBoard} unit="mm" />
          ) : (
            <div className="flex-1 flex items-center justify-center bg-slate-50 text-slate-400 text-sm">
              {pendingPieces.length === 0
                ? 'Click "Build from Quotation" to start.'
                : 'Click "Run" to optimize.'}
            </div>
          )}
        </div>

        <div className="w-80 shrink-0 border-l border-slate-200 bg-white overflow-y-auto">
          <RightStatsPanel
            result={displayResult}
            selectedIdx={selectedBoardIdx}
            onSelectBoard={(idx) => setSelectedBoardIdx(idx)}
          />
        </div>
      </div>

      {/* ── Per-area breakdown below the optimizer panels ─── */}
      {/* ── Cut-list detail panel ─────────────────────────── */}
      {cutListSource && cutListSource.pieces.length > 0 && (
        <div className="px-4 py-4 border-t border-slate-200 bg-slate-50">
          <CutListDetailPanel
            pieces={cutListSource.pieces}
            cabinetDetails={cutListSource.cabinetDetails}
          />
        </div>
      )}

      {loadedRun && perAreaRows.length > 0 && (
        <div className="px-4 py-4 border-t border-slate-200 bg-slate-50">
          <PerAreaBoardsBreakdown rows={perAreaRows} />
        </div>
      )}

      {/* ── BOM + Project Cost Summary ────────────────────── */}
      {loadedRun && (
        <div className="px-4 py-4 border-t border-slate-200 bg-white">
          <BreakdownBOM
            loadedRun={loadedRun}
            areas={areas}
            quotation={quotation}
          />
        </div>
      )}

      {/* ── Comparison modal ──────────────────────────────── */}
      <OptimizerComparisonPanel
        isOpen={compareOpen}
        onClose={() => setCompareOpen(false)}
        runs={runs}
        activeRunId={activeRunId}
      />
    </div>
  );
}
