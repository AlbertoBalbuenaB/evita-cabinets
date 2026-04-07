import { useEffect, useMemo, useState } from 'react';
import { Hammer, Play, Save, Loader2, RefreshCw, AlertTriangle, LayoutDashboard } from 'lucide-react';
import { Button } from '../../Button';
import { CADViewer } from '../CADViewer';
import { RightStatsPanel } from '../RightStatsPanel';
import { getQuotationOptimizerStore } from '../../../hooks/createQuotationOptimizerStore';
import { QuotationOptimizerSidebar } from './QuotationOptimizerSidebar';
import { OptimizerWarningsPanel } from './OptimizerWarningsPanel';
import type { OptimizationResult } from '../../../lib/optimizer/types';

interface Props {
  quotationId: string;
  totalCabinetsCount: number;
}

/**
 * Top-level component for the "Cut-list Pricing" tab inside ProjectDetails.
 *
 * Orchestrates the per-quotation Zustand store: on mount, lists existing
 * runs and loads the active one (if any). Provides the build → run →
 * save workflow in the header bar, and composes the reused CADViewer +
 * RightStatsPanel with the new QuotationOptimizerSidebar on the left.
 *
 * This tab intentionally does NOT render the project/client name in its
 * own header — the parent ProjectDetails already shows the quotation
 * breadcrumb above.
 */
export function QuotationOptimizerTab({ quotationId, totalCabinetsCount }: Props) {
  const useStore = useMemo(() => getQuotationOptimizerStore(quotationId), [quotationId]);

  // Reactive slices
  const isBuilding       = useStore((s) => s.isBuilding);
  const isOptimizing     = useStore((s) => s.isOptimizing);
  const isSaving         = useStore((s) => s.isSaving);
  const lastError        = useStore((s) => s.lastError);
  const pendingResult    = useStore((s) => s.pendingResult);
  const pendingPieces    = useStore((s) => s.pendingPieces);
  const pendingWarnings  = useStore((s) => s.pendingWarnings);
  const pendingCabCovered = useStore((s) => s.pendingCabinetsCovered);
  const pendingCabSkipped = useStore((s) => s.pendingCabinetsSkipped);
  const loadedRun        = useStore((s) => s.loadedRun);
  const runs             = useStore((s) => s.runs);
  const activeRunId      = useStore((s) => s.activeRunId);
  const isStale          = useStore((s) => s.isStale);

  // Actions
  const refreshRunsList = useStore((s) => s.refreshRunsList);
  const build           = useStore((s) => s.build);
  const runOptimize     = useStore((s) => s.runOptimize);
  const saveAsRun       = useStore((s) => s.saveAsRun);
  const loadRun         = useStore((s) => s.loadRun);

  // Local UI state
  const [selectedBoardIdx, setSelectedBoardIdx] = useState(0);
  const [saveName, setSaveName] = useState('');

  // On mount / quotation change: refresh runs and auto-load the active one.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await refreshRunsList();
      if (cancelled) return;
      const state = useStore.getState();
      if (state.activeRunId) {
        try { await loadRun(state.activeRunId); } catch { /* non-fatal */ }
      }
    })();
    return () => { cancelled = true; };
  }, [quotationId, refreshRunsList, loadRun, useStore]);

  // Pick the result to display: pending (unsaved) takes precedence over loaded.
  const displayResult: OptimizationResult | null =
    pendingResult ?? loadedRun?.result ?? null;

  const selectedBoard = displayResult && displayResult.boards.length > 0
    ? displayResult.boards[Math.min(selectedBoardIdx, displayResult.boards.length - 1)]
    : null;

  // Default the save name to something reasonable.
  const nextRunNumber = runs.length + 1;
  const defaultName = `Run #${nextRunNumber}`;

  async function handleSave() {
    const name = saveName.trim() || defaultName;
    try {
      await saveAsRun(name);
      setSaveName('');
    } catch {
      /* error is surfaced via lastError in the header */
    }
  }

  // Reset board index when the result changes.
  useEffect(() => {
    setSelectedBoardIdx(0);
  }, [displayResult]);

  return (
    <div className="flex flex-col" style={{ minHeight: 'calc(100vh - 104px)' }}>

      {/* ── Header bar ────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 px-4 py-2.5 flex items-center gap-2 flex-wrap">
        <LayoutDashboard className="h-5 w-5 text-blue-600 shrink-0" />
        <span className="font-semibold text-slate-800 text-sm">Cut-list Pricing</span>
        {activeRunId && (
          <span className="text-xs text-slate-400">
            Active: {runs.find((r) => r.id === activeRunId)?.name}
          </span>
        )}
        {isStale && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-medium">
            <AlertTriangle className="h-3 w-3" /> Stale — cabinets edited
          </span>
        )}

        <div className="flex-1" />

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
          onClick={() => refreshRunsList()}
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
    </div>
  );
}
