import { describe, it, expect } from 'vitest';
import {
  computeEdgebandCost,
  computeEdgebandRollsCost,
  type EbSlotMeta,
} from './computeEdgebandCost';
import type { Pieza, EbCabinetMap } from '../types';

function makePiece(overrides: Partial<Pieza> & { cabinetId?: string }): Pieza {
  return {
    id: overrides.id ?? 'p',
    nombre: 'piece',
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

describe('computeEdgebandCost — fallback pieces + ebSlotMeta', () => {
  it('registers fallback pieces in perEdgebandType when ebSlotMeta supplies plId/name', () => {
    // Piece whose cabinetId is NOT in ebCabinetMap — falls to legacy slot pricing.
    const pieces: Pieza[] = [
      makePiece({
        id: 'p1',
        cabinetId: 'cab-without-mapping',
        ancho: 1000,
        alto: 500,
        cantidad: 1,
        cubrecanto: { sup: 1, inf: 0, izq: 0, der: 0 }, // slot 1 → 'a'
      }),
    ];
    const ebPriceBySlot = { a: 8.3, b: 37, c: 32.43 };
    const ebCabinetMap: EbCabinetMap = {}; // empty — no mapping for our cabinet
    const ebSlotMeta: EbSlotMeta = {
      a: { plId: 'pl-a', name: 'Evita Plus 19x1mm' },
    };

    const result = computeEdgebandCost(pieces, ebPriceBySlot, ebCabinetMap, ebSlotMeta);

    // 1000mm top side = 1m. Cost = 1 * 8.3 = 8.3.
    expect(result.totalMeters).toBeCloseTo(1.0, 6);
    expect(result.totalCost).toBeCloseTo(8.3, 6);
    // perEdgebandType MUST contain the fallback piece under plId 'pl-a'.
    expect(result.perEdgebandType['pl-a']).toBeDefined();
    expect(result.perEdgebandType['pl-a'].meters).toBeCloseTo(1.0, 6);
    expect(result.perEdgebandType['pl-a'].cost).toBeCloseTo(8.3, 6);
  });

  it('aggregates mapped + fallback pieces under the same plId when both route there', () => {
    const pieces: Pieza[] = [
      // Mapped piece: cabEb says slot 1 → pl-a at 8.3/m
      makePiece({
        id: 'p1',
        cabinetId: 'cab-mapped',
        ancho: 1000, alto: 500, cantidad: 1,
        cubrecanto: { sup: 1, inf: 0, izq: 0, der: 0 },
      }),
      // Fallback piece: slot 1 falls to ebPriceBySlot.a, promoted to pl-a via ebSlotMeta
      makePiece({
        id: 'p2',
        cabinetId: 'cab-unmapped',
        ancho: 500, alto: 500, cantidad: 1,
        cubrecanto: { sup: 1, inf: 0, izq: 0, der: 0 },
      }),
    ];
    const ebPriceBySlot = { a: 8.3, b: 37, c: 32.43 };
    const ebCabinetMap: EbCabinetMap = {
      'cab-mapped': {
        1: { plId: 'pl-a', name: 'Evita Plus 19x1mm', pricePerMeter: 8.3 },
      },
    };
    const ebSlotMeta: EbSlotMeta = {
      a: { plId: 'pl-a', name: 'Evita Plus 19x1mm' },
    };

    const result = computeEdgebandCost(pieces, ebPriceBySlot, ebCabinetMap, ebSlotMeta);

    // Total meters: 1.0 (mapped) + 0.5 (fallback) = 1.5
    expect(result.totalMeters).toBeCloseTo(1.5, 6);
    expect(result.totalCost).toBeCloseTo(1.5 * 8.3, 6);
    // Both pieces fold into the same plId bucket.
    expect(Object.keys(result.perEdgebandType)).toEqual(['pl-a']);
    expect(result.perEdgebandType['pl-a'].meters).toBeCloseTo(1.5, 6);
  });
});

describe('computeEdgebandRollsCost', () => {
  it('rounds each edgeband type independently to whole rolls', () => {
    // 4 distinct types, 100 meters each. Each rounds up to 1 roll
    // individually → 4 rolls total, NOT 400/150 = 3 rolls.
    const pieces: Pieza[] = [
      makePiece({ id: 'p1', cabinetId: 'c1', ancho: 100_000, alto: 500, cantidad: 1, cubrecanto: { sup: 1, inf: 0, izq: 0, der: 0 } }),
      makePiece({ id: 'p2', cabinetId: 'c2', ancho: 100_000, alto: 500, cantidad: 1, cubrecanto: { sup: 1, inf: 0, izq: 0, der: 0 } }),
      makePiece({ id: 'p3', cabinetId: 'c3', ancho: 100_000, alto: 500, cantidad: 1, cubrecanto: { sup: 1, inf: 0, izq: 0, der: 0 } }),
      makePiece({ id: 'p4', cabinetId: 'c4', ancho: 100_000, alto: 500, cantidad: 1, cubrecanto: { sup: 1, inf: 0, izq: 0, der: 0 } }),
    ];
    const ebPriceBySlot = { a: 10, b: 0, c: 0 };
    const ebCabinetMap: EbCabinetMap = {
      c1: { 1: { plId: 'A', name: 'A', pricePerMeter: 10 } },
      c2: { 1: { plId: 'B', name: 'B', pricePerMeter: 10 } },
      c3: { 1: { plId: 'C', name: 'C', pricePerMeter: 10 } },
      c4: { 1: { plId: 'D', name: 'D', pricePerMeter: 10 } },
    };

    const rollsCost = computeEdgebandRollsCost(pieces, ebPriceBySlot, ebCabinetMap, {}, 150);
    // Each type: 1 roll × 10/m × 150m = 1500. Total = 4 × 1500 = 6000.
    expect(rollsCost).toBeCloseTo(6000, 6);
  });

  it('skips Not Apply edgebands in the rolls total', () => {
    const pieces: Pieza[] = [
      makePiece({ id: 'p1', cabinetId: 'c1', ancho: 50_000, alto: 500, cantidad: 1, cubrecanto: { sup: 1, inf: 0, izq: 0, der: 0 } }),
    ];
    const ebCabinetMap: EbCabinetMap = {
      c1: { 1: { plId: 'NA', name: 'Not Apply', pricePerMeter: 0 } },
    };
    const rollsCost = computeEdgebandRollsCost(pieces, { a: 0, b: 0, c: 0 }, ebCabinetMap, {}, 150);
    expect(rollsCost).toBe(0);
  });
});
