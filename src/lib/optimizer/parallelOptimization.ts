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

  // Track everything that needs cleanup on cancel / timeout.
  const activeWorkers = new Set<Worker>();
  let completed = 0;
  let aborted = false;

  const abortAll = (): void => {
    aborted = true;
    for (const w of activeWorkers) {
      try { w.terminate(); } catch { /* already gone */ }
    }
    activeWorkers.clear();
  };

  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      abortAll();
      reject(new Error(
        `Optimizer took too long (>${Math.round((params.timeoutMs ?? 120_000) / 1000)}s) and was cancelled. Consider reducing stocks or splitting the quotation.`,
      ));
    }, params.timeoutMs ?? 120_000);
  });

  const onAbort = (): void => {
    abortAll();
  };
  if (params.signal) {
    if (params.signal.aborted) {
      throw new DOMException('Optimizer run was aborted before it started.', 'AbortError');
    }
    params.signal.addEventListener('abort', onAbort, { once: true });
  }

  const runOneGroup = (groupKey: string, groupPieces: Pieza[]): Promise<GroupResultPart> => {
    return new Promise<GroupResultPart>((resolve, reject) => {
      if (aborted) {
        reject(new DOMException('Run aborted.', 'AbortError'));
        return;
      }
      const worker = new GroupWorker();
      activeWorkers.add(worker);

      const cleanup = (): void => {
        activeWorkers.delete(worker);
        try { worker.terminate(); } catch { /* noop */ }
      };

      worker.onmessage = (ev: MessageEvent<OptimizerGroupWorkerResponse>) => {
        const msg = ev.data;
        cleanup();
        if (msg.type === 'result') {
          completed += 1;
          // `current` is the label of the next group the user will see in
          // the progress bar — or null when we're done.
          const next = groupKeys[completed] ?? null;
          const nextLabel = next ? (groups.get(next)?.[0]?.material ?? next) : null;
          params.onProgress?.({ completed, total: totalGroups, current: nextLabel });
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
      worker.postMessage(req);
    });
  };

  try {
    // Emit an initial progress event so the UI can render the bar
    // immediately with "0 of N" + the first material label.
    const firstLabel = groupKeys.length > 0
      ? (groups.get(groupKeys[0])?.[0]?.material ?? groupKeys[0])
      : null;
    params.onProgress?.({ completed: 0, total: totalGroups, current: firstLabel });

    const tasks = groupKeys.map((k) => () => runOneGroup(k, groups.get(k) as Pieza[]));
    const parts = await Promise.race([
      runWithLimit(tasks, concurrency),
      timeoutPromise,
    ]);

    return mergeOptimizationResults(parts, cleanPieces, groups);
  } catch (err) {
    abortAll();
    throw err;
  } finally {
    if (timeoutHandle != null) clearTimeout(timeoutHandle);
    if (params.signal) params.signal.removeEventListener('abort', onAbort);
    activeWorkers.clear();
  }
}
