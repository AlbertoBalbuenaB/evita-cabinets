// ─────────────────────────────────────────────────────────────
// OPTIMIZATION RESULT AGGREGATOR
//
// Combines the per-group outputs of `optimizeOneGroup` into a single
// `OptimizationResult` shaped identically to what the serial
// `runOptimization` returns. Owned by the parallel pool orchestrator.
//
// Merge semantics:
//   - boards[]        → concat (each group's boards retained in order)
//   - totalPieces     → sum of cantidad across all input pieces
//   - efficiency      → weighted avg by areaTotal (not simple mean)
//   - totalCost       → sum of boards[*].stockInfo.costo
//   - timeMs          → MAX across groups (parallel wall-clock; workers
//                       overlap, so taking the slowest is closer to reality
//                       than summing)
//   - strategy        → joined with ' | ' so the UI can show each group's
//                       best heuristic
//   - usefulOffcuts   → sum
//   - unplacedPieces  → computed from scratch by comparing each input
//                       piece's expected cantidad to actual placed count
//                       across all boards
// ─────────────────────────────────────────────────────────────

import type { BoardResult, OptimizationResult, Pieza } from './types';

export interface GroupResultPart {
  groupKey: string;
  boards: BoardResult[];
  strategy: string;
  iters: number;
  timeMs: number;
}

/**
 * Aggregate parallel per-group results into a single OptimizationResult.
 *
 * `allInputPieces` must be the pre-sanitized pieces the caller passed to the
 * pool (unexpanded, with `cantidad`). The order must match the order used
 * to assign `_idx` inside each group's Optimizer — since `optimizeOneGroup`
 * preserves the original piece references and each group's Optimizer is
 * seeded the same way, `placed.idx` is a valid index into the group's
 * subset, not the full array. To compute unplaced pieces we therefore
 * reconstruct expected counts per-group as well.
 */
export function mergeOptimizationResults(
  parts: GroupResultPart[],
  allInputPieces: Pieza[],
  groupedPieces: Map<string, Pieza[]>,
): OptimizationResult {
  const allBoards: BoardResult[] = parts.flatMap((p) => p.boards);

  const totalArea = allBoards.reduce((s, b) => s + b.areaTotal, 0);
  const usedArea = allBoards.reduce((s, b) => s + b.areaUsed, 0);
  const totalPieces = allInputPieces.reduce((s, p) => s + p.cantidad, 0);
  const totalCost = allBoards.reduce((s, b) => s + b.stockInfo.costo, 0);
  const usefulOffcuts = allBoards.reduce((s, b) => s + b.offcuts.length, 0);
  const timeMs = parts.length === 0 ? 0 : Math.max(...parts.map((p) => p.timeMs));

  const strategy = parts
    .filter((p) => p.strategy)
    .map((p) => `${p.groupKey}:${p.strategy}`)
    .join(' | ');

  // Unplaced pieces: per-group comparison. Each worker assigns `_idx` 0..N-1
  // over ITS OWN subset of pieces. We mirror that assignment here so the
  // counts line up, then aggregate missing counts back to the original piece
  // identity.
  const unplaced: { nombre: string; ancho: number; alto: number; count: number }[] = [];

  for (const part of parts) {
    const groupInputs = groupedPieces.get(part.groupKey) ?? [];
    const placedCounts = new Map<number, number>();
    for (const b of part.boards) {
      for (const pp of b.placed) {
        placedCounts.set(pp.idx, (placedCounts.get(pp.idx) || 0) + 1);
      }
    }
    groupInputs.forEach((p, idx) => {
      const placed = placedCounts.get(idx) || 0;
      const missing = p.cantidad - placed;
      if (missing > 0) {
        unplaced.push({
          nombre: p.nombre || `${p.ancho}×${p.alto}`,
          ancho: p.ancho,
          alto: p.alto,
          count: missing,
        });
      }
    });
  }

  return {
    boards: allBoards,
    totalPieces,
    efficiency: totalArea > 0 ? (usedArea / totalArea) * 100 : 0,
    totalCost,
    timeMs,
    strategy,
    usefulOffcuts,
    unplacedPieces: unplaced,
  };
}
