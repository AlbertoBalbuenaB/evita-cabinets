import { describe, it, expect } from 'vitest';
import { decodePrefabCode, type DecodedPrefabCode } from './prefabCodeDecoder';

/**
 * Tests use real codes from data/prefab/venus_2024_09.csv and
 * data/prefab/northville_2024_09.csv. Coverage target: ≥80% of unique SKUs
 * decoded at 'high' or 'medium' confidence.
 */

describe('decodePrefabCode — Venus SKUs', () => {
  it('base cabinets: B12..B42 → base dims (24d × 34.5h)', () => {
    for (const code of ['B12', 'B15', 'B18', 'B24', 'B30', 'B36', 'B42']) {
      const r = decodePrefabCode(code);
      expect(r.item_type).toBe('cabinet');
      expect(r.depth_in).toBe(24);
      expect(r.height_in).toBe(34.5);
      expect(r.confidence).toBe('high');
    }
    expect(decodePrefabCode('B24').width_in).toBe(24);
    expect(decodePrefabCode('B42').width_in).toBe(42);
  });

  it('drawer base: DB12, DB24-2', () => {
    expect(decodePrefabCode('DB12')).toMatchObject({
      width_in: 12, depth_in: 24, height_in: 34.5, confidence: 'high',
    });
    expect(decodePrefabCode('DB24-2')).toMatchObject({
      width_in: 24, confidence: 'high',
    });
  });

  it('sink base: SB30..SB42', () => {
    for (const code of ['SB30', 'SB33', 'SB36', 'SB39', 'SB42']) {
      const r = decodePrefabCode(code);
      expect(r.width_in).toBe(parseInt(code.slice(2), 10));
      expect(r.depth_in).toBe(24);
      expect(r.confidence).toBe('high');
    }
  });

  it('wall 4-digit: W1230 → 12×30×12', () => {
    expect(decodePrefabCode('W1230')).toMatchObject({
      width_in: 12, height_in: 30, depth_in: 12, confidence: 'high',
    });
    expect(decodePrefabCode('W3636')).toMatchObject({
      width_in: 36, height_in: 36, depth_in: 12,
    });
    expect(decodePrefabCode('W0930')).toMatchObject({
      width_in: 9, height_in: 30, depth_in: 12,
    });
  });

  it('wall 6-digit (deep): W301224 → 30×12×24', () => {
    expect(decodePrefabCode('W301224')).toMatchObject({
      width_in: 30, height_in: 12, depth_in: 24, confidence: 'high',
    });
    expect(decodePrefabCode('W362424')).toMatchObject({
      width_in: 36, height_in: 24, depth_in: 24,
    });
  });

  it('glass door wall: GDW1230, GDW3636', () => {
    expect(decodePrefabCode('GDW1230')).toMatchObject({
      width_in: 12, height_in: 30, depth_in: 12, confidence: 'high',
    });
    expect(decodePrefabCode('GDW3636')).toMatchObject({
      width_in: 36, height_in: 36, depth_in: 12,
    });
  });

  it('glass door wall diagonal corner: GDWDC2430', () => {
    expect(decodePrefabCode('GDWDC2430')).toMatchObject({
      width_in: 24, height_in: 30, depth_in: 12, confidence: 'high',
    });
  });

  it('tall pantry: TP1884 → 18w × 84h × 24d', () => {
    expect(decodePrefabCode('TP1884')).toMatchObject({
      width_in: 18, height_in: 84, depth_in: 24, confidence: 'high',
    });
    expect(decodePrefabCode('TP3096')).toMatchObject({
      width_in: 30, height_in: 96, depth_in: 24,
    });
  });

  it('oven cabinet: OC3384, OC3096', () => {
    expect(decodePrefabCode('OC3384')).toMatchObject({
      width_in: 33, height_in: 84, depth_in: 24, confidence: 'high',
    });
    expect(decodePrefabCode('OC3096')).toMatchObject({
      width_in: 30, height_in: 96, depth_in: 24,
    });
  });

  it('range hood: RHA3030, RHA4236', () => {
    expect(decodePrefabCode('RHA3030')).toMatchObject({
      width_in: 30, height_in: 30, confidence: 'high',
    });
    expect(decodePrefabCode('RHA4236')).toMatchObject({
      width_in: 42, height_in: 36,
    });
  });

  it('vanity base (Venus VB): VB1221 → 12w × 21d', () => {
    expect(decodePrefabCode('VB1221')).toMatchObject({
      width_in: 12, depth_in: 21, height_in: 34.5, confidence: 'high',
    });
    expect(decodePrefabCode('VB3621')).toMatchObject({ width_in: 36 });
  });

  it('vanity drawer base (Venus VDB): VDB1221', () => {
    expect(decodePrefabCode('VDB1221')).toMatchObject({
      width_in: 12, depth_in: 21, height_in: 34.5, confidence: 'high',
    });
  });

  it('vanity sink base (Venus VSB): VSB2421', () => {
    expect(decodePrefabCode('VSB2421')).toMatchObject({
      width_in: 24, depth_in: 21, height_in: 34.5, confidence: 'high',
    });
  });

  it('vanity sink drawer (Venus VSD): VSD3021L', () => {
    const r = decodePrefabCode('VSD3021L');
    expect(r.width_in).toBe(30);
    expect(r.depth_in).toBe(21);
    expect(r.height_in).toBe(34.5);
  });

  it('base filler BF: linear with width', () => {
    expect(decodePrefabCode('BF3').item_type).toBe('linear');
    expect(decodePrefabCode('BF6').item_type).toBe('linear');
  });

  it('toe kick TK8, scribe molding SM → linear', () => {
    expect(decodePrefabCode('TK8').item_type).toBe('linear');
    expect(decodePrefabCode('SM').item_type).toBe('linear');
    expect(decodePrefabCode('SM8-S').item_type).toBe('linear');
  });

  it('unknown / singleton codes fall back to low confidence', () => {
    for (const code of ['TOUCH', 'STKM', 'KD', 'DM', 'CP', 'QRM']) {
      const r = decodePrefabCode(code);
      expect(r.confidence).toBe('low');
      expect(r.width_in).toBeNull();
    }
  });
});

describe('decodePrefabCode — Northville SKUs', () => {
  it('base cabinets: B06..B42', () => {
    for (const code of ['B06', 'B09', 'B12', 'B24', 'B36', 'B42']) {
      const r = decodePrefabCode(code);
      expect(r.depth_in).toBe(24);
      expect(r.confidence).toBe('high');
    }
  });

  it('drawer base with -3 suffix: DB12-3..DB36-3', () => {
    for (const code of ['DB12-3', 'DB18-3', 'DB24-3', 'DB36-3']) {
      const r = decodePrefabCode(code);
      expect(r.width_in).toBe(parseInt(code.slice(2, 4), 10));
      expect(r.confidence).toBe('high');
    }
  });

  it('wall microwave (WMD): WMD1215, WMD2430-2', () => {
    expect(decodePrefabCode('WMD1215')).toMatchObject({
      width_in: 12, height_in: 15, depth_in: 12, confidence: 'high',
    });
    expect(decodePrefabCode('WMD2430-2')).toMatchObject({
      width_in: 24, height_in: 30, depth_in: 12,
    });
  });

  it('wall pantry (tall) WP1884, WP188427', () => {
    expect(decodePrefabCode('WP1884')).toMatchObject({
      width_in: 18, height_in: 84, depth_in: 24, confidence: 'high',
    });
    expect(decodePrefabCode('WP188427')).toMatchObject({
      width_in: 18, height_in: 84, depth_in: 27,
    });
  });

  it('wall diagonal corner: WDC2430, WDC243615', () => {
    expect(decodePrefabCode('WDC2430')).toMatchObject({
      width_in: 24, height_in: 30, depth_in: 12, confidence: 'high',
    });
    expect(decodePrefabCode('WDC243615')).toMatchObject({
      width_in: 24, height_in: 36,
    });
  });

  it('vanity (Northville VA): VA242134, VA362134DL/R', () => {
    expect(decodePrefabCode('VA242134')).toMatchObject({
      width_in: 24, depth_in: 21, height_in: 34, confidence: 'high',
    });
    const dlr = decodePrefabCode('VA362134DL/R');
    expect(dlr.width_in).toBe(36);
    expect(dlr.depth_in).toBe(21);
  });

  it('vanity drawer base (Northville): VDB12-3, VDB122134-3', () => {
    expect(decodePrefabCode('VDB12-3')).toMatchObject({
      width_in: 12, depth_in: 21, confidence: 'high',
    });
    expect(decodePrefabCode('VDB122134-3')).toMatchObject({
      width_in: 12, depth_in: 21, height_in: 34,
    });
  });

  it('sink base: SB30..SB42', () => {
    for (const code of ['SB30', 'SB33', 'SB36', 'SB39', 'SB42']) {
      expect(decodePrefabCode(code).confidence).toBe('high');
    }
  });

  it('oven cabinet with depth: OC3084, OC308427', () => {
    expect(decodePrefabCode('OC3084')).toMatchObject({
      width_in: 30, height_in: 84, depth_in: 24,
    });
    expect(decodePrefabCode('OC308427')).toMatchObject({
      width_in: 30, height_in: 84, depth_in: 27,
    });
  });

  it('valance (VAS): linear', () => {
    expect(decodePrefabCode('VAS4210').item_type).toBe('linear');
    expect(decodePrefabCode('VAS6010').item_type).toBe('linear');
  });

  it('wall standard: W1215..W3642', () => {
    expect(decodePrefabCode('W1215')).toMatchObject({
      width_in: 12, height_in: 15, depth_in: 12,
    });
    expect(decodePrefabCode('W3642')).toMatchObject({
      width_in: 36, height_in: 42, depth_in: 12,
    });
  });

  it('refrigerator panel RRPF → panel', () => {
    expect(decodePrefabCode('RRPF').item_type).toBe('panel');
  });

  it('strips surrounding quotes and whitespace', () => {
    expect(decodePrefabCode(' "B24" ').width_in).toBe(24);
  });
});

describe('decodePrefabCode — coverage sanity', () => {
  const venusSkus = [
    'B12', 'B18', 'B24', 'B36', 'B42', 'DB12', 'DB24-2', 'DB30-2',
    'SB30', 'SB36', 'SB42', 'W1230', 'W3636', 'W4242', 'W301224',
    'GDW1230', 'GDW3636', 'GDWDC2430', 'TP1884', 'TP3096', 'OC3384',
    'OC3096', 'RHA3030', 'RHA4236', 'VB1221', 'VB3621', 'VDB1221',
    'VDB2421', 'VSB2421', 'VSD3021L', 'BF3', 'BF6', 'TK8', 'SM',
  ];
  const northvilleSkus = [
    'B06', 'B12', 'B24', 'B36', 'DB12-3', 'DB24-3', 'DB36-3', 'SB30',
    'SB36', 'SB42', 'W1215', 'W3030', 'W3642', 'WMD1215', 'WMD2430-2',
    'WMD3636-2', 'WP1884', 'WP2496', 'WDC2430', 'WDC3636', 'VA242134',
    'VA362134DL/R', 'VDB12-3', 'VDB24-3', 'OC3084', 'OC308427', 'OC3096',
    'VAS4210', 'VAS6010', 'TK8', 'SM8', 'RRPF',
  ];

  function highOrMediumRate(codes: string[]): number {
    const n = codes.filter((c) => {
      const r = decodePrefabCode(c);
      return r.confidence === 'high' || r.confidence === 'medium';
    }).length;
    return n / codes.length;
  }

  it('Venus sample ≥80% high/medium', () => {
    expect(highOrMediumRate(venusSkus)).toBeGreaterThanOrEqual(0.8);
  });

  it('Northville sample ≥80% high/medium', () => {
    expect(highOrMediumRate(northvilleSkus)).toBeGreaterThanOrEqual(0.8);
  });

  it('default shape is non-crashing for empty string', () => {
    const r: DecodedPrefabCode = decodePrefabCode('');
    expect(r.confidence).toBe('low');
  });
});
