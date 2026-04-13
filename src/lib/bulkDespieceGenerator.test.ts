import { describe, it, expect } from 'vitest';
import { generateBulkDespieces, type BulkProduct } from './bulkDespieceGenerator';

function makeBulkProduct(overrides: Partial<BulkProduct> & { sku: string; description: string }): BulkProduct {
  return {
    id: crypto.randomUUID(),
    height_in: null,
    width_in: null,
    depth_in: null,
    has_drawers: null,
    cut_pieces: null,
    ...overrides,
  };
}

// ── SKU Parsing & Generation ────────────────────────────────────────────────
describe('generateBulkDespieces — SKU parsing', () => {
  it('parses 101-12x30x24 → base, W=12, H=30, D=24', () => {
    const product = makeBulkProduct({ sku: '101-12x30x24', description: 'Base Cabinet | 1 Door' });
    const { results, skipped } = generateBulkDespieces([product]);
    expect(skipped).toHaveLength(0);
    expect(results).toHaveLength(1);
    expect(results[0].parsed_width).toBe(12);
    expect(results[0].parsed_height).toBe(30);
    expect(results[0].parsed_depth).toBe(24);
    expect(results[0].cabinet_type).toBe('base');
    expect(results[0].cut_pieces.length).toBeGreaterThan(0);
  });

  it('parses 302-30x15x12 → wall, W=30, H=15, D=12', () => {
    const product = makeBulkProduct({ sku: '302-30x15x12', description: 'Wall Hung Cabinet | 2 Door' });
    const { results } = generateBulkDespieces([product]);
    expect(results).toHaveLength(1);
    expect(results[0].parsed_width).toBe(30);
    expect(results[0].parsed_height).toBe(15);
    expect(results[0].parsed_depth).toBe(12);
    expect(results[0].cabinet_type).toBe('wall');
  });

  it('parses CAS-18x71.5x12-5 → tall, 5 shelves from suffix', () => {
    const product = makeBulkProduct({ sku: 'CAS-18x71.5x12-5', description: 'Closet Adjustable Shelves | 5 Shelves' });
    const { results } = generateBulkDespieces([product]);
    expect(results).toHaveLength(1);
    expect(results[0].parsed_width).toBe(18);
    expect(results[0].parsed_height).toBe(71.5);
    expect(results[0].parsed_depth).toBe(12);
    expect(results[0].cabinet_type).toBe('tall');
    // Should have 5 shelves
    const shelves = results[0].cut_pieces.find(p => p.nombre === 'Shelves');
    expect(shelves).toBeDefined();
    expect(shelves!.cantidad).toBe(5);
  });
});

// ── 460 Series: Single Flat Panel ───────────────────────────────────────────
describe('generateBulkDespieces — 460 series', () => {
  it('generates single flat panel for 460-96x44', () => {
    const product = makeBulkProduct({ sku: '460-96x44', description: 'End Panel' });
    const { results, skipped } = generateBulkDespieces([product]);
    expect(skipped).toHaveLength(0);
    expect(results).toHaveLength(1);
    expect(results[0].cut_pieces).toHaveLength(1);

    const panel = results[0].cut_pieces[0];
    expect(panel.nombre).toBe('Panel');
    expect(panel.ancho).toBe(Math.round(96 * 25.4)); // 2438
    expect(panel.alto).toBe(Math.round(44 * 25.4));  // 1118
    expect(panel.cantidad).toBe(1);
    expect(panel.material).toBe('custom');
    expect(panel.cubrecanto).toEqual({ sup: 1, inf: 1, izq: 1, der: 1 });
    expect(panel.veta).toBe('vertical');
  });
});

// ── Skip Rules ──────────────────────────────────────────────────────────────
describe('generateBulkDespieces — skip rules', () => {
  it('skips floating shelves', () => {
    const product = makeBulkProduct({ sku: '190-48x2x12', description: 'Floating Shelf' });
    const { results, skipped } = generateBulkDespieces([product]);
    expect(results).toHaveLength(0);
    expect(skipped).toHaveLength(1);
    expect(skipped[0].reason).toMatch(/floating/i);
  });

  it('skips products with existing cut_pieces', () => {
    const product = makeBulkProduct({
      sku: '101-12x30x24',
      description: 'Base Cabinet | 1 Door',
      cut_pieces: [{ id: '1', nombre: 'existing', ancho: 100, alto: 200, cantidad: 1, material: 'cuerpo' }],
    });
    const { results, skipped } = generateBulkDespieces([product]);
    expect(results).toHaveLength(0);
    expect(skipped).toHaveLength(1);
    expect(skipped[0].reason).toMatch(/already/i);
  });

  it('skips products with unparseable SKUs and no description dimensions', () => {
    const product = makeBulkProduct({ sku: 'MISC-ITEM', description: 'Random accessory' });
    const { results, skipped } = generateBulkDespieces([product]);
    expect(results).toHaveLength(0);
    expect(skipped).toHaveLength(1);
    expect(skipped[0].reason).toMatch(/cannot parse/i);
  });

  it('does not skip products with null cut_pieces', () => {
    const product = makeBulkProduct({
      sku: '101-12x30x24',
      description: 'Base Cabinet | 1 Door',
      cut_pieces: null,
    });
    const { results } = generateBulkDespieces([product]);
    expect(results).toHaveLength(1);
  });

  it('does not skip products with empty cut_pieces array', () => {
    const product = makeBulkProduct({
      sku: '101-12x30x24',
      description: 'Base Cabinet | 1 Door',
      cut_pieces: [],
    });
    const { results } = generateBulkDespieces([product]);
    expect(results).toHaveLength(1);
  });
});

// ── Description Fallback ────────────────────────────────────────────────────
describe('generateBulkDespieces — description fallback', () => {
  it('parses dimensions from description when SKU lacks WxHxD', () => {
    const product = makeBulkProduct({
      sku: 'GDB-CUSTOM',
      description: 'Garage Door Base 18"W x 36"H x 16"D',
    });
    const { results, skipped } = generateBulkDespieces([product]);
    expect(skipped).toHaveLength(0);
    expect(results).toHaveLength(1);
    expect(results[0].parsed_width).toBe(18);
    expect(results[0].parsed_height).toBe(36);
    expect(results[0].parsed_depth).toBe(16);
    expect(results[0].cabinet_type).toBe('base');
  });
});

// ── Door/Drawer Parsing ─────────────────────────────────────────────────────
describe('generateBulkDespieces — door/drawer from description', () => {
  it('parses "Base Cabinet | 3 Drawers" → 3 drawers, no doors', () => {
    const product = makeBulkProduct({
      sku: '201-24x30x24',
      description: 'Base Cabinet | 3 Drawers',
    });
    const { results } = generateBulkDespieces([product]);
    expect(results).toHaveLength(1);
    const drawerFaces = results[0].cut_pieces.find(p => p.nombre === 'Drawer Faces');
    expect(drawerFaces).toBeDefined();
    expect(drawerFaces!.cantidad).toBe(3);
    const doors = results[0].cut_pieces.find(p => p.nombre === 'Doors');
    expect(doors).toBeUndefined();
  });

  it('parses "Base Cabinet | 1 Drawers - 1 Door" → 1 door + 1 drawer', () => {
    const product = makeBulkProduct({
      sku: '101-24x30x24',
      description: 'Base Cabinet | 1 Drawers - 1 Door',
    });
    const { results } = generateBulkDespieces([product]);
    const doors = results[0].cut_pieces.find(p => p.nombre === 'Doors');
    const drawerFaces = results[0].cut_pieces.find(p => p.nombre === 'Drawer Faces');
    expect(doors).toBeDefined();
    expect(doors!.cantidad).toBe(1);
    expect(drawerFaces).toBeDefined();
    expect(drawerFaces!.cantidad).toBe(1);
  });

  it('respects has_drawers=false from DB even if description mentions drawers', () => {
    const product = makeBulkProduct({
      sku: '101-24x30x24',
      description: 'Base Cabinet | 1 Drawer - 1 Door',
      has_drawers: false,
    });
    const { results } = generateBulkDespieces([product]);
    const drawerFaces = results[0].cut_pieces.find(p => p.nombre === 'Drawer Faces');
    expect(drawerFaces).toBeUndefined();
  });
});

// ── Sink Base Detection ─────────────────────────────────────────────────────
describe('generateBulkDespieces — sink base', () => {
  it('detects sink from description and generates stretchers', () => {
    const product = makeBulkProduct({
      sku: '152-36x30x24',
      description: 'Sink Base Cabinet | 2 Doors',
    });
    const { results } = generateBulkDespieces([product]);
    expect(results).toHaveLength(1);
    const topPanel = results[0].cut_pieces.find(p => p.nombre === 'Top Panel');
    expect(topPanel).toBeUndefined();
    const stretchers = results[0].cut_pieces.find(p => p.nombre === 'Stretchers');
    expect(stretchers).toBeDefined();
    expect(stretchers!.cantidad).toBe(2);
  });
});

// ── Stats Accuracy ──────────────────────────────────────────────────────────
describe('generateBulkDespieces — stats', () => {
  it('reports accurate total/generated/skipped counts', () => {
    const products = [
      makeBulkProduct({ sku: '101-12x30x24', description: 'Base Cabinet | 1 Door' }),
      makeBulkProduct({ sku: '302-30x15x12', description: 'Wall Hung Cabinet | 2 Door' }),
      makeBulkProduct({ sku: '190-48x2x12', description: 'Floating Shelf' }),
      makeBulkProduct({
        sku: '101-24x30x24',
        description: 'Base Cabinet | 1 Door',
        cut_pieces: [{ id: '1', nombre: 'x', ancho: 1, alto: 1, cantidad: 1, material: 'cuerpo' }],
      }),
      makeBulkProduct({ sku: 'MISC-ITEM', description: 'Random' }),
    ];

    const { stats } = generateBulkDespieces(products);
    expect(stats.total).toBe(5);
    expect(stats.generated).toBe(2);
    expect(stats.skipped).toBe(3);
  });
});
