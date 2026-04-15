import { describe, it, expect } from 'vitest';
import {
  cabinetConfigFromCatalogProduct,
  type CatalogProductInput,
} from './fromCatalogProduct';

function row(overrides: Partial<CatalogProductInput> = {}): CatalogProductInput {
  return {
    id: 'test-id',
    sku: '',
    description: '',
    has_drawers: null,
    cut_pieces: null,
    ...overrides,
  };
}

describe('cabinetConfigFromCatalogProduct', () => {
  describe('skip conditions', () => {
    it('skips rows that already have cut_pieces', () => {
      const result = cabinetConfigFromCatalogProduct(row({
        sku: '101-18x30x12',
        description: 'Base Cabinet | 1 Door',
        cut_pieces: [{ id: 'x', nombre: 'side', ancho: 1, alto: 1 }],
      }));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe('already-has-cut-pieces');
    });

    it('skips floating shelves', () => {
      const result = cabinetConfigFromCatalogProduct(row({
        sku: 'FS-24x2x10',
        description: 'Floating Shelf 24"W',
      }));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe('floating-shelf');
    });

    it('returns accessory-460-series for 460-499 series', () => {
      const result = cabinetConfigFromCatalogProduct(row({
        sku: '465-24x36',
        description: 'Back Panel',
      }));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe('accessory-460-series');
    });

    it('fails when dimensions cannot be parsed', () => {
      const result = cabinetConfigFromCatalogProduct(row({
        sku: 'WEIRD',
        description: 'Mysterious product',
      }));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe('cannot-parse-dimensions');
    });

    it('fails on unknown cabinet type prefix', () => {
      const result = cabinetConfigFromCatalogProduct(row({
        sku: 'ZZZ-18x30x12',
        description: 'Something',
      }));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe('unknown-cabinet-type');
    });
  });

  describe('dimension parsing', () => {
    it('parses from SKU (WxHxD inches)', () => {
      const result = cabinetConfigFromCatalogProduct(row({
        sku: '101-18x30x12',
        description: 'Base Cabinet | 1 Door',
      }));
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.parsedDims).toEqual({ widthIn: 18, heightIn: 30, depthIn: 12 });
        expect(result.config.widthMm).toBe(Math.round(18 * 25.4));
        expect(result.config.heightMm).toBe(Math.round(30 * 25.4));
        expect(result.config.depthMm).toBe(Math.round(12 * 25.4));
      }
    });

    it('falls back to description parsing when SKU has no dims', () => {
      const result = cabinetConfigFromCatalogProduct(row({
        sku: '101-AB',
        description: 'Base Cabinet | 1 Door | 18"W x 30"H x 12"D',
      }));
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.parsedDims).toEqual({ widthIn: 18, heightIn: 30, depthIn: 12 });
      }
    });
  });

  describe('family inference', () => {
    it('maps numeric 100-series to base', () => {
      const result = cabinetConfigFromCatalogProduct(row({
        sku: '101-18x30x12', description: 'Base | 1 Door',
      }));
      expect(result.ok && result.config.family).toBe('base');
    });

    it('maps numeric 300-series to wall', () => {
      const result = cabinetConfigFromCatalogProduct(row({
        sku: '301-18x30x12', description: 'Wall | 1 Door',
      }));
      expect(result.ok && result.config.family).toBe('wall');
    });

    it('maps numeric 400-series to tall', () => {
      const result = cabinetConfigFromCatalogProduct(row({
        sku: '401-18x84x24', description: 'Tall Pantry | 2 Doors',
      }));
      expect(result.ok && result.config.family).toBe('tall');
    });

    it('maps CAS alpha prefix to tall', () => {
      const result = cabinetConfigFromCatalogProduct(row({
        sku: 'CAS-18x84x16', description: 'Adjustable Shelf Closet',
      }));
      expect(result.ok && result.config.family).toBe('tall');
    });
  });

  describe('door / drawer config', () => {
    it('detects 2 doors from description', () => {
      const result = cabinetConfigFromCatalogProduct(row({
        sku: '102-36x30x12', description: 'Base Cabinet | 2 Doors',
      }));
      expect(result.ok && result.config.hasDoors).toBe(true);
      expect(result.ok && result.config.doorCount).toBe(2);
    });

    it('detects sink base', () => {
      const result = cabinetConfigFromCatalogProduct(row({
        sku: '103-36x30x24', description: 'Sink Base | 2 Doors',
      }));
      expect(result.ok && result.config.isSink).toBe(true);
    });

    it('detects open box', () => {
      const result = cabinetConfigFromCatalogProduct(row({
        sku: '104-24x30x12', description: 'Open Box Base',
      }));
      expect(result.ok && result.config.isOpenBox).toBe(true);
      expect(result.ok && result.config.hasDoors).toBe(false);
    });

    it('reads drawer count from DB-N SKU suffix', () => {
      const result = cabinetConfigFromCatalogProduct(row({
        sku: 'DB-18x30x24-3', description: 'Drawer Base',
      }));
      expect(result.ok && result.config.hasDrawers).toBe(true);
      expect(result.ok && result.config.drawerCount).toBe(3);
    });
  });

  describe('shelf count heuristic', () => {
    it('base shallow → 1 fixed shelf', () => {
      const result = cabinetConfigFromCatalogProduct(row({
        sku: '101-18x30x12', description: 'Base | 1 Door',
      }));
      expect(result.ok && result.config.shelfCount).toBe(1);
      expect(result.ok && result.config.shelfType).toBe('fixed');
    });

    it('wall short → 1 adjustable shelf', () => {
      const result = cabinetConfigFromCatalogProduct(row({
        sku: '301-18x18x12', description: 'Wall | 1 Door',
      }));
      expect(result.ok && result.config.shelfCount).toBe(1);
      expect(result.ok && result.config.shelfType).toBe('adjustable');
    });

    it('tall 84" → floor(84/18)=4 adjustable shelves', () => {
      const result = cabinetConfigFromCatalogProduct(row({
        sku: '401-18x84x24', description: 'Tall Pantry | 2 Doors',
      }));
      expect(result.ok && result.config.shelfCount).toBe(4);
      expect(result.ok && result.config.shelfType).toBe('adjustable');
    });
  });
});
