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
import { Hammer, Play, Save, Loader2, RefreshCw, Layers, FileDown } from 'lucide-react';
import { Button } from '../../Button';
import { ErrorBoundary } from '../../ErrorBoundary';
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
import { CutListDetailPanel, type CabinetDisplayInfo } from './CutListDetailPanel';
import { StaleBadge } from './StaleBadge';
import { BreakdownBOM } from './BreakdownBOM';
import type { OptimizationResult } from '../../../lib/optimizer/types';
import { allocateBoardCostsByArea } from '../../../lib/optimizer/quotation/computeOptimizerAreaSubtotals';
import type {
  PricingMethod,
  ProjectArea,
  AreaCabinet,
  AreaItem,
  AreaCountertop,
  AreaClosetItem,
  Quotation,
  PriceListItem,
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
  /**
   * Current pricing method from the parent. With the Phase-10 global
   * switch this is the canonical source of truth; the in-tab toggle only
   * reflects it. Passed alongside `onPricingMethodChange` so all writes go
   * through a single handler in ProjectDetails.
   */
  pricingMethod?: PricingMethod;
  /**
   * Delegated write handler for `quotations.pricing_method`. When the user
   * toggles inside this tab, we call this (instead of doing a supabase
   * update locally) so the parent can keep its UI state in sync and rerun
   * the rollup. Also used for the one-shot auto-switch after the first
   * successful run save.
   */
  onPricingMethodChange?: (next: PricingMethod) => Promise<void> | void;
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
  pricingMethod: parentPricingMethod,
  onPricingMethodChange: parentOnPricingMethodChange,
}: Props) {
  const useStore = useMemo(() => getQuotationOptimizerStore(quotationId), [quotationId]);

  // Fetch the price list once at this level so it runs in parallel with the
  // store's listRuns/loadActiveRun, instead of waiting for BreakdownBOM to
  // mount (which happens only after loadedRun arrives). Shaves several
  // seconds off the Breakdown tab first-paint.
  const [priceList, setPriceList] = useState<PriceListItem[] | null>(null);
  useEffect(() => {
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
          all = all.concat(data as PriceListItem[]);
          if (data.length < PAGE) break;
          from += PAGE;
        }
        if (!cancelled) setPriceList(all);
      } catch {
        if (!cancelled) setPriceList([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

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
  const storeExportLaw  = useStore((s) => s.exportLaw);

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

  // Keep the inner header slice's `pricingMethod` in sync with the parent
  // whenever the parent's value changes (e.g. user toggled from the global
  // FloatingActionBar switch while the Breakdown tab was open).
  useEffect(() => {
    if (parentPricingMethod) {
      setHeader((h) => (h.pricingMethod === parentPricingMethod ? h : { ...h, pricingMethod: parentPricingMethod }));
    }
  }, [parentPricingMethod]);

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
    // Capture whether this is the FIRST run for this quotation BEFORE the
    // save, so the post-save auto-switch is a one-shot (only runs the very
    // first time an optimizer result is persisted).
    const wasFirstRunBeforeSave = useStore.getState().runs.length === 0;
    try {
      await saveAsRun(name);
      setSaveName('');
      // One-shot auto-switch: after the first successful run save, flip
      // `pricing_method` to 'optimizer' automatically. Subsequent runs
      // respect whatever method the user has chosen (could be FT² if they
      // manually switched back). This matches the user-confirmed behavior.
      if (wasFirstRunBeforeSave && parentOnPricingMethodChange) {
        try {
          await parentOnPricingMethodChange('optimizer');
        } catch (err) {
          console.warn('[QuotationOptimizerTab] auto-switch to optimizer failed:', err);
        }
      }
      if (onRecomputeRollup) await onRecomputeRollup();
      await refreshHeader();
    } catch { /* surfaced via lastError */ }
  }

  async function handleSetActive(runId: string) {
    await setActive(runId);
    await loadRun(runId);
    if (onRecomputeRollup) await onRecomputeRollup();
    await refreshHeader();
  }

  async function handleDeleteRun(runId: string) {
    await deleteRun(runId);
    if (onRecomputeRollup) await onRecomputeRollup();
    await refreshHeader();
  }

  async function handlePricingMethodChange(next: PricingMethod) {
    // Optimistic UI: reflect the new value in the local header slice so
    // the segmented control highlights the selection immediately.
    setHeader((h) => ({ ...h, pricingMethod: next }));
    // Phase 10: delegate the actual DB write + rollup to the parent so
    // ProjectDetails stays the single source of truth for `pricing_method`
    // and the Info/Pricing/Analytics tabs + Header Card update in sync.
    if (parentOnPricingMethodChange) {
      try {
        await parentOnPricingMethodChange(next);
      } catch (err) {
        console.error('[QuotationOptimizerTab] parent handler failed:', err);
        await refreshHeader();
        return;
      }
    } else {
      // Legacy fallback for standalone use (should not happen in prod).
      const { error } = await supabase
        .from('quotations')
        .update({ pricing_method: next })
        .eq('id', quotationId);
      if (error) {
        await refreshHeader();
        alert(`Failed to switch pricing method: ${error.message}`);
        return;
      }
      if (onRecomputeRollup) await onRecomputeRollup();
    }
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
  //
  // The actual m²→cost allocation lives in `allocateBoardCostsByArea` so the
  // Breakdown tab, the MXN/USD PDF exporters, and any future diagnostics all
  // share a single source of truth for how a board's cost is split across
  // areas when its pieces span multiple areas.
  const perAreaRows = useMemo(() => {
    if (!loadedRun) return [];
    const { result, snapshot } = loadedRun;
    const attr = allocateBoardCostsByArea(result, snapshot.stocks);

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

  // Retro-compat fallback: for snapshots saved before `cabinetDetails` was
  // persisted, re-query area_cabinets + products_catalog so the Cut-list
  // labels still show SKU + description. Keyed by loadedRun.builtAt so the
  // effect refires when switching between runs.
  const [legacyCabinetDetails, setLegacyCabinetDetails] = useState<
    Record<string, CabinetDisplayInfo>
  >({});
  useEffect(() => {
    if (!loadedRun || loadedRun.snapshot.cabinetDetails) {
      setLegacyCabinetDetails({});
      return;
    }
    const cabinetIds = Array.from(
      new Set(
        loadedRun.snapshot.pieces
          .map((p) => p.cabinetId)
          .filter((id): id is string => !!id),
      ),
    );
    if (cabinetIds.length === 0) {
      setLegacyCabinetDetails({});
      return;
    }
    let cancelled = false;
    (async () => {
      const { data: cabs, error: cabErr } = await supabase
        .from('area_cabinets')
        .select('id, product_sku, quantity, project_areas!inner(id, name)')
        .in('id', cabinetIds);
      if (cancelled || cabErr || !cabs) return;

      const skus = Array.from(
        new Set(
          cabs
            .map((c) => c.product_sku)
            .filter((s): s is string => !!s),
        ),
      );
      const descBySku = new Map<string, string>();
      if (skus.length > 0) {
        const { data: prods } = await supabase
          .from('products_catalog')
          .select('sku, description')
          .in('sku', skus);
        for (const p of prods ?? []) descBySku.set(p.sku, p.description);
      }

      if (cancelled) return;
      const map: Record<string, CabinetDisplayInfo> = {};
      for (const c of cabs as Array<{
        id: string;
        product_sku: string | null;
        quantity: number | null;
        project_areas: { id: string; name: string } | { id: string; name: string }[];
      }>) {
        const pa = Array.isArray(c.project_areas) ? c.project_areas[0] : c.project_areas;
        map[c.id] = {
          productSku: c.product_sku,
          productDescription: c.product_sku ? descBySku.get(c.product_sku) ?? null : null,
          quantity: c.quantity ?? 1,
          areaId: pa?.id ?? '',
          areaName: pa?.name ?? '(unknown area)',
        };
      }
      setLegacyCabinetDetails(map);
    })();
    return () => { cancelled = true; };
  }, [loadedRun]);

  // Source of truth for the cut-list detail panel:
  //   1. Prefer the pending build (user's current editing session).
  //   2. If a run is loaded, use `snapshot.cabinetDetails` when present.
  //   3. Otherwise (legacy snapshot), use the re-queried `legacyCabinetDetails`.
  //   4. Final fallback: reconstruct labels from the per-piece `area` tag.
  const cutListSource = useMemo(() => {
    if (pendingPieces.length > 0) {
      return { pieces: pendingPieces, cabinetDetails: pendingCabinetDetails };
    }
    if (loadedRun) {
      const snap = loadedRun.snapshot;
      if (snap.cabinetDetails) {
        return { pieces: snap.pieces, cabinetDetails: snap.cabinetDetails };
      }
      if (Object.keys(legacyCabinetDetails).length > 0) {
        return { pieces: snap.pieces, cabinetDetails: legacyCabinetDetails };
      }
      // Final fallback: derive minimal labels from piece tags.
      const derived: Record<string, CabinetDisplayInfo> = {};
      for (const p of snap.pieces) {
        if (!p.cabinetId || derived[p.cabinetId]) continue;
        derived[p.cabinetId] = {
          productSku: null,
          productDescription: null,
          quantity: 1,
          areaId: p.areaId ?? '',
          areaName: p.area ?? '(unknown area)',
        };
      }
      return { pieces: snap.pieces, cabinetDetails: derived };
    }
    return null;
  }, [pendingPieces, pendingCabinetDetails, loadedRun, legacyCabinetDetails]);

  const canSelectOptimizer = activeRunId != null;

  return (
    // Local ErrorBoundary isolates a tab crash (e.g. sync throw from the
    // optimizer engine) from the rest of the page — the sidebar, other
    // tabs, and the AI chat stay usable while the Breakdown is broken.
    // This supplements but does not replace the hard timeout in the
    // store: the timeout catches main-thread freezes, this catches
    // thrown errors during render.
    <ErrorBoundary
      fallback={
        <div className="glass-white p-6 rounded-[14px] shadow-card border border-status-red-brd m-4">
          <h3 className="text-fg-900 font-semibold mb-2">Breakdown tab crashed</h3>
          <p className="text-fg-700 text-sm mb-3">
            Something went wrong rendering the optimizer. Open DevTools → Console for the error,
            then reload the page.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="bg-accent-primary text-accent-on shadow-btn rounded-lg px-4 py-2 text-sm"
          >
            Reload
          </button>
        </div>
      }
    >
    {/* Full-bleed wrapper: escape the Layout's max-w-7xl container so the
        Breakdown tab uses the full width of the main column. Only affects
        this tab — the other tabs (Info, Pricing, Analytics, History) still
        respect the centered container.

        --content-offset is the sidebar rail width on desktop and 0 on
        mobile (see index.css). It keeps the full-bleed box aligned with
        the main column instead of the raw viewport, so the left edge
        doesn't slide behind the sidebar on lg+ screens. */}
    <div
      className="relative"
      style={{
        width: 'calc(100vw - var(--content-offset, 0px))',
        marginLeft: 'calc(50% - 50vw + var(--content-offset, 0px) / 2)',
        marginRight: 'calc(50% - 50vw + var(--content-offset, 0px) / 2)',
      }}
    >
    <div className="flex flex-col" style={{ minHeight: 'calc(100vh - 104px)' }}>

      {/* ── Header bar ────────────────────────────────────── */}
      <div className="bg-surf-card border-b border-border-soft px-4 py-2.5 flex items-center gap-2 flex-wrap">
        <Layers className="h-5 w-5 text-accent-text shrink-0" />
        <span className="font-semibold text-fg-800 text-sm">Optimizer</span>

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
              className="px-2 py-1 text-xs border border-border-soft rounded w-32 focus:ring-1 focus-visible:ring-focus focus:outline-none"
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
          onClick={() => storeExportLaw()}
          disabled={!pendingResult && !loadedRun}
          className="flex items-center gap-1"
          title="Export .law for CNC panel saw"
        >
          <FileDown className="h-3.5 w-3.5" />.law
        </Button>

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
        <div className="bg-status-red-bg border-b border-status-red-brd px-4 py-2 text-xs text-status-red-fg">
          {lastError}
        </div>
      )}

      {/* ── Comparison strip (ft² vs optimizer total) ─────── */}
      <div className="px-4 py-3 border-b border-border-soft bg-surf-app">
        <FtVsOptimizerComparisonCard
          sqftTotal={header.sqftTotal}
          optimizerTotal={header.optimizerTotal}
          activeMethod={header.pricingMethod}
        />
      </div>

      {/* ── Warnings strip ────────────────────────────────── */}
      {(pendingWarnings.length > 0 || pendingCabSkipped.length > 0 || pendingPieces.length > 0) && (
        <div className="px-4 py-2 border-b border-border-soft bg-surf-app">
          <OptimizerWarningsPanel
            warnings={pendingWarnings}
            cabinetsSkipped={pendingCabSkipped}
            cabinetsCoveredCount={pendingCabCovered.size}
            totalCabinetsCount={totalCabinetsCount}
          />
        </div>
      )}

      {/* ── Row 1 — Post-Build: Sidebar (Build Summary / Stocks /     */}
      {/*         Edgebanding / Settings) + Cut-List Detail          */}
      <div className="flex min-h-[400px] border-b border-border-soft">
        <div className="w-64 shrink-0 border-r border-border-soft bg-surf-card overflow-y-auto">
          <QuotationOptimizerSidebar useStore={useStore} />
        </div>
        <div className="flex-1 bg-surf-app overflow-y-auto px-4 py-4">
          {cutListSource && cutListSource.pieces.length > 0 ? (
            <CutListDetailPanel
              pieces={cutListSource.pieces}
              cabinetDetails={cutListSource.cabinetDetails}
              onOverrideChanged={() => build()}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-fg-400 text-sm">
              Click "Build from Quotation" to generate the cut list.
            </div>
          )}
        </div>
      </div>

      {/* ── Row 2 — Post-Run: CAD Viewer + Global Statistics ── */}
      {displayResult && (
        <div className="flex min-h-[600px] border-b border-border-soft">
          <div className="flex-1 flex flex-col bg-surf-card">
            <CADViewer board={selectedBoard} unit="mm" />
          </div>
          <div className="w-80 shrink-0 border-l border-border-soft bg-surf-card overflow-y-auto">
            <RightStatsPanel
              result={displayResult}
              selectedIdx={selectedBoardIdx}
              onSelectBoard={(idx) => setSelectedBoardIdx(idx)}
            />
          </div>
        </div>
      )}

      {loadedRun && perAreaRows.length > 0 && (
        <div className="px-4 py-4 border-t border-border-soft bg-surf-app">
          <PerAreaBoardsBreakdown rows={perAreaRows} />
        </div>
      )}

      {/* ── BOM + Project Cost Summary ────────────────────── */}
      {loadedRun && (
        <div className="px-4 py-4 border-t border-border-soft bg-surf-card">
          <BreakdownBOM
            loadedRun={loadedRun}
            areas={areas}
            quotation={quotation}
            priceList={priceList}
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
    </div>
    </ErrorBoundary>
  );
}
