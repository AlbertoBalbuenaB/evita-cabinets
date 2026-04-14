import { describe, it, expect } from 'vitest';
import { calculateDespiece, type DespieceInput } from './despieceCalculator';

function findPiece(pieces: ReturnType<typeof calculateDespiece>, nombre: string) {
  return pieces.find((p) => p.nombre === nombre);
}

// ── Reference Example: 101-12x30x24 base cabinet ────────────────────────────
describe('calculateDespiece — base cabinet 101-12x30x24', () => {
  const input: DespieceInput = {
    heightIn: 30,
    widthIn: 12,
    depthIn: 24,
    cabinetType: 'base',
    bodyThickness: 18,
    shelves: 1,
    hasDoors: true,
    numDoors: 1,
    doorSectionHeightIn: 0,
    hasDrawers: false,
    numDrawers: 0,
    drawerSectionHeightIn: 0,
    shelfType: 'fixed',
    optimizeDepth: true,
  };

  const pieces = calculateDespiece(input);

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
describe('calculateDespiece — wall cabinet side panels', () => {
  const input: DespieceInput = {
    heightIn: 15,
    widthIn: 30,
    depthIn: 12,
    cabinetType: 'wall',
    bodyThickness: 18,
    shelves: 2,
    hasDoors: true,
    numDoors: 2,
    doorSectionHeightIn: 0,
    hasDrawers: false,
    numDrawers: 0,
    drawerSectionHeightIn: 0,
    shelfType: 'adjustable',
    optimizeDepth: true,
  };

  const pieces = calculateDespiece(input);

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
describe('calculateDespiece — drawer base (3 drawers)', () => {
  const input: DespieceInput = {
    heightIn: 30,
    widthIn: 24,
    depthIn: 24,
    cabinetType: 'base',
    bodyThickness: 18,
    shelves: 0,
    hasDoors: false,
    numDoors: 0,
    doorSectionHeightIn: 0,
    hasDrawers: true,
    numDrawers: 3,
    drawerSectionHeightIn: 0,
    optimizeDepth: true,
  };

  const pieces = calculateDespiece(input);

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
    // W=24" → 610mm raw → 600mm optimized, esp=18
    // innerW = 600 - 36 = 564 (wait, W=24" → W=610→not depth, W is width)
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
describe('calculateDespiece — depth optimization', () => {
  const base: DespieceInput = {
    heightIn: 30,
    widthIn: 12,
    depthIn: 24,
    cabinetType: 'base',
    bodyThickness: 18,
    shelves: 0,
    hasDoors: false,
    numDoors: 0,
    doorSectionHeightIn: 0,
    hasDrawers: false,
    numDrawers: 0,
    drawerSectionHeightIn: 0,
  };

  it('24" depth with optimizeDepth=true → 600mm', () => {
    const pieces = calculateDespiece({ ...base, optimizeDepth: true });
    const side = findPiece(pieces, 'Side Panels')!;
    expect(side.ancho).toBe(600);
  });

  it('12" depth with optimizeDepth=true → 300mm', () => {
    const pieces = calculateDespiece({ ...base, depthIn: 12, optimizeDepth: true });
    const side = findPiece(pieces, 'Side Panels')!;
    expect(side.ancho).toBe(300);
  });

  it('16" depth with optimizeDepth=true → 400mm (1/3 sheet)', () => {
    const pieces = calculateDespiece({ ...base, depthIn: 16, optimizeDepth: true });
    const side = findPiece(pieces, 'Side Panels')!;
    expect(side.ancho).toBe(400);  // 16"D → 400mm, not 600mm

    const top = findPiece(pieces, 'Top Panel')!;
    expect(top.alto).toBe(382);    // 400 - 18 = 382mm
  });

  it('24" depth with optimizeDepth=false → 610mm (raw)', () => {
    const pieces = calculateDespiece({ ...base, optimizeDepth: false });
    const side = findPiece(pieces, 'Side Panels')!;
    expect(side.ancho).toBe(610);
  });

  it('defaults to optimizeDepth=true when not specified', () => {
    const pieces = calculateDespiece(base); // no optimizeDepth field
    const side = findPiece(pieces, 'Side Panels')!;
    expect(side.ancho).toBe(600);
  });
});

// ── Sink base cabinet ───────────────────────────────────────────────────────
describe('calculateDespiece — sink base', () => {
  const input: DespieceInput = {
    heightIn: 30,
    widthIn: 36,
    depthIn: 24,
    cabinetType: 'base',
    bodyThickness: 18,
    shelves: 2, // should be ignored for sink
    hasDoors: true,
    numDoors: 2,
    doorSectionHeightIn: 0,
    hasDrawers: false,
    numDrawers: 0,
    drawerSectionHeightIn: 0,
    isSink: true,
    optimizeDepth: true,
  };

  const pieces = calculateDespiece(input);

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
describe('calculateDespiece — backward compatibility', () => {
  it('works without V2 fields (shelfType, optimizeDepth, isSink)', () => {
    const pieces = calculateDespiece({
      heightIn: 30,
      widthIn: 12,
      depthIn: 24,
      cabinetType: 'base',
      bodyThickness: 18,
      shelves: 1,
      hasDoors: true,
      numDoors: 1,
      doorSectionHeightIn: 0,
      hasDrawers: false,
      numDrawers: 0,
      drawerSectionHeightIn: 0,
    });
    // Should still produce valid output with defaults
    expect(pieces.length).toBeGreaterThan(0);
    // Every piece should have cubrecanto and veta populated
    for (const p of pieces) {
      expect(p.cubrecanto).toBeDefined();
      expect(p.veta).toBeDefined();
    }
  });

  it('defaults shelfType to adjustable for wall cabinets', () => {
    const pieces = calculateDespiece({
      heightIn: 15,
      widthIn: 30,
      depthIn: 12,
      cabinetType: 'wall',
      bodyThickness: 18,
      shelves: 1,
      hasDoors: false,
      numDoors: 0,
      doorSectionHeightIn: 0,
      hasDrawers: false,
      numDrawers: 0,
      drawerSectionHeightIn: 0,
      // no shelfType specified — should default to adjustable
    });
    const shelf = findPiece(pieces, 'Shelves')!;
    expect(shelf.cubrecanto).toEqual({ sup: 1, inf: 1, izq: 1, der: 1 }); // adjustable
  });
});

// ── Drawer box thickness ────────────────────────────────────────────────────
describe('calculateDespiece — drawer box thickness', () => {
  const base: DespieceInput = {
    heightIn: 30,
    widthIn: 24,
    depthIn: 24,
    cabinetType: 'base',
    bodyThickness: 18,
    shelves: 0,
    hasDoors: false,
    numDoors: 0,
    doorSectionHeightIn: 0,
    hasDrawers: true,
    numDrawers: 3,
    drawerSectionHeightIn: 0,
    optimizeDepth: true,
  };

  it('defaults to 15mm drawer box thickness when not specified', () => {
    const pieces = calculateDespiece(base);
    const ends = findPiece(pieces, 'Drawer Box Ends')!;
    // W=24"→610mm, D=24"→600mm(optimized), esp=18
    // innerW = 610 - 36 = 574, boxOuterW = 574 - 26 = 548
    // With drawerEsp=15: 548 - 30 = 518
    expect(ends.ancho).toBe(518);
  });

  it('uses custom drawerBoxThickness when provided', () => {
    const pieces = calculateDespiece({ ...base, drawerBoxThickness: 12 });
    const ends = findPiece(pieces, 'Drawer Box Ends')!;
    // With drawerEsp=12: 548 - 24 = 524
    expect(ends.ancho).toBe(524);
  });

  it('does NOT affect body pieces (sides, top, bottom still use bodyThickness)', () => {
    const pieces = calculateDespiece({ ...base, drawerBoxThickness: 12 });
    const topPanel = findPiece(pieces, 'Top Panel')!;
    // Top panel alto = D - esp = 600 - 18 = 582 (uses bodyThickness, not drawerBoxThickness)
    expect(topPanel.alto).toBe(582);
  });
});
