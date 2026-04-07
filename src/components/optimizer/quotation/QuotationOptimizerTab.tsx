import { useEffect, useMemo, useState, useCallback } from 'react';
import { Hammer, Play, Save, Loader2, RefreshCw, LayoutDashboard } from 'lucide-react';
import { Button } from '../../Button';
import { CADViewer } from '../CADViewer';
import { RightStatsPanel } from '../RightStatsPanel';
import { getQuotationOptimizerStore } from '../../../hooks/createQuotationOptimizerStore';
import { supabase } from '../../../lib/supabase';
import { QuotationOptimizerSidebar } from './QuotationOptimizerSidebar';
import { OptimizerWarningsPanel } from './OptimizerWarningsPanel';
import { OptimizerVersionsList } from './OptimizerVersionsList';
import { OptimizerComparisonPanel } from './OptimizerComparisonPanel';
import { PricingMethodToggle } from './PricingMethodToggle';
import { FtVsOptimizerComparisonCard } from './FtVsOptimizerComparisonCard';
import { PerAreaBoardsBreakdown } from './PerAreaBoardsBreakdown';
import { StaleBadge } from './StaleBadge';
import type { OptimizationResult } from '../../../lib/optimizer/types';
import type { PricingMethod } from '../../../types';

interface Props {
  quotationId: string;
  totalCabinetsCount: number;
  /** Map of area_id → area name, so the per-area breakdown can show labels. */
  areasById: Record<string, string>;
}

interface QuotationHeaderSlice {
  sqftTotal: number;
  optimizerTotal: number | null;
  pricingMethod: PricingMethod;
  optimizerIsStale: boolean;
}

/**
 * Top-level component for the "Cut-list Pricing" tab inside ProjectDetails.
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
export function QuotationOptimizerTab({ quotationId, totalCabinetsCount, areasById }: Props) {
  const useStore = useMemo(() => getQuotationOptimizerStore(quotationId), [quotationId]);

  // Reactive slices from the per-quotation store.
  const isBuilding        = useStore((s) => s.isBuilding);
  const isOptimizing      = useStore((s) => s.isOptimizing);
  const isSaving          = useStore((s) => s.isSaving);
  const lastError         = useStore((s) => s.lastError);
  const pendingResult     = useStore((s) => s.pendingResult);
  const pendingPieces     = useStore((s) => s.pendingPieces);
  const pendingWarnings   = useStore((s) => s.pendingWarnings);
  const pendingCabCovered = useStore((s) => s.pendingCabinetsCovered);
  const pendingCabSkipped = useStore((s) => s.pendingCabinetsSkipped);
  const loadedRun         = useStore((s) => s.loadedRun);
  const runs              = useStore((s) => s.runs);
  const activeRunId       = useStore((s) => s.activeRunId);

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
      await refreshHeader();
    } catch { /* surfaced via lastError */ }
  }

  async function handleSetActive(runId: string) {
    await setActive(runId);
    await refreshHeader();
  }

  async function handleDeleteRun(runId: string) {
    await deleteRun(runId);
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
    }
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
        await refreshHeader();
      }
    } catch { /* surfaced via lastError */ }
  }

  // Reset board index when the result changes.
  useEffect(() => { setSelectedBoardIdx(0); }, [displayResult]);

  // Per-area breakdown rows (from the loaded run's snapshot).
  const perAreaRows = useMemo(() => {
    const attribution = loadedRun?.snapshot.areaAttribution ?? {};
    return Object.entries(attribution).map(([areaId, v]) => ({
      areaId,
      areaName: areasById[areaId] ?? '(unknown area)',
      m2: v.m2,
      cost: v.cost,
      boards: v.boards,
    })).sort((a, b) => b.cost - a.cost);
  }, [loadedRun, areasById]);

  const canSelectOptimizer = activeRunId != null;

  return (
    <div className="flex flex-col" style={{ minHeight: 'calc(100vh - 104px)' }}>

      {/* ── Header bar ────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 px-4 py-2.5 flex items-center gap-2 flex-wrap">
        <LayoutDashboard className="h-5 w-5 text-blue-600 shrink-0" />
        <span className="font-semibold text-slate-800 text-sm">Cut-list Pricing</span>

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
      {loadedRun && perAreaRows.length > 0 && (
        <div className="px-4 py-4 border-t border-slate-200 bg-slate-50">
          <PerAreaBoardsBreakdown rows={perAreaRows} />
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
