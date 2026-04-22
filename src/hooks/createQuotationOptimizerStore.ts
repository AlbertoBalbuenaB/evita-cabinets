/**
 * Per-quotation Zustand store factory for the optimizer-pricing path.
 *
 * The existing `useOptimizerStore` singleton powers the standalone
 * `OptimizerPage` and MUST NOT be touched — it is consumed by
 * `OptimizerSidebar` / `CADViewer` / `RightStatsPanel` and refactoring
 * it to a factory would cascade into those components.
 *
 * Instead, this file exports `getQuotationOptimizerStore(quotationId)`
 * which returns a fresh Zustand hook bound to a single quotation. The
 * hook is cached in a module-local Map so remounts return the same
 * instance. This lets the `QuotationOptimizerTab` (Phase 5) and the
 * comparison panel (Phase 6) read from multiple quotations side-by-side
 * without any cross-talk, and keeps state naturally scoped to the
 * active quotation.
 *
 * The store composes the Phase 3 pure functions and the Phase 3 repo
 * layer. It owns:
 *   - the currently loaded run (snapshot + engine result)
 *   - the list of saved runs (light metadata)
 *   - pending build state (pieces / stocks / eb from the last build)
 *   - optimizer settings (sierra, minOffcut, boardTrim, trimIncludesKerf)
 *   - stale flag (mirrored from DB on refresh)
 *   - warnings from the last build
 *
 * It does NOT own the current OptimizationResult for an unsaved run —
 * that's kept in `pendingResult` until `saveAsRun` persists it.
 */

import { create, type StoreApi, type UseBoundStore } from 'zustand';
import { supabase } from '../lib/supabase';
import { runOptimizationParallel } from '../lib/optimizer/parallelOptimization';
import type {
  Pieza,
  StockSize,
  EbConfig,
  EbCabinetMap,
  EbTypeSummary,
  OptimizationResult,
  EngineMode,
  OptimizationObjective,
} from '../lib/optimizer/types';
import type { QuotationOptimizerRun } from '../types';

import { exportLaw } from '../lib/optimizer/lawExport';
import { buildOptimizerSetupFromQuotation } from '../lib/optimizer/quotation/buildOptimizerSetupFromQuotation';
import { computeEdgebandCost } from '../lib/optimizer/quotation/computeEdgebandCost';
import { attributeBoardsToAreas } from '../lib/optimizer/quotation/attributeBoardsToAreas';
import { deriveKpis, type OptimizerRunSnapshot } from '../lib/optimizer/quotation/types';
import {
  listRuns,
  loadRun as repoLoadRun,
  loadActiveRun,
  createRun,
  setActiveRun as repoSetActiveRun,
  renameRun as repoRenameRun,
  deleteRun as repoDeleteRun,
} from '../lib/optimizer/quotation/quotationOptimizerRepo';

// ─────────────────────────────────────────────────────────────────────────────
// Store shape
// ─────────────────────────────────────────────────────────────────────────────

export interface QuotationOptimizerState {
  // Identity
  quotationId: string;

  // Runs list (light metadata, no heavy snapshot/result)
  runs: QuotationOptimizerRun[];
  activeRunId: string | null;
  isStale: boolean;

  // Currently loaded run (from DB)
  loadedRun: {
    snapshot: OptimizerRunSnapshot;
    result: OptimizationResult;
    /** DB-persisted material_cost (boards) for this run. When present,
     *  consumers should use this instead of `result.totalCost` so that
     *  Breakdown pricing agrees with Info (which also reads from the
     *  optimizer_runs row, not from the recomputed snapshot). */
    materialCostDb?: number;
    /** DB-persisted edgeband_cost for this run. Same rationale as
     *  materialCostDb — keeps Breakdown's totals in lockstep with Info. */
    edgebandCostDb?: number;
  } | null;

  // Pending build (not yet saved as a run)
  pendingPieces: Pieza[];
  pendingStocks: StockSize[];
  pendingEbConfig: EbConfig;
  pendingEbSlotToPriceListId: Record<'a' | 'b' | 'c', string | null>;
  pendingEbCabinetMap: EbCabinetMap;
  pendingEbTypeSummary: Record<string, EbTypeSummary>;
  pendingCabinetsCovered: Set<string>;
  pendingCabinetsSkipped: Array<{ id: string; reason: string }>;
  pendingCabinetInstanceCount: number;
  pendingCabinetDetails: Record<string, {
    productSku: string | null;
    productDescription: string | null;
    quantity: number;
    areaId: string;
    areaName: string;
    hasOverride?: boolean;
  }>;
  pendingWarnings: string[];
  pendingResult: OptimizationResult | null;
  pendingBuiltAt: string | null;

  // Stock / edgeband selection for the next optimize run
  selectedStockIds: Set<string>;
  selectedEbSlots:  Set<'a' | 'b' | 'c'>;

  // Engine settings
  globalSierra: number;
  minOffcut: number;
  boardTrim: number;
  trimIncludesKerf: boolean;
  engineMode: EngineMode;
  objective: OptimizationObjective;

  // Flags
  isBuilding: boolean;
  isOptimizing: boolean;
  isSaving: boolean;
  lastError: string | null;

  /**
   * Per-group progress snapshot while the parallel pool is running. Null
   * when no run is active. The UI's `OptimizerProgressBand` reads this
   * slice to render the bar + "material X of N" label.
   */
  optimizerProgress: { completed: number; total: number; current: string | null } | null;

  // Settings actions
  setGlobalSierra: (v: number) => void;
  setMinOffcut: (v: number) => void;
  setBoardTrim: (v: number) => void;
  setTrimIncludesKerf: (v: boolean) => void;
  setEngineMode: (v: EngineMode) => void;
  setObjective: (v: OptimizationObjective) => void;
  toggleStockSelected: (id: string) => void;
  toggleEbSlot: (slot: 'a' | 'b' | 'c') => void;

  // Async actions
  refreshRunsList: () => Promise<void>;
  build: () => Promise<void>;
  runOptimize: () => Promise<void>;
  /** Abort the in-flight parallel run. Terminates all active sub-workers
   *  and clears `optimizerProgress`. No-op if no run is active. */
  cancelOptimize: () => void;
  saveAsRun: (name: string, opts?: { setActive?: boolean }) => Promise<string>;
  loadRun: (runId: string) => Promise<void>;
  setActive: (runId: string) => Promise<void>;
  renameRun: (runId: string, name: string) => Promise<void>;
  deleteRun: (runId: string) => Promise<void>;
  clearPending: () => void;
  /**
   * Re-fetch the current price_list.price for every stock in the pending
   * build and update `pendingStocks[i].costo`. Invalidates any pending
   * engine result (stocks changed → previous optimization is obsolete).
   * Use this after the user updates prices in the inventory module
   * without touching cabinet configurations.
   */
  refreshStocks: () => Promise<void>;
  exportLaw: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────────────────────

type QuotationOptimizerStoreHook = UseBoundStore<StoreApi<QuotationOptimizerState>>;

const storeCache = new Map<string, QuotationOptimizerStoreHook>();

/**
 * Returns the cached Zustand hook for `quotationId`, or creates one on first
 * access. React components call this inside their body to get a stable hook:
 *
 *   const useStore = getQuotationOptimizerStore(quotationId);
 *   const runs = useStore(s => s.runs);
 *
 * Do NOT call this inside effects or callbacks — treat it like any other
 * hook factory.
 */
export function getQuotationOptimizerStore(
  quotationId: string,
): QuotationOptimizerStoreHook {
  const cached = storeCache.get(quotationId);
  if (cached) return cached;

  // Per-store AbortController for the in-flight parallel run. Lives in the
  // factory closure (not Zustand state) because AbortController is not
  // serializable and each quotation has its own store instance.
  let activeAbortController: AbortController | null = null;

  const hook = create<QuotationOptimizerState>((set, get) => ({
    quotationId,

    runs: [],
    activeRunId: null,
    isStale: false,
    loadedRun: null,

    pendingPieces: [],
    pendingStocks: [],
    pendingEbConfig: {
      a: { id: '', name: '', price: 0 },
      b: { id: '', name: '', price: 0 },
      c: { id: '', name: '', price: 0 },
    },
    pendingEbSlotToPriceListId: { a: null, b: null, c: null },
    pendingEbCabinetMap: {},
    pendingEbTypeSummary: {},
    pendingCabinetsCovered: new Set<string>(),
    pendingCabinetsSkipped: [],
    pendingCabinetInstanceCount: 0,
    pendingCabinetDetails: {},
    pendingWarnings: [],
    pendingResult: null,
    pendingBuiltAt: null,

    selectedStockIds: new Set<string>(),
    selectedEbSlots:  new Set<'a' | 'b' | 'c'>(['a', 'b', 'c']),

    globalSierra: 4.5,
    minOffcut: 200,
    boardTrim: 5,
    trimIncludesKerf: true,
    engineMode: 'guillotine' as EngineMode,
    objective: 'min-boards' as OptimizationObjective,

    isBuilding: false,
    isOptimizing: false,
    isSaving: false,
    lastError: null,
    optimizerProgress: null,

    setGlobalSierra:     (v) => set({ globalSierra: v }),
    setMinOffcut:        (v) => set({ minOffcut: v }),
    setBoardTrim:        (v) => set({ boardTrim: v }),
    setTrimIncludesKerf: (v) => set({ trimIncludesKerf: v }),
    setEngineMode:       (v) => set({ engineMode: v }),
    setObjective:        (v) => set({ objective: v }),

    toggleStockSelected: (id) => set((state) => {
      const next = new Set(state.selectedStockIds);
      if (next.has(id)) next.delete(id); else next.add(id);
      return { selectedStockIds: next };
    }),

    toggleEbSlot: (slot) => set((state) => {
      const next = new Set(state.selectedEbSlots);
      if (next.has(slot)) next.delete(slot); else next.add(slot);
      return { selectedEbSlots: next };
    }),

    // ── Refresh the runs list + active run from DB ────────────────────────
    refreshRunsList: async () => {
      try {
        const [runs, active] = await Promise.all([
          listRuns(quotationId),
          loadActiveRun(quotationId),
        ]);
        set({
          runs,
          activeRunId: active?.id ?? null,
          isStale: active?.is_stale ?? false,
        });
      } catch (err) {
        set({ lastError: err instanceof Error ? err.message : String(err) });
      }
    },

    // ── Build pieces/stocks/eb from the current quotation state ───────────
    build: async () => {
      set({ isBuilding: true, lastError: null });
      try {
        const result = await buildOptimizerSetupFromQuotation(quotationId, supabase);
        set({
          pendingPieces:             result.pieces,
          pendingStocks:             result.stocks,
          pendingEbConfig:           result.ebConfig,
          pendingEbSlotToPriceListId: result.ebSlotToPriceListId,
          pendingEbCabinetMap:       result.ebCabinetMap,
          pendingEbTypeSummary:      result.ebTypeSummary,
          pendingCabinetsCovered:    result.cabinetsCovered,
          pendingCabinetsSkipped:    result.cabinetsSkipped,
          pendingCabinetInstanceCount: result.cabinetsInstanceCount,
          pendingCabinetDetails:     result.cabinetDetails,
          pendingWarnings:           result.warnings,
          pendingResult:             null,        // invalidate any stale result
          pendingBuiltAt:            new Date().toISOString(),
          isBuilding:                false,
          // Default: all stocks and EB slots selected.
          selectedStockIds: new Set(result.stocks.map((s) => s.id)),
          selectedEbSlots:  new Set<'a' | 'b' | 'c'>(['a', 'b', 'c']),
        });
      } catch (err) {
        set({
          isBuilding: false,
          lastError: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }
    },

    // ── Run the optimizer on the pending build ────────────────────────────
    runOptimize: async () => {
      const state = get();
      if (state.pendingPieces.length === 0) {
        set({ lastError: 'Nothing to optimize — build from quotation first.' });
        return;
      }
      // Replace any stale controller (shouldn't happen in normal flow, but
      // guards against a second Run click before the prior promise settles).
      if (activeAbortController) {
        try { activeAbortController.abort(); } catch { /* noop */ }
      }
      activeAbortController = new AbortController();
      const signal = activeAbortController.signal;

      set({ isOptimizing: true, lastError: null, optimizerProgress: null });
      // Yield a tick so the UI can show the initial spinner frame.
      await new Promise((r) => setTimeout(r, 50));
      try {
        const effectiveTrim = state.trimIncludesKerf
          ? state.boardTrim
          : state.boardTrim + state.globalSierra;
        const activeStocks = state.pendingStocks.filter((s) =>
          state.selectedStockIds.has(s.id),
        );
        const activeStockNames = new Set(activeStocks.map((s) => s.nombre));
        const activePieces = state.pendingPieces.filter((p) =>
          activeStockNames.has(p.material),
        );

        console.log('[runOptimize] invoking parallel pool', {
          activePieces: activePieces.length,
          activeStocks: activeStocks.length,
          totalExpanded: activePieces.reduce((s, p) => s + p.cantidad, 0),
          engineMode: state.engineMode,
          objective: state.objective,
        });

        const result = await runOptimizationParallel({
          pieces: activePieces,
          stocks: activeStocks,
          remnants: [], // no remnants in quotation mode for now
          globalSierra: state.globalSierra,
          minOffcut: state.minOffcut,
          boardTrim: effectiveTrim,
          engineMode: state.engineMode,
          objective: state.objective,
          signal,
          onProgress: (p) => set({ optimizerProgress: p }),
          timeoutMs: 120_000,
        });
        set({ pendingResult: result, isOptimizing: false, optimizerProgress: null });
      } catch (err) {
        console.error('[runOptimize] failed', err);
        const isAbort = err instanceof DOMException && err.name === 'AbortError';
        set({
          isOptimizing: false,
          optimizerProgress: null,
          lastError: isAbort
            ? 'Optimizer run cancelled.'
            : (err instanceof Error ? err.message : String(err)),
        });
        if (!isAbort) throw err;
      } finally {
        activeAbortController = null;
      }
    },

    // ── Cancel the in-flight parallel run ─────────────────────────────────
    cancelOptimize: () => {
      if (activeAbortController) {
        activeAbortController.abort();
      }
    },

    // ── Persist the current pending result as a new run ───────────────────
    saveAsRun: async (name, opts) => {
      const state = get();
      if (!state.pendingResult) {
        const msg = 'No optimization result to save — run the optimizer first.';
        set({ lastError: msg });
        throw new Error(msg);
      }

      set({ isSaving: true, lastError: null });
      try {
        // Compute edgeband cost (Phase 3 pure fn).
        // Only include slots the user has selected (EB checkbox in sidebar).
        const ebPriceBySlot: Record<'a' | 'b' | 'c', number> = {
          a: state.selectedEbSlots.has('a') ? (state.pendingEbConfig.a.price ?? 0) : 0,
          b: state.selectedEbSlots.has('b') ? (state.pendingEbConfig.b.price ?? 0) : 0,
          c: state.selectedEbSlots.has('c') ? (state.pendingEbConfig.c.price ?? 0) : 0,
        };
        const edgeband = computeEdgebandCost(state.pendingPieces, ebPriceBySlot, state.pendingEbCabinetMap);

        // Per-area attribution (Phase 3 pure fn).
        const areaAttribution = attributeBoardsToAreas(state.pendingResult);

        // Per-cabinet attribution: sum placed pieces' m² by cabinetId.
        const cabinetAttribution: Record<string, { m2: number; cost: number }> = {};
        for (const board of state.pendingResult.boards) {
          if (board.placed.length === 0) continue;
          let totalM2 = 0;
          const perCabM2: Record<string, number> = {};
          for (const pp of board.placed) {
            const id = pp.piece.cabinetId;
            if (!id) continue;
            const m2 = (pp.w * pp.h) / 1_000_000;
            perCabM2[id] = (perCabM2[id] ?? 0) + m2;
            totalM2 += m2;
          }
          if (totalM2 <= 0) continue;
          for (const [id, m2] of Object.entries(perCabM2)) {
            const frac = m2 / totalM2;
            const bucket = (cabinetAttribution[id] ??= { m2: 0, cost: 0 });
            bucket.m2   += m2;
            bucket.cost += board.stockInfo.costo * frac;
          }
        }

        // Freeze everything into the snapshot shape.
        const snapshot: OptimizerRunSnapshot = {
          version: 1,
          pieces:             state.pendingPieces,
          stocks:             state.pendingStocks,
          ebConfig:           state.pendingEbConfig,
          ebSlotToPriceListId: state.pendingEbSlotToPriceListId,
          settings: {
            sierra:           state.globalSierra,
            minOffcut:        state.minOffcut,
            boardTrim:        state.boardTrim,
            trimIncludesKerf: state.trimIncludesKerf,
          },
          areaAttribution,
          cabinetAttribution,
          edgebandCostByCabinet: edgeband.perCabinet,
          ebCabinetMap:          state.pendingEbCabinetMap,
          ebTypeSummary:         state.pendingEbTypeSummary,
          warnings:              state.pendingWarnings,
          cabinetsCovered:       Array.from(state.pendingCabinetsCovered),
          cabinetsSkipped:       state.pendingCabinetsSkipped,
          cabinetDetails:        state.pendingCabinetDetails,
          builtAt:               state.pendingBuiltAt ?? new Date().toISOString(),
        };

        // KPIs for the denormalized columns.
        const kpis = deriveKpis(state.pendingResult, edgeband.totalCost);

        // Default: if this is the first run for the quotation, set it active.
        const runs = state.runs;
        const setActive = opts?.setActive ?? runs.length === 0;

        // Strip cutTree before persisting: the recursive CutTreeNode structure can be
        // several MB per board and would blow up the Supabase JSONB column limit.
        // Cut sequences are re-generated on demand from board.placed coordinates.
        const resultForDb = state.pendingResult
          ? {
              ...state.pendingResult,
              boards: state.pendingResult.boards.map(({ cutTree: _ct, ...board }) => board),
            }
          : state.pendingResult;

        const runId = await createRun({
          quotationId,
          name,
          snapshot,
          result: resultForDb,
          kpis,
          setActive,
        });

        // Refresh the runs list so the UI reflects the new row.
        const freshRuns = await listRuns(quotationId);
        const active = await loadActiveRun(quotationId);
        set({
          runs: freshRuns,
          activeRunId: active?.id ?? null,
          isStale: active?.is_stale ?? false,
          isSaving: false,
          // Populate loadedRun immediately so BreakdownBOM renders
          // without requiring a page reload. Include the just-persisted
          // kpis so Breakdown reads the same material/edgeband cost
          // values the DB now holds (Info reads the same row).
          loadedRun: {
            snapshot,
            result: state.pendingResult!,
            materialCostDb: kpis.materialCost,
            edgebandCostDb: kpis.edgebandCost,
          },
        });

        return runId;
      } catch (err) {
        set({
          isSaving: false,
          lastError: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }
    },

    // ── Load a saved run into loadedRun ───────────────────────────────────
    loadRun: async (runId) => {
      set({ lastError: null });
      try {
        const row = await repoLoadRun(runId);
        const snapshot = row.snapshot as unknown as OptimizerRunSnapshot;
        const result   = row.result   as unknown as OptimizationResult;
        set({
          loadedRun: {
            snapshot,
            result,
            materialCostDb: Number(row.material_cost ?? 0),
            edgebandCostDb: Number(row.edgeband_cost ?? 0),
          },
          // Reflect the loaded run's settings in the sidebar.
          globalSierra:     snapshot.settings.sierra,
          minOffcut:        snapshot.settings.minOffcut,
          boardTrim:        snapshot.settings.boardTrim,
          trimIncludesKerf: snapshot.settings.trimIncludesKerf,
        });
      } catch (err) {
        set({ lastError: err instanceof Error ? err.message : String(err) });
        throw err;
      }
    },

    // ── Toggle a run to active ────────────────────────────────────────────
    setActive: async (runId) => {
      set({ lastError: null });
      try {
        await repoSetActiveRun(quotationId, runId);
        const [runs, active] = await Promise.all([
          listRuns(quotationId),
          loadActiveRun(quotationId),
        ]);
        set({
          runs,
          activeRunId: active?.id ?? null,
          isStale: active?.is_stale ?? false,
        });
      } catch (err) {
        set({ lastError: err instanceof Error ? err.message : String(err) });
        throw err;
      }
    },

    renameRun: async (runId, name) => {
      set({ lastError: null });
      try {
        await repoRenameRun(runId, name);
        const runs = await listRuns(quotationId);
        set({ runs });
      } catch (err) {
        set({ lastError: err instanceof Error ? err.message : String(err) });
        throw err;
      }
    },

    deleteRun: async (runId) => {
      set({ lastError: null });
      try {
        await repoDeleteRun(runId);
        const [runs, active] = await Promise.all([
          listRuns(quotationId),
          loadActiveRun(quotationId),
        ]);
        set({
          runs,
          activeRunId: active?.id ?? null,
          isStale: active?.is_stale ?? false,
          // If the deleted run was loaded, clear it.
          loadedRun: get().loadedRun && runs.every((r) => r.id !== runId)
            ? null
            : get().loadedRun,
        });
      } catch (err) {
        set({ lastError: err instanceof Error ? err.message : String(err) });
        throw err;
      }
    },

    clearPending: () => set({
      pendingPieces: [],
      pendingStocks: [],
      pendingResult: null,
      pendingWarnings: [],
      pendingCabinetsCovered: new Set<string>(),
      pendingCabinetsSkipped: [],
      pendingCabinetInstanceCount: 0,
      pendingCabinetDetails: {},
      pendingBuiltAt: null,
    }),

    // ── Refresh pendingStocks[*].costo from current price_list prices ──
    refreshStocks: async () => {
      const state = get();
      const materialIds = state.pendingStocks
        .map((s) => s.materialId)
        .filter((id): id is string => !!id);
      if (materialIds.length === 0) {
        set({ lastError: 'No stocks to refresh. Build from quotation first.' });
        return;
      }

      set({ lastError: null });
      try {
        const { data, error } = await supabase
          .from('price_list')
          .select('id, price')
          .in('id', materialIds);
        if (error) throw error;

        const priceById = new Map<string, number>();
        for (const row of data ?? []) priceById.set(row.id, Number(row.price ?? 0));

        let changedCount = 0;
        const updatedStocks = state.pendingStocks.map((stock) => {
          if (!stock.materialId) return stock;
          const fresh = priceById.get(stock.materialId);
          if (fresh == null || fresh === stock.costo) return stock;
          changedCount += 1;
          return { ...stock, costo: fresh };
        });

        set({
          pendingStocks: updatedStocks,
          // Stocks changed → previous engine result is now stale.
          pendingResult: changedCount > 0 ? null : state.pendingResult,
          pendingWarnings: changedCount > 0
            ? [...state.pendingWarnings, `Refreshed ${changedCount} stock price${changedCount === 1 ? '' : 's'} from price_list. Re-run the optimizer to apply.`]
            : state.pendingWarnings,
        });
      } catch (err) {
        set({ lastError: err instanceof Error ? err.message : String(err) });
        throw err;
      }
    },

    exportLaw: () => {
      const state = get();
      const result = state.pendingResult ?? state.loadedRun?.result ?? null;
      if (!result) { alert('Run optimization first'); return; }
      exportLaw(result, { projectName: `Quotation_${state.quotationId.slice(0, 8)}` });
    },
  }));

  storeCache.set(quotationId, hook);
  return hook;
}

/**
 * Discard the cached store for a quotation (e.g. when the user navigates
 * away permanently or deletes the quotation). Not normally needed — caches
 * are cheap.
 */
export function dropQuotationOptimizerStore(quotationId: string): void {
  storeCache.delete(quotationId);
}
