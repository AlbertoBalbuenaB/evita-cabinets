import { describe, it, expect } from 'vitest';
import { mergeOptimizationResults, type GroupResultPart } from './mergeOptimizationResults';
import type { BoardResult, Pieza, PlacedPiece } from './types';

function makePiece(overrides: Partial<Pieza> = {}): Pieza {
  return {
    id: overrides.id ?? 'p',
    nombre: overrides.nombre ?? 'piece',
    material: 'mat',
    grosor: 15,
    ancho: 1000,
    alto: 500,
    cantidad: 1,
    veta: 'none',
    cubrecanto: { sup: 0, inf: 0, izq: 0, der: 0 },
    ...overrides,
  } as Pieza;
}

function makePlaced(idx: number, piece?: Pieza): PlacedPiece {
  const p = piece ?? makePiece();
  return {
    piece: p,
    x: 0,
    y: 0,
    w: p.ancho,
    h: p.alto,
    rotated: false,
    idx,
  };
}

function makeBoard(overrides: Partial<BoardResult> = {}): BoardResult {
  return {
    ancho: 2440,
    alto: 1220,
    sierra: 4.5,
    material: 'mat',
    grosor: 15,
    stockInfo: { nombre: 'stock', costo: 100, isRemnant: false },
    placed: [],
    offcuts: [],
    areaTotal: 2.98,
    areaUsed: 2.0,
    areaWaste: 0.98,
    usage: 67.1,
    trim: 0,
    ...overrides,
  };
}

describe('mergeOptimizationResults — basic aggregation', () => {
  it('returns zeros when no parts are given', () => {
    const r = mergeOptimizationResults([], [], new Map());
    expect(r.boards).toEqual([]);
    expect(r.totalPieces).toBe(0);
    expect(r.efficiency).toBe(0);
    expect(r.totalCost).toBe(0);
    expect(r.timeMs).toBe(0);
    expect(r.strategy).toBe('');
    expect(r.usefulOffcuts).toBe(0);
    expect(r.unplacedPieces).toEqual([]);
  });

  it('concatenates boards from multiple groups in order', () => {
    const b1 = makeBoard({ material: 'maple' });
    const b2 = makeBoard({ material: 'birch' });
    const b3 = makeBoard({ material: 'birch' });
    const parts: GroupResultPart[] = [
      { groupKey: 'maple_15', boards: [b1], strategy: 's1', iters: 10, timeMs: 100 },
      { groupKey: 'birch_18', boards: [b2, b3], strategy: 's2', iters: 20, timeMs: 200 },
    ];
    const r = mergeOptimizationResults(parts, [], new Map());
    expect(r.boards).toHaveLength(3);
    expect(r.boards[0]).toBe(b1);
    expect(r.boards[1]).toBe(b2);
    expect(r.boards[2]).toBe(b3);
  });

  it('sums totalCost across all boards of all parts', () => {
    const parts: GroupResultPart[] = [
      { groupKey: 'a', boards: [makeBoard({ stockInfo: { nombre: 's', costo: 50, isRemnant: false } })], strategy: '', iters: 0, timeMs: 0 },
      { groupKey: 'b', boards: [makeBoard({ stockInfo: { nombre: 's', costo: 75, isRemnant: false } }), makeBoard({ stockInfo: { nombre: 's', costo: 25, isRemnant: false } })], strategy: '', iters: 0, timeMs: 0 },
    ];
    const r = mergeOptimizationResults(parts, [], new Map());
    expect(r.totalCost).toBe(150);
  });

  it('takes MAX of timeMs across parts (parallel wall-clock)', () => {
    const parts: GroupResultPart[] = [
      { groupKey: 'a', boards: [], strategy: '', iters: 0, timeMs: 500 },
      { groupKey: 'b', boards: [], strategy: '', iters: 0, timeMs: 1200 },
      { groupKey: 'c', boards: [], strategy: '', iters: 0, timeMs: 800 },
    ];
    expect(mergeOptimizationResults(parts, [], new Map()).timeMs).toBe(1200);
  });

  it('joins strategy with group prefix and " | " separator, skipping empty strategies', () => {
    const parts: GroupResultPart[] = [
      { groupKey: 'maple_15', boards: [], strategy: 'shelf-area', iters: 0, timeMs: 0 },
      { groupKey: 'birch_18', boards: [], strategy: '', iters: 0, timeMs: 0 },
      { groupKey: 'oak_18', boards: [], strategy: 'GRASP-shelf(perim)', iters: 0, timeMs: 0 },
    ];
    expect(mergeOptimizationResults(parts, [], new Map()).strategy).toBe('maple_15:shelf-area | oak_18:GRASP-shelf(perim)');
  });

  it('sums usefulOffcuts across boards', () => {
    const b1 = makeBoard({ offcuts: [{ x: 0, y: 0, w: 100, h: 100 }, { x: 0, y: 100, w: 100, h: 100 }] });
    const b2 = makeBoard({ offcuts: [{ x: 0, y: 0, w: 50, h: 50 }] });
    const parts: GroupResultPart[] = [
      { groupKey: 'a', boards: [b1, b2], strategy: '', iters: 0, timeMs: 0 },
    ];
    expect(mergeOptimizationResults(parts, [], new Map()).usefulOffcuts).toBe(3);
  });
});

describe('mergeOptimizationResults — efficiency (weighted avg)', () => {
  it('weights efficiency by areaTotal (not a simple mean)', () => {
    // Board A: areaTotal=10, areaUsed=9 → 90% efficiency, weight 10
    // Board B: areaTotal=1,  areaUsed=0.1 → 10% efficiency, weight 1
    // Expected: (9 + 0.1) / (10 + 1) × 100 = 82.73%
    // NOT the simple mean (50%).
    const bA = makeBoard({ areaTotal: 10, areaUsed: 9 });
    const bB = makeBoard({ areaTotal: 1, areaUsed: 0.1 });
    const parts: GroupResultPart[] = [
      { groupKey: 'a', boards: [bA], strategy: '', iters: 0, timeMs: 0 },
      { groupKey: 'b', boards: [bB], strategy: '', iters: 0, timeMs: 0 },
    ];
    const r = mergeOptimizationResults(parts, [], new Map());
    expect(r.efficiency).toBeCloseTo((9.1 / 11) * 100, 4);
  });

  it('returns 0 efficiency when all boards have areaTotal = 0', () => {
    const b = makeBoard({ areaTotal: 0, areaUsed: 0 });
    const parts: GroupResultPart[] = [
      { groupKey: 'a', boards: [b], strategy: '', iters: 0, timeMs: 0 },
    ];
    expect(mergeOptimizationResults(parts, [], new Map()).efficiency).toBe(0);
  });
});

describe('mergeOptimizationResults — totalPieces + unplacedPieces', () => {
  it('sums totalPieces from the input (cantidad sum)', () => {
    const pieces = [
      makePiece({ id: 'a', cantidad: 3 }),
      makePiece({ id: 'b', cantidad: 5 }),
    ];
    const r = mergeOptimizationResults([], pieces, new Map());
    expect(r.totalPieces).toBe(8);
  });

  it('reports unplaced pieces when boards.placed does not cover all expected cantidad', () => {
    const pA = makePiece({ id: 'a', nombre: 'Doors', cantidad: 3 });
    const pB = makePiece({ id: 'b', nombre: 'Sides', cantidad: 2 });
    // Group key 'maple_15' has both pieces; board placed only pA twice + pB zero times.
    const board = makeBoard({
      material: 'maple',
      placed: [makePlaced(0, pA), makePlaced(0, pA)], // idx 0 = pA, placed 2 of 3
    });
    const grouped = new Map<string, Pieza[]>();
    grouped.set('maple_15', [pA, pB]);
    const parts: GroupResultPart[] = [
      { groupKey: 'maple_15', boards: [board], strategy: '', iters: 0, timeMs: 0 },
    ];
    const r = mergeOptimizationResults(parts, [pA, pB], grouped);
    expect(r.unplacedPieces).toHaveLength(2);
    expect(r.unplacedPieces).toContainEqual({ nombre: 'Doors', ancho: 1000, alto: 500, count: 1 });
    expect(r.unplacedPieces).toContainEqual({ nombre: 'Sides', ancho: 1000, alto: 500, count: 2 });
  });

  it('reports empty unplaced when all cantidad is fully placed', () => {
    const pA = makePiece({ id: 'a', cantidad: 2 });
    const board = makeBoard({
      placed: [makePlaced(0, pA), makePlaced(0, pA)],
    });
    const grouped = new Map<string, Pieza[]>();
    grouped.set('k', [pA]);
    const parts: GroupResultPart[] = [
      { groupKey: 'k', boards: [board], strategy: '', iters: 0, timeMs: 0 },
    ];
    expect(mergeOptimizationResults(parts, [pA], grouped).unplacedPieces).toEqual([]);
  });

  it('aggregates unplaced across multiple groups independently (idx is group-local)', () => {
    const gA_p0 = makePiece({ id: 'a0', nombre: 'A0', cantidad: 2 });
    const gB_p0 = makePiece({ id: 'b0', nombre: 'B0', cantidad: 1 });
    // Group A: placed 1 of 2 for its piece at idx 0.
    const boardA = makeBoard({ placed: [makePlaced(0, gA_p0)] });
    // Group B: placed 0 of 1 for its piece at idx 0.
    const boardB = makeBoard({ placed: [] });
    const grouped = new Map<string, Pieza[]>();
    grouped.set('a', [gA_p0]);
    grouped.set('b', [gB_p0]);
    const parts: GroupResultPart[] = [
      { groupKey: 'a', boards: [boardA], strategy: '', iters: 0, timeMs: 0 },
      { groupKey: 'b', boards: [boardB], strategy: '', iters: 0, timeMs: 0 },
    ];
    const r = mergeOptimizationResults(parts, [gA_p0, gB_p0], grouped);
    expect(r.unplacedPieces).toHaveLength(2);
    expect(r.unplacedPieces).toContainEqual({ nombre: 'A0', ancho: 1000, alto: 500, count: 1 });
    expect(r.unplacedPieces).toContainEqual({ nombre: 'B0', ancho: 1000, alto: 500, count: 1 });
  });
});
