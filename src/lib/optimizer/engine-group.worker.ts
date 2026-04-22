/// <reference lib="webworker" />

// ─────────────────────────────────────────────────────────────
// OPTIMIZER ENGINE — PER-GROUP WEB WORKER
//
// Runs `optimizeOneGroup` for a single (material, grosor) group so the
// coordinator (in `parallelOptimization.ts`) can spawn up to N of these
// in parallel and aggregate their results. Each instance is a one-shot
// worker: spawn → post request → receive result/error → terminate.
//
// The caller owns concurrency, cancellation (via `worker.terminate()`),
// and aggregation. This worker only speaks the narrow request/response
// protocol below.
// ─────────────────────────────────────────────────────────────

import { optimizeOneGroup } from './engine';
import type {
  Pieza,
  StockSize,
  Remnant,
  BoardResult,
  EngineMode,
  OptimizationObjective,
} from './types';

export interface OptimizerGroupWorkerRequest {
  type: 'run-group';
  groupKey: string;
  mat: string;
  grs: number;
  pieces: Pieza[];
  stocks: StockSize[];
  remnants: Remnant[];
  globalSierra: number;
  minOffcut: number;
  boardTrim: number;
  engineMode: EngineMode;
  objective: OptimizationObjective;
  rngSeed: number;
}

export type OptimizerGroupWorkerResponse =
  | {
      type: 'result';
      groupKey: string;
      boards: BoardResult[];
      strategy: string;
      iters: number;
      timeMs: number;
      capFires: number;
    }
  | { type: 'error'; groupKey: string; error: string };

self.onmessage = (ev: MessageEvent<OptimizerGroupWorkerRequest>) => {
  const req = ev.data;
  if (!req || req.type !== 'run-group') return;
  try {
    const { boards, strategy, iters, timeMs, capFires } = optimizeOneGroup(
      req.pieces,
      req.mat,
      req.grs,
      req.stocks,
      req.remnants,
      req.globalSierra,
      req.minOffcut,
      req.boardTrim,
      req.engineMode,
      req.objective,
      req.rngSeed,
    );
    const msg: OptimizerGroupWorkerResponse = {
      type: 'result',
      groupKey: req.groupKey,
      boards,
      strategy,
      iters,
      timeMs,
      capFires,
    };
    self.postMessage(msg);
  } catch (err) {
    const msg: OptimizerGroupWorkerResponse = {
      type: 'error',
      groupKey: req.groupKey,
      error: err instanceof Error ? err.message : String(err),
    };
    self.postMessage(msg);
  }
};
