// ─────────────────────────────────────────────────────────────
// OPTIMIZER INPUT SANITIZER
//
// Defensive gate in front of `runOptimization`. The engine internals
// assume every piece/stock has finite, positive dimensions and a
// positive integer `cantidad`. If an upstream code path (custom cut
// list overrides, corrupt product metadata, accidental user edits)
// slips a NaN, Infinity, 0, or negative into any of those fields, the
// engine's loops enter pathological states: packers that never
// advance their cursors, grouping keys collapse, and the 8×N GRASP
// iterations effectively multiply the blast radius. Result: the main
// thread freezes and Chrome flags the tab as unresponsive.
//
// This module drops those inputs *before* they reach the engine and
// returns a `dropped[]` list the caller can log. It also caps
// `cantidad` per piece and the total expanded count, so a mis-entered
// quantity can't spawn millions of pieces in engine.ts:597.
// ─────────────────────────────────────────────────────────────

import type { Pieza, StockSize } from './types';

/** Per-piece cap on `cantidad`. A single cabinet type emitting >10,000 copies
 *  of a piece is almost certainly a data-entry error. If legitimate, the user
 *  can split into multiple pieces. */
export const MAX_QTY_PER_PIECE = 10_000;

/** Upper bound on total expanded piece count (Σ cantidad). The engine
 *  allocates one object per expanded piece in `run()`; crossing 50k makes
 *  the main-thread freeze real even on a fast machine. */
export const MAX_TOTAL_EXPANDED = 50_000;

/** Soft budget for `runOptimization` wall-clock time. Only used to log a
 *  warning after the engine returns — it does NOT abort (JS is synchronous).
 *  The hard abort lives in the store's `Promise.race` against a timeout. */
export const MAX_ENGINE_MS = 30_000;

export interface DroppedInput {
  kind: 'piece' | 'stock';
  reason: string;
  /** Minimal identifier so the console log points to the offender without
   *  serializing the full object (which can be huge for stocks). */
  sample: { id?: string; nombre?: string };
}

export interface SanitizedInputs {
  cleanPieces: Pieza[];
  cleanStocks: StockSize[];
  dropped: DroppedInput[];
}

function isFinitePositive(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0;
}

/**
 * Filter invalid pieces and stocks, truncate oversized quantities, and cap
 * the total expanded count. Pure function — no I/O, no mutation of inputs.
 */
export function sanitizeOptimizerInputs(
  pieces: readonly Pieza[],
  stocks: readonly StockSize[],
): SanitizedInputs {
  const dropped: DroppedInput[] = [];

  const cleanStocks: StockSize[] = [];
  for (const s of stocks) {
    if (!isFinitePositive(s.ancho)) {
      dropped.push({ kind: 'stock', reason: `invalid ancho (${String(s.ancho)})`, sample: { id: s.id, nombre: s.nombre } });
      continue;
    }
    if (!isFinitePositive(s.alto)) {
      dropped.push({ kind: 'stock', reason: `invalid alto (${String(s.alto)})`, sample: { id: s.id, nombre: s.nombre } });
      continue;
    }
    cleanStocks.push(s);
  }

  const cleanPieces: Pieza[] = [];
  for (const p of pieces) {
    if (!isFinitePositive(p.ancho)) {
      dropped.push({ kind: 'piece', reason: `invalid ancho (${String(p.ancho)})`, sample: { id: p.id, nombre: p.nombre } });
      continue;
    }
    if (!isFinitePositive(p.alto)) {
      dropped.push({ kind: 'piece', reason: `invalid alto (${String(p.alto)})`, sample: { id: p.id, nombre: p.nombre } });
      continue;
    }
    if (!isFinitePositive(p.grosor)) {
      dropped.push({ kind: 'piece', reason: `invalid grosor (${String(p.grosor)})`, sample: { id: p.id, nombre: p.nombre } });
      continue;
    }
    if (!isFinitePositive(p.cantidad)) {
      dropped.push({ kind: 'piece', reason: `invalid cantidad (${String(p.cantidad)})`, sample: { id: p.id, nombre: p.nombre } });
      continue;
    }

    if (p.cantidad > MAX_QTY_PER_PIECE) {
      dropped.push({
        kind: 'piece',
        reason: `cantidad ${p.cantidad} truncated to ${MAX_QTY_PER_PIECE}`,
        sample: { id: p.id, nombre: p.nombre },
      });
      cleanPieces.push({ ...p, cantidad: MAX_QTY_PER_PIECE });
    } else {
      cleanPieces.push(p);
    }
  }

  // Global cap on expanded pieces: the engine expands by cantidad into a
  // single flat array before grouping. Above 50k we're past the point of
  // reasonable main-thread performance. Drop the pieces with the largest
  // cantidad first so we shed the most load with the fewest drops.
  let total = cleanPieces.reduce((s, p) => s + p.cantidad, 0);
  if (total > MAX_TOTAL_EXPANDED) {
    const sortedByQtyDesc = [...cleanPieces].sort((a, b) => b.cantidad - a.cantidad);
    const keep = new Set(cleanPieces);
    for (const p of sortedByQtyDesc) {
      if (total <= MAX_TOTAL_EXPANDED) break;
      keep.delete(p);
      total -= p.cantidad;
      dropped.push({
        kind: 'piece',
        reason: `dropped to stay under total expanded cap (${MAX_TOTAL_EXPANDED})`,
        sample: { id: p.id, nombre: p.nombre },
      });
    }
    return {
      cleanPieces: cleanPieces.filter((p) => keep.has(p)),
      cleanStocks,
      dropped,
    };
  }

  return { cleanPieces, cleanStocks, dropped };
}
