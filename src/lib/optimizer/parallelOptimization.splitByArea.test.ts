import { describe, it, expect } from 'vitest';
import { groupPiecesBy, poolGroupKey, perAreaGroupKey } from './parallelOptimization';
import type { Pieza } from './types';

function makePiece(overrides: Partial<Pieza> = {}): Pieza {
  return {
    id: overrides.id ?? 'p',
    nombre: overrides.nombre ?? 'piece',
    material: overrides.material ?? 'White Laminate',
    grosor: overrides.grosor ?? 18,
    ancho: 1000,
    alto: 500,
    cantidad: 1,
    veta: 'none',
    cubrecanto: { sup: 0, inf: 0, izq: 0, der: 0 },
    ...overrides,
  } as Pieza;
}

describe('parallelOptimization — grouping keys', () => {
  describe('poolGroupKey (default, legacy)', () => {
    it('keys by material + thickness, pooling across areas', () => {
      // Kitchen and Closet pieces of the same material + thickness share one group.
      const kitchenA = makePiece({ id: 'k1', areaId: 'kitchen', area: 'Kitchen' });
      const closetA = makePiece({ id: 'c1', areaId: 'closet', area: 'Closet' });
      expect(poolGroupKey(kitchenA)).toBe('White Laminate_18');
      expect(poolGroupKey(closetA)).toBe('White Laminate_18');
      expect(poolGroupKey(kitchenA)).toBe(poolGroupKey(closetA));
    });

    it('keys differ by thickness even for the same material', () => {
      const a = makePiece({ grosor: 18 });
      const b = makePiece({ grosor: 15 });
      expect(poolGroupKey(a)).not.toBe(poolGroupKey(b));
    });
  });

  describe('perAreaGroupKey (split mode)', () => {
    it('keys by material + thickness + areaId, so pieces from different areas split', () => {
      const kitchen = makePiece({ areaId: 'kitchen', area: 'Kitchen' });
      const closet = makePiece({ areaId: 'closet', area: 'Closet' });
      expect(perAreaGroupKey(kitchen)).toBe('White Laminate_18_kitchen');
      expect(perAreaGroupKey(closet)).toBe('White Laminate_18_closet');
      expect(perAreaGroupKey(kitchen)).not.toBe(perAreaGroupKey(closet));
    });

    it('falls back to __no_area__ when areaId is missing, keeping pieces groupable', () => {
      const orphan = makePiece({ areaId: undefined });
      expect(perAreaGroupKey(orphan)).toBe('White Laminate_18___no_area__');
    });

    it('pieces in the same area of the same material still pool together within the area', () => {
      const k1 = makePiece({ id: 'k1', areaId: 'kitchen', area: 'Kitchen', nombre: 'Side' });
      const k2 = makePiece({ id: 'k2', areaId: 'kitchen', area: 'Kitchen', nombre: 'Top' });
      expect(perAreaGroupKey(k1)).toBe(perAreaGroupKey(k2));
    });
  });
});

describe('parallelOptimization — groupPiecesBy partitioning', () => {
  const kitchenA = makePiece({ id: 'kA', areaId: 'kitchen', area: 'Kitchen' });
  const kitchenB = makePiece({ id: 'kB', areaId: 'kitchen', area: 'Kitchen', nombre: 'Top' });
  const closetA = makePiece({ id: 'cA', areaId: 'closet', area: 'Closet' });
  const closetB = makePiece({ id: 'cB', areaId: 'closet', area: 'Closet', nombre: 'Back' });
  const laundryA = makePiece({ id: 'lA', areaId: 'laundry', area: 'Laundry', grosor: 15 });

  it('pooled mode produces N groups = unique(material_grosor)', () => {
    const groups = groupPiecesBy([kitchenA, kitchenB, closetA, closetB, laundryA], poolGroupKey);
    // "White Laminate_18" pools Kitchen + Closet; "White Laminate_15" holds Laundry alone.
    expect(groups.size).toBe(2);
    expect(groups.get('White Laminate_18')).toHaveLength(4);
    expect(groups.get('White Laminate_15')).toHaveLength(1);
  });

  it('per-area mode produces N groups = unique(material_grosor_areaId)', () => {
    const groups = groupPiecesBy([kitchenA, kitchenB, closetA, closetB, laundryA], perAreaGroupKey);
    // Kitchen_18, Closet_18, Laundry_15 → 3 separate groups.
    expect(groups.size).toBe(3);
    expect(groups.get('White Laminate_18_kitchen')).toHaveLength(2);
    expect(groups.get('White Laminate_18_closet')).toHaveLength(2);
    expect(groups.get('White Laminate_15_laundry')).toHaveLength(1);
  });

  it('preserves insertion order of keys so RNG seeding stays deterministic', () => {
    const groups = groupPiecesBy([kitchenA, closetA, laundryA], perAreaGroupKey);
    const keys = Array.from(groups.keys());
    expect(keys).toEqual([
      'White Laminate_18_kitchen',
      'White Laminate_18_closet',
      'White Laminate_15_laundry',
    ]);
  });

  it('returns an empty Map when given no pieces', () => {
    expect(groupPiecesBy([], poolGroupKey).size).toBe(0);
    expect(groupPiecesBy([], perAreaGroupKey).size).toBe(0);
  });
});

describe('parallelOptimization — per-area splitting reduces pack pressure', () => {
  it('a single material spanning many areas becomes many small groups instead of one large one', () => {
    // Simulate the 1030 W 8th Street / Custom "Wilsonart 18mm" pathology:
    // 28 piece-types all using the same material, spread across 6 areas.
    const areas = ['Kitchen', 'Closet', 'Laundry', 'Bath', 'Pantry', 'Entry'];
    const pieces: Pieza[] = [];
    for (let i = 0; i < 28; i++) {
      const areaIdx = i % areas.length;
      pieces.push(makePiece({
        id: `w${i}`,
        nombre: `Part-${i}`,
        material: 'Wilsonart 18mm',
        grosor: 18,
        areaId: areas[areaIdx]!.toLowerCase(),
        area: areas[areaIdx],
      }));
    }

    const pooled = groupPiecesBy(pieces, poolGroupKey);
    const perArea = groupPiecesBy(pieces, perAreaGroupKey);

    // Pooled: all 28 piece-types cram into one worker — the pathological case.
    expect(pooled.size).toBe(1);
    expect(pooled.get('Wilsonart 18mm_18')).toHaveLength(28);

    // Per-area: each worker gets ~4-5 piece-types — dramatically smaller problem.
    expect(perArea.size).toBe(6);
    for (const group of perArea.values()) {
      expect(group.length).toBeLessThanOrEqual(5);
    }
  });
});
