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
   *  this time, its worker is terminated and the whole run rejects with a
   *  message naming the stuck group. Default: 60_000 ms. Catches
   *  pathological groups that drag down the global 120s budget. */
  perGroupTimeoutMs?: number;
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

/**
 * Partition cleaned pieces by `${material}_${grosor}`, matching the same
 * grouping key used inside `Optimizer.run()`. Order is insertion order, so
 * reruns over the same data produce the same group sequence.
 */
function groupPiecesByMaterial(pieces: Pieza[]): Map<string, Pieza[]> {
  const groups = new Map<string, Pieza[]>();
  for (const p of pieces) {
    const key = `${p.material}_${p.grosor}`;
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

  const groups = groupPiecesByMaterial(cleanPieces);
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

  const perGroupTimeoutMs = params.perGroupTimeoutMs ?? 60_000;

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
      current = groups.get(onlyKey)?.[0]?.material ?? onlyKey;
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
      const matLabel = groupPieces[0]?.material ?? groupKey;

      // Per-group watchdog: if this specific worker exceeds its budget,
      // terminate it and reject with a message naming the group. Fires
      // the internal abort so the other workers also stop (one bad group
      // shouldn't keep the rest running only to produce an invalid total).
      const perGroupTimeout = setTimeout(() => {
        console.warn(`[runOptimizationParallel] ${groupKey} exceeded ${perGroupTimeoutMs}ms budget — terminating worker.`);
        try { worker.terminate(); } catch { /* noop */ }
        const err = new Error(
          `Material "${matLabel}" (${groupPieces.length} piece-types, ${groupPieces.reduce((s, p) => s + p.cantidad, 0)} expanded) took over ${Math.round(perGroupTimeoutMs / 1000)}s and was skipped. Check cut-piece dimensions or veta settings for this material.`,
        );
        reject(err);
        internal.abort(err);
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
          console.log(`[runOptimizationParallel] ${groupKey} done in ${msg.timeMs.toFixed(0)}ms (strategy: ${msg.strategy})`);
          resolve({
            groupKey,
            boards: msg.boards,
            strategy: msg.strategy,
            iters: msg.iters,
            timeMs: msg.timeMs,
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
