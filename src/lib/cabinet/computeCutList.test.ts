import { describe, it, expect } from 'vitest';
import { computeCutList } from './computeCutList';
import type { CabinetConfig } from './CabinetConfig';
import type { CutPiece } from '../../types';

function findPiece(pieces: CutPiece[], nombre: string) {
  return pieces.find((p) => p.nombre === nombre);
}

// ── Reference Example: 101-12x30x24 base cabinet ────────────────────────────
describe('computeCutList — base cabinet 101-12x30x24', () => {
  const config: CabinetConfig = {
    widthMm: Math.round(12 * 25.4),
    heightMm: Math.round(30 * 25.4),
    depthMm: Math.round(24 * 25.4),
    family: 'base',
    boxThicknessMm: 18,
    shelfCount: 1,
    hasDoors: true,
    doorCount: 1,
    doorSectionHeightMm: 0,
    hasDrawers: false,
    drawerCount: 0,
    drawerSectionHeightMm: 0,
    shelfType: 'fixed',
    optimizeDepth: true,
  };

  const pieces = computeCutList(config);

  it('generates 6 pieces', () => {
    expect(pieces).toHaveLength(6);
  });

  it('Side Panels: 600×762, qty 2, cuerpo, cb {2,1,1,1}, veta vertical', () => {
    const p = findPiece(pieces, 'Side Panels')!;
    expect(p).toBeDefined();
    expect(p.ancho).toBe(600);
    expect(p.alto).toBe(762);
    expect(p.cantidad).toBe(2);
    expect(p.material).toBe('cuerpo');
    expect(p.cubrecanto).toEqual({ sup: 2, inf: 1, izq: 1, der: 1 });
    expect(p.veta).toBe('vertical');
  });

  it('Back Panel: 269×762, qty 1, back, cb {1,1,0,0}, veta vertical', () => {
    const p = findPiece(pieces, 'Back Panel')!;
    expect(p).toBeDefined();
    expect(p.ancho).toBe(269);
    expect(p.alto).toBe(762);
    expect(p.cantidad).toBe(1);
    expect(p.material).toBe('back');
    expect(p.cubrecanto).toEqual({ sup: 1, inf: 1, izq: 0, der: 0 });
    expect(p.veta).toBe('vertical');
  });

  it('Top Panel: 269×582, qty 1, cuerpo, cb {2,0,0,0}, veta horizontal', () => {
    const p = findPiece(pieces, 'Top Panel')!;
    expect(p).toBeDefined();
    expect(p.ancho).toBe(269);
    expect(p.alto).toBe(582);
    expect(p.cantidad).toBe(1);
    expect(p.material).toBe('cuerpo');
    expect(p.cubrecanto).toEqual({ sup: 2, inf: 0, izq: 0, der: 0 });
    expect(p.veta).toBe('horizontal');
  });

  it('Bottom Panel: 269×582, qty 1, cuerpo, cb {2,0,0,0}, veta horizontal', () => {
    const p = findPiece(pieces, 'Bottom Panel')!;
    expect(p).toBeDefined();
    expect(p.ancho).toBe(269);
    expect(p.alto).toBe(582);
    expect(p.cantidad).toBe(1);
    expect(p.material).toBe('cuerpo');
    expect(p.cubrecanto).toEqual({ sup: 2, inf: 0, izq: 0, der: 0 });
    expect(p.veta).toBe('horizontal');
  });

  it('Shelves: 269×564, qty 1, cuerpo, cb {1,0,0,0} (fixed), veta horizontal', () => {
    const p = findPiece(pieces, 'Shelves')!;
    expect(p).toBeDefined();
    expect(p.ancho).toBe(269);
    expect(p.alto).toBe(564);
    expect(p.cantidad).toBe(1);
    expect(p.material).toBe('cuerpo');
    expect(p.cubrecanto).toEqual({ sup: 1, inf: 0, izq: 0, der: 0 });
    expect(p.veta).toBe('horizontal');
  });

  it('Doors: 302×759, qty 1, frente, cb {2,2,2,2}, veta vertical', () => {
    const p = findPiece(pieces, 'Doors')!;
    expect(p).toBeDefined();
    expect(p.ancho).toBe(302);
    expect(p.alto).toBe(759);
    expect(p.cantidad).toBe(1);
    expect(p.material).toBe('frente');
    expect(p.cubrecanto).toEqual({ sup: 2, inf: 2, izq: 2, der: 2 });
    expect(p.veta).toBe('vertical');
  });
});

// ── Wall cabinet: side panels get {2,2,1,1} ─────────────────────────────────
describe('computeCutList — wall cabinet side panels', () => {
  const config: CabinetConfig = {
    widthMm: Math.round(30 * 25.4),
    heightMm: Math.round(15 * 25.4),
    depthMm: Math.round(12 * 25.4),
    family: 'wall',
    boxThicknessMm: 18,
    shelfCount: 2,
    hasDoors: true,
    doorCount: 2,
    doorSectionHeightMm: 0,
    hasDrawers: false,
    drawerCount: 0,
    drawerSectionHeightMm: 0,
    shelfType: 'adjustable',
    optimizeDepth: true,
  };

  const pieces = computeCutList(config);

  it('Side Panels have wall cubrecanto: {2,2,1,1} (both top and bottom visible)', () => {
    const p = findPiece(pieces, 'Side Panels')!;
    expect(p.cubrecanto).toEqual({ sup: 2, inf: 2, izq: 1, der: 1 });
    expect(p.veta).toBe('vertical');
  });

  it('Adjustable shelves have all-4-sides cubrecanto: {1,1,1,1}', () => {
    const p = findPiece(pieces, 'Shelves')!;
    expect(p.cubrecanto).toEqual({ sup: 1, inf: 1, izq: 1, der: 1 });
    expect(p.cantidad).toBe(2);
  });

  it('does NOT generate Front Rails for wall cabinets', () => {
    expect(findPiece(pieces, 'Front Rails')).toBeUndefined();
  });
});

// ── Drawer base: 3 drawers ──────────────────────────────────────────────────
describe('computeCutList — drawer base (3 drawers)', () => {
  const config: CabinetConfig = {
    widthMm: Math.round(24 * 25.4),
    heightMm: Math.round(30 * 25.4),
    depthMm: Math.round(24 * 25.4),
    family: 'base',
    boxThicknessMm: 18,
    shelfCount: 0,
    hasDoors: false,
    doorCount: 0,
    doorSectionHeightMm: 0,
    hasDrawers: true,
    drawerCount: 3,
    drawerSectionHeightMm: 0,
    optimizeDepth: true,
  };

  const pieces = computeCutList(config);

  it('generates Front Rails with qty = numDrawers', () => {
    const p = findPiece(pieces, 'Front Rails')!;
    expect(p).toBeDefined();
    expect(p.cantidad).toBe(3);
    expect(p.cubrecanto).toEqual({ sup: 1, inf: 0, izq: 0, der: 0 });
    expect(p.veta).toBe('horizontal');
  });

  it('Drawer Faces: frente, all-2 cubrecanto, qty 3, veta vertical', () => {
    const p = findPiece(pieces, 'Drawer Faces')!;
    expect(p).toBeDefined();
    expect(p.cantidad).toBe(3);
    expect(p.material).toBe('frente');
    expect(p.cubrecanto).toEqual({ sup: 2, inf: 2, izq: 2, der: 2 });
    expect(p.veta).toBe('vertical');
  });

  it('Drawer Box Sides: qty = 6, veta horizontal, cb {1,1,0,0}', () => {
    const p = findPiece(pieces, 'Drawer Box Sides')!;
    expect(p.cantidad).toBe(6);
    expect(p.veta).toBe('horizontal');
    expect(p.cubrecanto).toEqual({ sup: 1, inf: 1, izq: 0, der: 0 });
  });

  it('Drawer Box Ends: qty = 6, veta none, cb all-0, uses 15mm drawerBoxThickness', () => {
    const p = findPiece(pieces, 'Drawer Box Ends')!;
    expect(p.cantidad).toBe(6);
    expect(p.veta).toBe('none');
    expect(p.cubrecanto).toEqual({ sup: 0, inf: 0, izq: 0, der: 0 });
    // W = round(24 * 25.4) = 610mm, innerW = 610 - 2*18 = 574
    // boxOuterW = innerW - SLIDE_CLEARANCE = 574 - 26 = 548
    // Drawer Box Ends = boxOuterW - 2*drawerEsp = 548 - 2*15 = 518
    expect(p.ancho).toBe(518);
  });

  it('Drawer Box Bottom: qty = 3, veta none, cb all-0', () => {
    const p = findPiece(pieces, 'Drawer Box Bottom')!;
    expect(p.cantidad).toBe(3);
    expect(p.veta).toBe('none');
    expect(p.cubrecanto).toEqual({ sup: 0, inf: 0, izq: 0, der: 0 });
  });
});

// ── Depth optimization ──────────────────────────────────────────────────────
describe('computeCutList — depth optimization', () => {
  function baseConfig(overrides: Partial<CabinetConfig>): CabinetConfig {
    return {
      widthMm: Math.round(12 * 25.4),
      heightMm: Math.round(30 * 25.4),
      depthMm: Math.round(24 * 25.4),
      family: 'base',
      boxThicknessMm: 18,
      shelfCount: 0,
      hasDoors: false,
      doorCount: 0,
      doorSectionHeightMm: 0,
      hasDrawers: false,
      drawerCount: 0,
      drawerSectionHeightMm: 0,
      ...overrides,
    };
  }

  it('24" depth with optimizeDepth=true → 600mm', () => {
    const pieces = computeCutList(baseConfig({ optimizeDepth: true }));
    const side = findPiece(pieces, 'Side Panels')!;
    expect(side.ancho).toBe(600);
  });

  it('12" depth with optimizeDepth=true → 300mm', () => {
    const pieces = computeCutList(baseConfig({
      depthMm: Math.round(12 * 25.4),
      optimizeDepth: true,
    }));
    const side = findPiece(pieces, 'Side Panels')!;
    expect(side.ancho).toBe(300);
  });

  it('16" depth with optimizeDepth=true → 400mm (1/3 sheet)', () => {
    const pieces = computeCutList(baseConfig({
      depthMm: Math.round(16 * 25.4),
      optimizeDepth: true,
    }));
    const side = findPiece(pieces, 'Side Panels')!;
    expect(side.ancho).toBe(400);

    const top = findPiece(pieces, 'Top Panel')!;
    expect(top.alto).toBe(382);
  });

  it('18" depth with optimizeDepth=true → 450mm', () => {
    const pieces = computeCutList(baseConfig({
      depthMm: Math.round(18 * 25.4),
      optimizeDepth: true,
    }));
    const side = findPiece(pieces, 'Side Panels')!;
    expect(side.ancho).toBe(450);
    const top = findPiece(pieces, 'Top Panel')!;
    expect(top.alto).toBe(432);
  });

  it('17" depth with optimizeDepth=true → 450mm (falls in 18" bucket)', () => {
    const pieces = computeCutList(baseConfig({
      depthMm: Math.round(17 * 25.4),
      optimizeDepth: true,
    }));
    const side = findPiece(pieces, 'Side Panels')!;
    expect(side.ancho).toBe(450);
  });

  it('24" depth with optimizeDepth=false → 610mm (raw)', () => {
    const pieces = computeCutList(baseConfig({ optimizeDepth: false }));
    const side = findPiece(pieces, 'Side Panels')!;
    expect(side.ancho).toBe(610);
  });

  it('defaults to optimizeDepth=true when not specified', () => {
    const pieces = computeCutList(baseConfig({}));
    const side = findPiece(pieces, 'Side Panels')!;
    expect(side.ancho).toBe(600);
  });
});

// ── Sink base cabinet ───────────────────────────────────────────────────────
describe('computeCutList — sink base', () => {
  const config: CabinetConfig = {
    widthMm: Math.round(36 * 25.4),
    heightMm: Math.round(30 * 25.4),
    depthMm: Math.round(24 * 25.4),
    family: 'base',
    boxThicknessMm: 18,
    shelfCount: 2, // should be ignored for sink
    hasDoors: true,
    doorCount: 2,
    doorSectionHeightMm: 0,
    hasDrawers: false,
    drawerCount: 0,
    drawerSectionHeightMm: 0,
    isSink: true,
    optimizeDepth: true,
  };

  const pieces = computeCutList(config);

  it('has NO Top Panel', () => {
    expect(findPiece(pieces, 'Top Panel')).toBeUndefined();
  });

  it('has NO Shelves (even though shelves=2 was passed)', () => {
    expect(findPiece(pieces, 'Shelves')).toBeUndefined();
  });

  it('has 2 Stretchers', () => {
    const p = findPiece(pieces, 'Stretchers')!;
    expect(p).toBeDefined();
    expect(p.cantidad).toBe(2);
    expect(p.alto).toBe(100); // RAIL_HEIGHT
    expect(p.cubrecanto).toEqual({ sup: 1, inf: 0, izq: 0, der: 0 });
    expect(p.veta).toBe('horizontal');
  });

  it('still has Bottom Panel, Side Panels, Back Panel, and Doors', () => {
    expect(findPiece(pieces, 'Bottom Panel')).toBeDefined();
    expect(findPiece(pieces, 'Side Panels')).toBeDefined();
    expect(findPiece(pieces, 'Back Panel')).toBeDefined();
    expect(findPiece(pieces, 'Doors')).toBeDefined();
  });
});

// ── Backward compatibility ──────────────────────────────────────────────────
describe('computeCutList — default handling', () => {
  it('works without optional fields (shelfType, optimizeDepth, isSink)', () => {
    const pieces = computeCutList({
      widthMm: Math.round(12 * 25.4),
      heightMm: Math.round(30 * 25.4),
      depthMm: Math.round(24 * 25.4),
      family: 'base',
      boxThicknessMm: 18,
      shelfCount: 1,
      hasDoors: true,
      doorCount: 1,
      doorSectionHeightMm: 0,
      hasDrawers: false,
      drawerCount: 0,
      drawerSectionHeightMm: 0,
    });
    expect(pieces.length).toBeGreaterThan(0);
    for (const p of pieces) {
      expect(p.cubrecanto).toBeDefined();
      expect(p.veta).toBeDefined();
    }
  });

  it('defaults shelfType to adjustable for wall cabinets', () => {
    const pieces = computeCutList({
      widthMm: Math.round(30 * 25.4),
      heightMm: Math.round(15 * 25.4),
      depthMm: Math.round(12 * 25.4),
      family: 'wall',
      boxThicknessMm: 18,
      shelfCount: 1,
      hasDoors: false,
      doorCount: 0,
      doorSectionHeightMm: 0,
      hasDrawers: false,
      drawerCount: 0,
      drawerSectionHeightMm: 0,
      // no shelfType specified — should default to adjustable
    });
    const shelf = findPiece(pieces, 'Shelves')!;
    expect(shelf.cubrecanto).toEqual({ sup: 1, inf: 1, izq: 1, der: 1 });
  });
});

// ── Drawer box thickness ────────────────────────────────────────────────────
describe('computeCutList — drawer box thickness', () => {
  function drawerBase(overrides: Partial<CabinetConfig>): CabinetConfig {
    return {
      widthMm: Math.round(24 * 25.4),
      heightMm: Math.round(30 * 25.4),
      depthMm: Math.round(24 * 25.4),
      family: 'base',
      boxThicknessMm: 18,
      shelfCount: 0,
      hasDoors: false,
      doorCount: 0,
      doorSectionHeightMm: 0,
      hasDrawers: true,
      drawerCount: 3,
      drawerSectionHeightMm: 0,
      optimizeDepth: true,
      ...overrides,
    };
  }

  it('defaults to 15mm drawer box thickness when not specified', () => {
    const pieces = computeCutList(drawerBase({}));
    const ends = findPiece(pieces, 'Drawer Box Ends')!;
    // W=24"→610mm, D=24"→600mm(optimized), esp=18
    // innerW = 610 - 36 = 574, boxOuterW = 574 - 26 = 548
    // With drawerEsp=15: 548 - 30 = 518
    expect(ends.ancho).toBe(518);
  });

  it('uses custom drawerBoxThicknessMm when provided', () => {
    const pieces = computeCutList(drawerBase({ drawerBoxThicknessMm: 12 }));
    const ends = findPiece(pieces, 'Drawer Box Ends')!;
    // With drawerEsp=12: 548 - 24 = 524
    expect(ends.ancho).toBe(524);
  });

  it('does NOT affect body pieces (sides, top, bottom still use boxThicknessMm)', () => {
    const pieces = computeCutList(drawerBase({ drawerBoxThicknessMm: 12 }));
    const topPanel = findPiece(pieces, 'Top Panel')!;
    // Top panel alto = D - esp = 600 - 18 = 582 (uses boxThicknessMm, not drawerBoxThicknessMm)
    expect(topPanel.alto).toBe(582);
  });
});
