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
import { runOptimization } from '../lib/optimizer/engine';
import type {
  Pieza,
  StockSize,
  EbConfig,
  OptimizationResult,
} from '../lib/optimizer/types';
import type { QuotationOptimizerRun } from '../types';

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
  } | null;

  // Pending build (not yet saved as a run)
  pendingPieces: Pieza[];
  pendingStocks: StockSize[];
  pendingEbConfig: EbConfig;
  pendingEbSlotToPriceListId: Record<'a' | 'b' | 'c', string | null>;
  pendingCabinetsCovered: Set<string>;
  pendingCabinetsSkipped: Array<{ id: string; reason: string }>;
  pendingCabinetInstanceCount: number;
  pendingCabinetDetails: Record<string, {
    productSku: string | null;
    quantity: number;
    areaId: string;
    areaName: string;
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

  // Flags
  isBuilding: boolean;
  isOptimizing: boolean;
  isSaving: boolean;
  lastError: string | null;

  // Settings actions
  setGlobalSierra: (v: number) => void;
  setMinOffcut: (v: number) => void;
  setBoardTrim: (v: number) => void;
  setTrimIncludesKerf: (v: boolean) => void;
  toggleStockSelected: (id: string) => void;
  toggleEbSlot: (slot: 'a' | 'b' | 'c') => void;

  // Async actions
  refreshRunsList: () => Promise<void>;
  build: () => Promise<void>;
  runOptimize: () => Promise<void>;
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
    pendingCabinetsCovered: new Set<string>(),
    pendingCabinetsSkipped: [],
    pendingCabinetInstanceCount: 0,
    pendingCabinetDetails: {},
    pendingWarnings: [],
    pendingResult: null,
    pendingBuiltAt: null,

    selectedStockIds: new Set<string>(),
    selectedEbSlots:  new Set<'a' | 'b' | 'c'>(['a', 'b', 'c']),

    globalSierra: 3.2,
    minOffcut: 200,
    boardTrim: 5,
    trimIncludesKerf: false,

    isBuilding: false,
    isOptimizing: false,
    isSaving: false,
    lastError: null,

    setGlobalSierra:     (v) => set({ globalSierra: v }),
    setMinOffcut:        (v) => set({ minOffcut: v }),
    setBoardTrim:        (v) => set({ boardTrim: v }),
    setTrimIncludesKerf: (v) => set({ trimIncludesKerf: v }),

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
      set({ isOptimizing: true, lastError: null });
      // Yield a tick so the UI can show a spinner before the synchronous engine runs.
      await new Promise((r) => setTimeout(r, 50));
      try {
        const effectiveTrim = state.trimIncludesKerf
          ? state.boardTrim + state.globalSierra
          : state.boardTrim;
        // Only include stocks the user has selected (checkbox in sidebar).
        const activeStocks = state.pendingStocks.filter((s) =>
          state.selectedStockIds.has(s.id),
        );
        const result = runOptimization(
          state.pendingPieces,
          activeStocks,
          [], // no remnants in quotation mode for now
          state.globalSierra,
          state.minOffcut,
          effectiveTrim,
        );
        set({ pendingResult: result, isOptimizing: false });
      } catch (err) {
        set({
          isOptimizing: false,
          lastError: err instanceof Error ? err.message : String(err),
        });
        throw err;
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
        const edgeband = computeEdgebandCost(state.pendingPieces, ebPriceBySlot);

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
          warnings:              state.pendingWarnings,
          cabinetsCovered:       Array.from(state.pendingCabinetsCovered),
          cabinetsSkipped:       state.pendingCabinetsSkipped,
          builtAt:               state.pendingBuiltAt ?? new Date().toISOString(),
        };

        // KPIs for the denormalized columns.
        const kpis = deriveKpis(state.pendingResult, edgeband.totalCost);

        // Default: if this is the first run for the quotation, set it active.
        const runs = state.runs;
        const setActive = opts?.setActive ?? runs.length === 0;

        const runId = await createRun({
          quotationId,
          name,
          snapshot,
          result: state.pendingResult,
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
          loadedRun: { snapshot, result },
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
