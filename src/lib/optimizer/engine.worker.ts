/// <reference lib="webworker" />

// ─────────────────────────────────────────────────────────────
// OPTIMIZER ENGINE — WEB WORKER WRAPPER
//
// Moves `runOptimization` off the main thread so projects with
// thousands of expanded pieces (e.g. 1030 W 8th Street, 2,306
// pieces) no longer freeze the browser. The wrapper is a thin
// message adapter: inputs in, OptimizationResult or error out.
//
// Why a worker was necessary (vs. the Promise.race hotfix):
//   runOptimization is synchronous. A Promise.race against a
//   setTimeout surfaces a legible error *after* the engine
//   finally returns, but does not unblock the main thread. The
//   user still sees "Page Unresponsive". In a worker, the main
//   thread stays responsive and the store can call
//   worker.terminate() to cancel a run that crosses the budget.
//
// Serialization: Pieza, StockSize, Remnant, and OptimizationResult
// are all plain data (numbers, strings, nested objects with no
// functions or class instances). structured-clone handles them
// natively via postMessage. The CutTreeNode tree can be deep but
// has no circular references.
// ─────────────────────────────────────────────────────────────

import { runOptimization } from './engine';
import type {
  Pieza,
  StockSize,
  Remnant,
  OptimizationResult,
  EngineMode,
  OptimizationObjective,
} from './types';

export interface OptimizerWorkerRequest {
  type: 'run';
  pieces: Pieza[];
  stocks: StockSize[];
  remnants: Remnant[];
  globalSierra: number;
  minOffcut: number;
  boardTrim: number;
  engineMode: EngineMode;
  objective: OptimizationObjective;
}

export type OptimizerWorkerResponse =
  | { type: 'result'; result: OptimizationResult }
  | { type: 'error'; error: string };

self.onmessage = (ev: MessageEvent<OptimizerWorkerRequest>) => {
  const req = ev.data;
  if (!req || req.type !== 'run') return;
  try {
    const result = runOptimization(
      req.pieces,
      req.stocks,
      req.remnants,
      req.globalSierra,
      req.minOffcut,
      req.boardTrim,
      req.engineMode,
      req.objective,
    );
    const msg: OptimizerWorkerResponse = { type: 'result', result };
    self.postMessage(msg);
  } catch (err) {
    const msg: OptimizerWorkerResponse = {
      type: 'error',
      error: err instanceof Error ? err.message : String(err),
    };
    self.postMessage(msg);
  }
};
