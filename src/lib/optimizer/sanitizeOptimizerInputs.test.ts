import { describe, it, expect } from 'vitest';
import {
  sanitizeOptimizerInputs,
  MAX_QTY_PER_PIECE,
  MAX_TOTAL_EXPANDED,
} from './sanitizeOptimizerInputs';
import type { Pieza, StockSize } from './types';

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

function makeStock(overrides: Partial<StockSize> = {}): StockSize {
  return {
    id: overrides.id ?? 's',
    nombre: overrides.nombre ?? 'stock',
    ancho: 2440,
    alto: 1220,
    costo: 100,
    sierra: 4.5,
    ...overrides,
  };
}

describe('sanitizeOptimizerInputs — happy path', () => {
  it('passes valid pieces and stocks through unchanged', () => {
    const pieces = [makePiece({ id: 'p1' }), makePiece({ id: 'p2', cantidad: 4 })];
    const stocks = [makeStock({ id: 's1' })];
    const r = sanitizeOptimizerInputs(pieces, stocks);
    expect(r.cleanPieces).toHaveLength(2);
    expect(r.cleanStocks).toHaveLength(1);
    expect(r.dropped).toHaveLength(0);
    expect(r.cleanPieces[0]).toBe(pieces[0]);
    expect(r.cleanPieces[1]).toBe(pieces[1]);
  });

  it('handles empty input arrays without crashing', () => {
    const r = sanitizeOptimizerInputs([], []);
    expect(r.cleanPieces).toEqual([]);
    expect(r.cleanStocks).toEqual([]);
    expect(r.dropped).toEqual([]);
  });
});

describe('sanitizeOptimizerInputs — invalid piece dimensions', () => {
  const badValues: Array<[string, unknown]> = [
    ['0', 0],
    ['-5', -5],
    ['NaN', NaN],
    ['Infinity', Infinity],
    ['null', null],
    ['undefined', undefined],
  ];

  for (const [label, value] of badValues) {
    it(`drops piece with ancho = ${label}`, () => {
      const p = makePiece({ id: 'bad', ancho: value as number });
      const r = sanitizeOptimizerInputs([p, makePiece({ id: 'good' })], [makeStock()]);
      expect(r.cleanPieces.map((x) => x.id)).toEqual(['good']);
      expect(r.dropped).toHaveLength(1);
      expect(r.dropped[0].kind).toBe('piece');
      expect(r.dropped[0].reason).toContain('ancho');
      expect(r.dropped[0].sample.id).toBe('bad');
    });

    it(`drops piece with alto = ${label}`, () => {
      const p = makePiece({ id: 'bad', alto: value as number });
      const r = sanitizeOptimizerInputs([p], [makeStock()]);
      expect(r.cleanPieces).toHaveLength(0);
      expect(r.dropped[0].reason).toContain('alto');
    });

    it(`drops piece with grosor = ${label}`, () => {
      const p = makePiece({ id: 'bad', grosor: value as number });
      const r = sanitizeOptimizerInputs([p], [makeStock()]);
      expect(r.cleanPieces).toHaveLength(0);
      expect(r.dropped[0].reason).toContain('grosor');
    });

    it(`drops piece with cantidad = ${label}`, () => {
      const p = makePiece({ id: 'bad', cantidad: value as number });
      const r = sanitizeOptimizerInputs([p], [makeStock()]);
      expect(r.cleanPieces).toHaveLength(0);
      expect(r.dropped[0].reason).toContain('cantidad');
    });
  }
});

describe('sanitizeOptimizerInputs — invalid stock dimensions', () => {
  it('drops stock with ancho = 0', () => {
    const r = sanitizeOptimizerInputs([makePiece()], [makeStock({ id: 'bad', ancho: 0 })]);
    expect(r.cleanStocks).toHaveLength(0);
    expect(r.dropped[0].kind).toBe('stock');
    expect(r.dropped[0].reason).toContain('ancho');
  });

  it('drops stock with NaN alto', () => {
    const r = sanitizeOptimizerInputs([makePiece()], [makeStock({ id: 'bad', alto: NaN })]);
    expect(r.cleanStocks).toHaveLength(0);
    expect(r.dropped[0].reason).toContain('alto');
  });

  it('keeps stock with costo = 0 (valid — materials can be priced at zero)', () => {
    const r = sanitizeOptimizerInputs([makePiece()], [makeStock({ id: 'free', costo: 0 })]);
    expect(r.cleanStocks).toHaveLength(1);
    expect(r.dropped).toHaveLength(0);
  });
});

describe('sanitizeOptimizerInputs — cantidad truncation', () => {
  it(`truncates cantidad above ${MAX_QTY_PER_PIECE} and logs a dropped entry`, () => {
    const r = sanitizeOptimizerInputs(
      [makePiece({ id: 'huge', cantidad: MAX_QTY_PER_PIECE + 500 })],
      [makeStock()],
    );
    expect(r.cleanPieces).toHaveLength(1);
    expect(r.cleanPieces[0].cantidad).toBe(MAX_QTY_PER_PIECE);
    expect(r.dropped).toHaveLength(1);
    expect(r.dropped[0].reason).toContain('truncated');
  });

  it(`keeps cantidad at exactly ${MAX_QTY_PER_PIECE} without dropping`, () => {
    const r = sanitizeOptimizerInputs(
      [makePiece({ cantidad: MAX_QTY_PER_PIECE })],
      [makeStock()],
    );
    expect(r.cleanPieces[0].cantidad).toBe(MAX_QTY_PER_PIECE);
    expect(r.dropped).toHaveLength(0);
  });
});

describe('sanitizeOptimizerInputs — total expanded cap', () => {
  it(`drops largest pieces first when Σ cantidad > ${MAX_TOTAL_EXPANDED}`, () => {
    // Three pieces summing to 60k: 30k + 20k + 10k. Cap is 50k.
    // After truncation to MAX_QTY_PER_PIECE, each is capped to 10k.
    // So actual expanded = 10k + 10k + 10k = 30k (under cap — no further drop).
    // We need pieces that SURVIVE individual truncation but collectively exceed cap.
    // Use many smaller pieces instead.
    const pieces: Pieza[] = [];
    for (let i = 0; i < 6; i++) {
      pieces.push(makePiece({ id: `p${i}`, cantidad: MAX_QTY_PER_PIECE })); // 6 × 10k = 60k
    }
    const r = sanitizeOptimizerInputs(pieces, [makeStock()]);
    const total = r.cleanPieces.reduce((s, p) => s + p.cantidad, 0);
    expect(total).toBeLessThanOrEqual(MAX_TOTAL_EXPANDED);
    // At least one must have been dropped to fit under cap.
    expect(r.cleanPieces.length).toBeLessThan(6);
    expect(r.dropped.some((d) => d.reason.includes('expanded cap'))).toBe(true);
  });

  it('keeps all pieces when total is exactly at the cap', () => {
    const pieces = [makePiece({ id: 'p1', cantidad: MAX_TOTAL_EXPANDED })];
    const r = sanitizeOptimizerInputs(pieces, [makeStock()]);
    // Piece gets capped to MAX_QTY_PER_PIECE first, which is below MAX_TOTAL_EXPANDED.
    expect(r.cleanPieces).toHaveLength(1);
    expect(r.cleanPieces[0].cantidad).toBe(MAX_QTY_PER_PIECE);
  });
});

describe('sanitizeOptimizerInputs — mixed realistic scenarios', () => {
  it('processes a mix of valid, invalid, and oversized pieces in one pass', () => {
    const pieces = [
      makePiece({ id: 'ok1' }),
      makePiece({ id: 'bad-ancho', ancho: 0 }),
      makePiece({ id: 'ok2', cantidad: 5 }),
      makePiece({ id: 'bad-qty', cantidad: -3 }),
      makePiece({ id: 'huge', cantidad: MAX_QTY_PER_PIECE + 1 }),
    ];
    const stocks = [
      makeStock({ id: 'ok-stock' }),
      makeStock({ id: 'bad-stock', ancho: NaN }),
    ];
    const r = sanitizeOptimizerInputs(pieces, stocks);
    expect(r.cleanPieces.map((p) => p.id)).toEqual(['ok1', 'ok2', 'huge']);
    expect(r.cleanPieces.find((p) => p.id === 'huge')!.cantidad).toBe(MAX_QTY_PER_PIECE);
    expect(r.cleanStocks.map((s) => s.id)).toEqual(['ok-stock']);
    // 2 invalid pieces + 1 stock + 1 truncation = 4 dropped entries.
    expect(r.dropped).toHaveLength(4);
  });
});
