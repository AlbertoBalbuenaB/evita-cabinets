// ─────────────────────────────────────────────────────────────
// PARALLEL OPTIMIZATION COORDINATOR
//
// Orchestrates a pool of per-group Web Workers (one per
// material_grosor group) so the engine's GRASP multi-start runs
// concurrently across CPU cores. Caller is the Zustand store for
// the Breakdown tab (see `createQuotationOptimizerStore.ts`).
//
// Scope today: only the quotation-pricing path. The standalone
// `/optimizer` page keeps calling `runOptimization` directly on the
// main thread — it's exercised with small inputs pasted by hand
// and hasn't shown the freeze in practice. Migrate it when needed.
// ─────────────────────────────────────────────────────────────

import GroupWorker from './engine-group.worker?worker';
import type {
  OptimizerGroupWorkerRequest,
  OptimizerGroupWorkerResponse,
} from './engine-group.worker';
import { sanitizeOptimizerInputs } from './sanitizeOptimizerInputs';
import { mergeOptimizationResults, type GroupResultPart } from './mergeOptimizationResults';
import type {
  Pieza,
  StockSize,
  Remnant,
  OptimizationResult,
  EngineMode,
  OptimizationObjective,
} from './types';

export interface ParallelOptimizationParams {
  pieces: Pieza[];
  stocks: StockSize[];
  remnants: Remnant[];
  globalSierra: number;
  minOffcut: number;
  boardTrim: number;
  engineMode: EngineMode;
  objective: OptimizationObjective;
  /** Aborts the whole pool. Active workers are terminated and the pending
   *  promise rejects with a DOMException('AbortError'). */
  signal?: AbortSignal;
  /** Called on the main thread whenever a group finishes. `current` is the
   *  human-readable material label of the NEXT group entering the queue, or
   *  null when the last group has completed. Use for the progress UI. */
  onProgress?: (progress: { completed: number; total: number; current: string | null }) => void;
  /** Upper bound on wall-clock time (ms). On timeout, all active workers
   *  are terminated and the promise rejects. Default: 120_000 ms. */
  timeoutMs?: number;
  /** Per-group wall-clock cap (ms). If a single group doesn't complete in
   *  this time, its worker is terminated and the group is marked `skipped`
   *  in the final result — the pool continues with the remaining groups.
   *  Skipped materials surface in `OptimizationResult.skippedGroups` and
   *  their pieces land in `unplacedPieces`. Default: 90_000 ms. One
   *  pathological material no longer kills the whole run. */
  perGroupTimeoutMs?: number;
  /** Custom grouping key function. Pieces sharing the same key go to the
   *  same worker. Default: `${material}_${grosor}` (pool all areas).
   *  Pass a key that includes `areaId` to optimize per-area — each area's
   *  subset of a material packs independently, which dramatically reduces
   *  combinatorial pressure when a single material spans many areas. */
  groupKeyFn?: (p: Pieza) => string;
  /** Human-readable label function for progress UI and skipped-group
   *  warnings. Default: `p => p.material`. Pass e.g.
   *  `p => \`${p.material} / ${p.area}\`` when per-area so the UI can say
   *  "Wilsonart 18mm / Kitchen" instead of just "Wilsonart 18mm". */
  groupLabelFn?: (p: Pieza) => string;
}

/** FNV-1a 32-bit hash, mapped into the Lehmer RNG's valid range [1, 2^31-2]. */
function seedForGroup(groupKey: string): number {
  let h = 2166136261;
  for (let i = 0; i < groupKey.length; i++) {
    h ^= groupKey.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return (h % 2147483646) + 1;
}

/** Default grouping key: material + thickness, pooling pieces across all
 *  areas. Matches the key used inside `Optimizer.run()`. */
export const poolGroupKey = (p: Pieza): string => `${p.material}_${p.grosor}`;

/** Per-area grouping key: material + thickness + areaId. Pieces from
 *  different areas of the same material pack independently, which
 *  avoids combinatorial explosion when one material spans many areas.
 *  Pieces without an areaId (e.g. legacy standalone-page inputs) fall
 *  into a shared `__no_area__` bucket so they still get optimized. */
export const perAreaGroupKey = (p: Pieza): string =>
  `${p.material}_${p.grosor}_${p.areaId ?? '__no_area__'}`;

/**
 * Piece-type count at which a pooled group is considered "pathological"
 * and worth splitting per-area. Materials at or above this count get
 * per-area splitting in `'auto'` mode; smaller materials stay pooled
 * for best utilization.
 *
 * Tuning history:
 *   - v1 (15): too aggressive; flagged common materials with 15-24
 *     piece-types → cost drifted toward full Split mode.
 *   - v2 (25): still flagged common materials at 25-39 types → cost
 *     stayed noticeably above Pool baseline.
 *   - v3 (40): achieved cost parity with Pool on W 8th, but Wilsonart
 *     28-type material — the ORIGINAL pathology that motivated this
 *     feature — fell BELOW the threshold and was no longer auto-split.
 *     It hit the 90s per-group timeout and got skipped, blocking Save.
 *   - v4 (28, current): recalibrated to the exact Wilsonart case (28
 *     piece-types, 124 expanded, timed out at 90s pooled). Catches
 *     that + all larger materials. The project has a count gap: 28,
 *     32, 34, 40, 43, 43, 43, 72 — no threshold between 28 and 32
 *     exists that catches Wilsonart without also catching Absolut
 *     White (32/34). Accepting that tradeoff because:
 *       (a) Save must work — skipped groups block the workflow; and
 *       (b) 1-2 extra last-partial-board penalties are small relative
 *           to the cost of a Save-blocked run.
 *
 * Tuning guide:
 *   - Lower = more aggressive splitting → cost drifts toward Split mode.
 *   - Higher = more conservative → cost closer to Pool, but borderline
 *     materials (~30 types) may hit the per-group timeout and get
 *     skipped (Save blocked). 28 is the floor for the W 8th project;
 *     raising above 28 re-introduces the Wilsonart skip.
 */
export const PATHOLOGICAL_PIECE_TYPE_THRESHOLD = 28;

/**
 * Build the grouping + label functions for `'auto'` mode.
 *
 * Scans the incoming pieces once, counts piece-types per `material_grosor`,
 * and flags any material at or above {@link PATHOLOGICAL_PIECE_TYPE_THRESHOLD}
 * as `pathological`. The returned `groupKeyFn`:
 *   - uses `perAreaGroupKey` for pathological materials (one worker per area)
 *   - uses `poolGroupKey` for everything else (shared boards, best util)
 *
 * When no material is pathological, the returned fns are behaviourally
 * identical to the pooled defaults, so `'auto'` mode is a strict superset
 * of `'pooled'` — it only diverges when there is an actual problem to
 * solve. The `pathological` set is returned alongside for logging and UI
 * introspection.
 */
export function buildAutoGroupFns(pieces: Pieza[]): {
  groupKeyFn: (p: Pieza) => string;
  groupLabelFn: (p: Pieza) => string;
  pathological: Set<string>;
  /** Piece-type count per `material_grosor` key, exposed so the caller
   *  can emit diagnostic logs ("Wilsonart_18 (28 types)") and spot
   *  near-threshold materials for tuning without re-walking pieces. */
  pieceCounts: Map<string, number>;
} {
  const typeCounts = new Map<string, number>();
  for (const p of pieces) {
    const k = poolGroupKey(p);
    typeCounts.set(k, (typeCounts.get(k) ?? 0) + 1);
  }
  const pathological = new Set<string>();
  for (const [k, n] of typeCounts) {
    if (n >= PATHOLOGICAL_PIECE_TYPE_THRESHOLD) pathological.add(k);
  }
  return {
    groupKeyFn: (p) => {
      const k = poolGroupKey(p);
      return pathological.has(k) ? perAreaGroupKey(p) : k;
    },
    groupLabelFn: (p) => {
      const k = poolGroupKey(p);
      return pathological.has(k)
        ? `${p.material} / ${p.area ?? 'Sin área'}`
        : p.material;
    },
    pathological,
    pieceCounts: typeCounts,
  };
}

/**
 * Partition cleaned pieces into groups keyed by `keyFn(piece)`. Order is
 * insertion order, so reruns over the same data produce the same group
 * sequence (seeding stays deterministic). Exported for unit testing —
 * production callers use `runOptimizationParallel` which invokes this
 * internally.
 */
export function groupPiecesBy(
  pieces: Pieza[],
  keyFn: (p: Pieza) => string,
): Map<string, Pieza[]> {
  const groups = new Map<string, Pieza[]>();
  for (const p of pieces) {
    const key = keyFn(p);
    const arr = groups.get(key);
    if (arr) arr.push(p);
    else groups.set(key, [p]);
  }
  return groups;
}

/** Concurrency limiter that preserves result order. Spawns up to `limit`
 *  workers, each consuming the shared cursor until the queue drains. */
async function runWithLimit<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let cursor = 0;
  const worker = async (): Promise<void> => {
    while (cursor < tasks.length) {
      const i = cursor++;
      results[i] = await tasks[i]();
    }
  };
  const workerCount = Math.min(Math.max(1, limit), tasks.length);
  await Promise.all(Array.from({ length: workerCount }, worker));
  return results;
}

/**
 * Run optimization as a pool of one-shot per-group workers. Same semantics
 * as the legacy `runOptimization` except:
 *   - Each group has its own RNG seed (derived from its key), so output may
 *     drift by ±1-2 boards per group vs. the serial single-seed engine.
 *   - Strategy string is joined across groups (`"<key>:<strategy> | ..."`).
 *   - Supports AbortSignal-based cancellation and onProgress callback.
 *   - A group that busts its per-group budget is SKIPPED (not fatal): its
 *     worker is terminated and the pool keeps running with the remaining
 *     groups. Skipped materials surface in `result.skippedGroups` and their
 *     pieces in `result.unplacedPieces`. The caller MUST treat `totalCost`
 *     as partial when `skippedGroups.length > 0` — block Save, show a
 *     warning, or re-run once the material's data is fixed.
 */
export async function runOptimizationParallel(
  params: ParallelOptimizationParams,
): Promise<OptimizationResult> {
  const { cleanPieces, cleanStocks, dropped } = sanitizeOptimizerInputs(params.pieces, params.stocks);

  if (dropped.length > 0) {
    console.warn('[runOptimizationParallel] dropped invalid inputs:', dropped);
  }

  if (cleanPieces.length === 0) {
    throw new Error(
      'No valid pieces to optimize. Check cabinet cut-pieces for missing dimensions or quantities.',
    );
  }
  if (cleanStocks.length === 0) {
    throw new Error(
      'No valid stocks selected. Make sure at least one board material is checked in the sidebar.',
    );
  }

  const groupKeyFn = params.groupKeyFn ?? poolGroupKey;
  const groupLabelFn = params.groupLabelFn ?? ((p: Pieza) => p.material);
  const groups = groupPiecesBy(cleanPieces, groupKeyFn);
  const groupKeys = Array.from(groups.keys());
  const totalGroups = groupKeys.length;
  const hwConcurrency = typeof navigator !== 'undefined' && navigator.hardwareConcurrency
    ? navigator.hardwareConcurrency
    : 4;
  const concurrency = Math.min(Math.max(1, hwConcurrency - 1), totalGroups, 8);

  console.log('[runOptimizationParallel] coordinator starting', {
    piecesIn: params.pieces.length,
    piecesClean: cleanPieces.length,
    totalExpanded: cleanPieces.reduce((s, p) => s + p.cantidad, 0),
    groups: totalGroups,
    concurrency,
    engineMode: params.engineMode,
    objective: params.objective,
  });

  // One internal AbortController rules both caller-cancel and timeout. Every
  // per-group task listens to `internal.signal` so an abort actually reaches
  // the worker (terminate + reject), instead of just killing workers and
  // leaving the task promises pending forever.
  const internal = new AbortController();
  const timeoutMs = params.timeoutMs ?? 120_000;
  let completed = 0;
  let timedOut = false;

  const onCallerAbort = (): void => {
    internal.abort(new DOMException('Optimizer run cancelled.', 'AbortError'));
  };
  if (params.signal) {
    if (params.signal.aborted) {
      throw new DOMException('Optimizer run was aborted before it started.', 'AbortError');
    }
    params.signal.addEventListener('abort', onCallerAbort, { once: true });
  }

  const timeoutHandle = setTimeout(() => {
    timedOut = true;
    internal.abort(new Error(
      `Optimizer took too long (>${Math.round(timeoutMs / 1000)}s) and was cancelled. Consider reducing stocks or splitting the quotation.`,
    ));
  }, timeoutMs);

  const perGroupTimeoutMs = params.perGroupTimeoutMs ?? 90_000;

  // Set of group keys whose worker is currently running. Used to give the
  // progress UI the *actual* material that's in progress instead of just
  // the `completed`-th key by insertion order (which is misleading under
  // parallel scheduling — tasks complete out of order).
  const runningKeys = new Set<string>();

  const emitProgress = (): void => {
    let current: string | null;
    if (runningKeys.size === 0) {
      current = null;
    } else if (runningKeys.size === 1) {
      const onlyKey = runningKeys.values().next().value as string;
      const firstPiece = groups.get(onlyKey)?.[0];
      current = firstPiece ? groupLabelFn(firstPiece) : onlyKey;
    } else {
      current = `${runningKeys.size} materials in parallel`;
    }
    try {
      params.onProgress?.({ completed, total: totalGroups, current });
    } catch (err) {
      // Never let a caller's onProgress handler deadlock the pool.
      console.warn('[runOptimizationParallel] onProgress callback threw:', err);
    }
  };

  const runOneGroup = (groupKey: string, groupPieces: Pieza[]): Promise<GroupResultPart> => {
    return new Promise<GroupResultPart>((resolve, reject) => {
      if (internal.signal.aborted) {
        reject(internal.signal.reason ?? new DOMException('Run aborted.', 'AbortError'));
        return;
      }
      const worker = new GroupWorker();
      const firstPiece = groupPieces[0];
      const matLabel = firstPiece ? groupLabelFn(firstPiece) : groupKey;
      const areaId = firstPiece?.areaId;
      const areaName = firstPiece?.area;

      // Per-group watchdog: if this specific worker exceeds its budget,
      // terminate it and mark the group as skipped. The pool keeps running
      // on the remaining groups — a single pathological material no longer
      // invalidates everything. The UI must show a warning and block Save
      // when `result.skippedGroups.length > 0` (its totalCost is partial).
      const perGroupTimeout = setTimeout(() => {
        console.warn(`[runOptimizationParallel] ${groupKey} exceeded ${perGroupTimeoutMs}ms budget — terminating worker and marking group as skipped.`);
        // Detach handlers BEFORE terminate to avoid a late message from the
        // worker racing with the resolve below and double-counting progress.
        worker.onmessage = null;
        worker.onerror = null;
        try { worker.terminate(); } catch { /* noop */ }
        runningKeys.delete(groupKey);
        internal.signal.removeEventListener('abort', onInternalAbort);
        completed += 1;
        emitProgress();
        const reason = `Took over ${Math.round(perGroupTimeoutMs / 1000)}s — ${groupPieces.length} piece-types, ${groupPieces.reduce((s, p) => s + p.cantidad, 0)} expanded. Check cut-piece dimensions, veta settings, or stock size for this material.`;
        resolve({
          groupKey,
          boards: [],
          strategy: '(skipped: timeout)',
          iters: 0,
          timeMs: perGroupTimeoutMs,
          capFires: 0,
          skipped: {
            materialLabel: matLabel,
            reason,
            ...(areaId !== undefined && { areaId }),
            ...(areaName !== undefined && { areaName }),
          },
        });
      }, perGroupTimeoutMs);

      const onInternalAbort = (): void => {
        clearTimeout(perGroupTimeout);
        runningKeys.delete(groupKey);
        try { worker.terminate(); } catch { /* noop */ }
        reject(internal.signal.reason ?? new DOMException('Run aborted.', 'AbortError'));
      };
      internal.signal.addEventListener('abort', onInternalAbort, { once: true });

      const cleanup = (): void => {
        clearTimeout(perGroupTimeout);
        runningKeys.delete(groupKey);
        try { worker.terminate(); } catch { /* noop */ }
        internal.signal.removeEventListener('abort', onInternalAbort);
      };

      worker.onmessage = (ev: MessageEvent<OptimizerGroupWorkerResponse>) => {
        const msg = ev.data;
        cleanup();
        if (msg.type === 'result') {
          completed += 1;
          emitProgress();
          console.log(
            `[runOptimizationParallel] ${groupKey} done in ${msg.timeMs.toFixed(0)}ms ` +
            `(strategy: ${msg.strategy}${msg.capFires > 0 ? `, capFires: ${msg.capFires}` : ''})`
          );
          resolve({
            groupKey,
            boards: msg.boards,
            strategy: msg.strategy,
            iters: msg.iters,
            timeMs: msg.timeMs,
            capFires: msg.capFires,
          });
        } else if (msg.type === 'error') {
          reject(new Error(`Group ${groupKey}: ${msg.error}`));
        } else {
          reject(new Error(`Group ${groupKey}: unexpected worker response`));
        }
      };

      worker.onerror = (err) => {
        cleanup();
        reject(new Error(`Group ${groupKey} worker crashed: ${err.message || 'unknown'}`));
      };

      const req: OptimizerGroupWorkerRequest = {
        type: 'run-group',
        groupKey,
        mat: groupPieces[0].material,
        grs: groupPieces[0].grosor,
        pieces: groupPieces,
        stocks: cleanStocks,
        remnants: params.remnants,
        globalSierra: params.globalSierra,
        minOffcut: params.minOffcut,
        boardTrim: params.boardTrim,
        engineMode: params.engineMode,
        objective: params.objective,
        rngSeed: seedForGroup(groupKey),
      };
      const expanded = groupPieces.reduce((s, p) => s + p.cantidad, 0);
      console.log(`[runOptimizationParallel] ${groupKey} starting: ${groupPieces.length} piece-types, ${expanded} expanded`);
      runningKeys.add(groupKey);
      emitProgress();
      worker.postMessage(req);
    });
  };

  try {
    // Initial progress frame so the UI renders the bar before any worker
    // has spawned. `runningKeys` is empty here — emitProgress() will emit
    // current=null and the band's fallback text takes over.
    emitProgress();

    const tasks = groupKeys.map((k) => () => runOneGroup(k, groups.get(k) as Pieza[]));
    const parts = await runWithLimit(tasks, concurrency);
    return mergeOptimizationResults(parts, cleanPieces, groups);
  } catch (err) {
    // Timeout / cancel surface here. Workers have already been terminated
    // by the per-task abort listeners; nothing else to clean up.
    if (timedOut && err instanceof DOMException && err.name === 'AbortError') {
      // Prefer the timeout message over the generic AbortError when both apply.
      throw internal.signal.reason ?? err;
    }
    throw err;
  } finally {
    clearTimeout(timeoutHandle);
    if (params.signal) params.signal.removeEventListener('abort', onCallerAbort);
  }
}
