import { describe, it, expect } from 'vitest';
import { runOptimization } from './engine';
import type { Pieza, StockSize, OptimizationResult, CutTreeNode } from './types';

/**
 * Baseline snapshot gate for the guillotine packing engine.
 *
 * Captures `runOptimization` output for 5 synthetic fixtures that exercise
 * the algorithmic paths we must preserve across the type-counting refactor:
 *
 *   1. Small kitchen (single-board)     — simple happy path.
 *   2. Medium kitchen (2 materials)     — multi-group dispatch + per-group best.
 *   3. Grain mix (veta constraints)     — rotation pruning with mixed grain.
 *   4. Landscape-transpose              — _buildShelfGuillotine swapVeta path.
 *   5. Deep recursion                   — guillotinePack sub-column nesting.
 *
 * The committed .snap is the baseline recorded on main BEFORE the refactor.
 * Post-refactor, these must produce identical output (zero diff). If the
 * algorithm is intentionally changed, `vitest -u` regenerates them and the
 * diff is reviewed manually.
 */

function makePiece(overrides: Partial<Pieza> = {}): Pieza {
  return {
    id: overrides.id ?? 'p',
    nombre: overrides.nombre ?? 'piece',
    material: overrides.material ?? 'MDF',
    grosor: overrides.grosor ?? 15,
    ancho: 1000,
    alto: 500,
    cantidad: 1,
    veta: 'none',
    cubrecanto: { sup: 0, inf: 0, izq: 0, der: 0 },
    ...overrides,
  } as Pieza;
}

function makeStock(overrides: Partial<StockSize> = {}): StockSize {
  return {
    id: overrides.id ?? 's',
    nombre: overrides.nombre ?? 'MDF',
    ancho: 2440,
    alto: 1220,
    costo: 100,
    sierra: 4.5,
    ...overrides,
  };
}

/**
 * Normalize a result for stable snapshot comparison.
 * - Drops `timeMs` (wall-clock, non-deterministic).
 * - Rounds floating-point fields to 2 decimals.
 * - Replaces PlacedPiece refs in cutTree leaves with a minimal {idx,w,h}
 *   projection to avoid circular refs while preserving structural identity.
 */
function normalizeResult(result: OptimizationResult) {
  return {
    boards: result.boards.map((b) => ({
      ancho: b.ancho,
      alto: b.alto,
      sierra: b.sierra,
      material: b.material,
      grosor: b.grosor,
      stockInfo: b.stockInfo,
      trim: b.trim,
      areaTotal: Math.round(b.areaTotal * 100) / 100,
      areaUsed: Math.round(b.areaUsed * 100) / 100,
      areaWaste: Math.round(b.areaWaste * 100) / 100,
      usage: Math.round(b.usage * 100) / 100,
      placed: b.placed.map((pp) => ({
        idx: pp.idx,
        x: pp.x,
        y: pp.y,
        w: pp.w,
        h: pp.h,
        rotated: pp.rotated,
        pieceNombre: pp.piece.nombre,
        pieceVeta: pp.piece.veta,
      })),
      offcuts: b.offcuts,
      cutTree: normalizeCutTree(b.cutTree),
    })),
    totalPieces: result.totalPieces,
    efficiency: Math.round(result.efficiency * 100) / 100,
    totalCost: result.totalCost,
    strategy: result.strategy,
    usefulOffcuts: result.usefulOffcuts,
    unplacedPieces: result.unplacedPieces,
  };
}

function normalizeCutTree(node: CutTreeNode | undefined | null): object | null {
  if (!node) return null;
  return {
    x: node.x,
    y: node.y,
    w: node.w,
    h: node.h,
    piece: node.piece
      ? { idx: node.piece.idx, w: node.piece.w, h: node.piece.h, rotated: node.piece.rotated }
      : null,
    cut: node.cut,
    left: normalizeCutTree(node.left),
    right: normalizeCutTree(node.right),
  };
}

describe('runOptimization — pre-refactor snapshot baseline', () => {
  it('Fixture 1: small kitchen (single board, 1 material)', () => {
    const pieces: Pieza[] = [
      makePiece({ id: 'f1-a', nombre: 'side-L',  ancho: 600, alto: 700, cantidad: 4 }),
      makePiece({ id: 'f1-b', nombre: 'side-R',  ancho: 400, alto: 400, cantidad: 6 }),
      makePiece({ id: 'f1-c', nombre: 'shelf',   ancho: 580, alto: 300, cantidad: 4 }),
      makePiece({ id: 'f1-d', nombre: 'bottom',  ancho: 800, alto: 500, cantidad: 2 }),
      makePiece({ id: 'f1-e', nombre: 'back',    ancho: 780, alto: 680, cantidad: 2 }),
    ];
    const stocks = [makeStock({ id: 'f1-stock' })];
    const result = runOptimization(pieces, stocks, [], 4.5, 200, 0, 'guillotine', 'min-boards');

    expect(result.unplacedPieces).toEqual([]);
    expect(normalizeResult(result)).toMatchSnapshot();
  });

  it('Fixture 2: medium kitchen (2 materials, multi-group)', () => {
    const pieces: Pieza[] = [
      makePiece({ id: 'f2-mdf-a', material: 'MDF',     grosor: 15, nombre: 'mdf-side',  ancho: 600,  alto: 720, cantidad: 8 }),
      makePiece({ id: 'f2-mdf-b', material: 'MDF',     grosor: 15, nombre: 'mdf-shelf', ancho: 580,  alto: 300, cantidad: 12 }),
      makePiece({ id: 'f2-mdf-c', material: 'MDF',     grosor: 15, nombre: 'mdf-back',  ancho: 780,  alto: 680, cantidad: 6 }),
      makePiece({ id: 'f2-ply-a', material: 'Plywood', grosor: 18, nombre: 'ply-panel', ancho: 900,  alto: 450, cantidad: 6 }),
      makePiece({ id: 'f2-ply-b', material: 'Plywood', grosor: 18, nombre: 'ply-door',  ancho: 400,  alto: 700, cantidad: 10 }),
    ];
    const stocks = [
      makeStock({ id: 'f2-mdf', nombre: 'MDF',     costo: 120 }),
      makeStock({ id: 'f2-ply', nombre: 'Plywood', costo: 180 }),
    ];
    const result = runOptimization(pieces, stocks, [], 4.5, 200, 0, 'guillotine', 'min-boards');

    expect(result.unplacedPieces).toEqual([]);
    expect(normalizeResult(result)).toMatchSnapshot();
  });

  it('Fixture 3: grain mix (veta constraints)', () => {
    const pieces: Pieza[] = [
      makePiece({ id: 'f3-a', nombre: 'grain-h',    veta: 'horizontal', ancho: 800,  alto: 400,  cantidad: 6 }),
      makePiece({ id: 'f3-b', nombre: 'grain-v',    veta: 'vertical',   ancho: 300,  alto: 900,  cantidad: 8 }),
      makePiece({ id: 'f3-c', nombre: 'grain-free', veta: 'none',       ancho: 500,  alto: 500,  cantidad: 10 }),
      makePiece({ id: 'f3-d', nombre: 'grain-hh',   veta: 'horizontal', ancho: 1200, alto: 250,  cantidad: 4 }),
      makePiece({ id: 'f3-e', nombre: 'grain-vv',   veta: 'vertical',   ancho: 250,  alto: 1100, cantidad: 2 }),
    ];
    const stocks = [makeStock({ id: 'f3-stock' })];
    const result = runOptimization(pieces, stocks, [], 4.5, 200, 0, 'guillotine', 'min-boards');

    expect(result.unplacedPieces).toEqual([]);
    expect(normalizeResult(result)).toMatchSnapshot();
  });

  it('Fixture 4: landscape-transpose (stresses swapVeta path)', () => {
    const pieces: Pieza[] = [
      makePiece({ id: 'f4-a', nombre: 'tall-v', veta: 'vertical',   ancho: 300,  alto: 1000, cantidad: 4 }),
      makePiece({ id: 'f4-b', nombre: 'wide-h', veta: 'horizontal', ancho: 1000, alto: 300,  cantidad: 4 }),
      makePiece({ id: 'f4-c', nombre: 'square', veta: 'none',       ancho: 500,  alto: 500,  cantidad: 8 }),
      makePiece({ id: 'f4-d', nombre: 'long-v', veta: 'vertical',   ancho: 200,  alto: 1100, cantidad: 2 }),
      makePiece({ id: 'f4-e', nombre: 'mid',    veta: 'horizontal', ancho: 700,  alto: 400,  cantidad: 4 }),
    ];
    const stocks = [makeStock({ id: 'f4-stock' })];
    const result = runOptimization(pieces, stocks, [], 4.5, 200, 0, 'guillotine', 'min-boards');

    expect(result.unplacedPieces).toEqual([]);
    expect(normalizeResult(result)).toMatchSnapshot();
  });

  it('Fixture 5: deep recursion (sub-column guillotinePack path)', () => {
    const pieces: Pieza[] = [
      makePiece({ id: 'f5-col',  nombre: 'col',  ancho: 200, alto: 600, cantidad: 8 }),
      makePiece({ id: 'f5-a',    nombre: 'tiny', ancho: 180, alto: 100, cantidad: 30 }),
      makePiece({ id: 'f5-b',    nombre: 'mid',  ancho: 180, alto: 150, cantidad: 20 }),
      makePiece({ id: 'f5-c',    nombre: 'thin', ancho: 90,  alto: 80,  cantidad: 40 }),
    ];
    const stocks = [makeStock({ id: 'f5-stock' })];
    const result = runOptimization(pieces, stocks, [], 4.5, 200, 0, 'guillotine', 'min-boards');

    expect(result.unplacedPieces).toEqual([]);
    expect(normalizeResult(result)).toMatchSnapshot();
  });
});
