/**
 * Golden fixture rows used by `computeCutList.snapshot.test.ts` and the
 * temporary parity test. Each fixture is a minimal `CatalogProductInput`
 * shape (the subset of `products_catalog` the adapter reads). These were
 * chosen to exercise every major branch of the engine:
 *
 *  1. Base 1-door narrow           — 101-12x30x24
 *  2. Base 2-door wide              — 102-36x30x24
 *  3. Sink base 2-door              — 152-36x30x24
 *  4. Drawer base 3 drawers         — 201-24x30x24 "3 Drawers"
 *  5. Drawer base DB-3 suffix       — DB-18x30x24-3
 *  6. Wall 1-door short             — 301-18x18x12
 *  7. Wall 2-door tall              — 302-36x30x12
 *  8. Tall pantry 84" (oven column) — 401-18x84x24
 *  9. Closet adjustable shelves     — CAS-18x71.5x12-5
 * 10. 16"-depth wall (bucket edge)  — 303-24x24x16
 *
 * These fixtures are BEHAVIORAL specs, not DB dumps — the adapter only
 * looks at `sku`, `description`, `has_drawers`, `cut_pieces` (null), so
 * that's all the fixtures carry.
 */

import type { CatalogProductInput } from '../fromCatalogProduct';

export interface NamedFixture {
  label: string;
  row: CatalogProductInput;
}

export const GOLDEN_FIXTURES: NamedFixture[] = [
  {
    label: 'base-1door-12x30x24',
    row: {
      id: 'fixture-01',
      sku: '101-12x30x24',
      description: 'Base Cabinet | 1 Door',
      has_drawers: false,
      cut_pieces: null,
    },
  },
  {
    label: 'base-2door-36x30x24',
    row: {
      id: 'fixture-02',
      sku: '102-36x30x24',
      description: 'Base Cabinet | 2 Doors',
      has_drawers: false,
      cut_pieces: null,
    },
  },
  {
    label: 'sink-base-2door-36x30x24',
    row: {
      id: 'fixture-03',
      sku: '152-36x30x24',
      description: 'Sink Base Cabinet | 2 Doors',
      has_drawers: false,
      cut_pieces: null,
    },
  },
  {
    label: 'drawer-base-3drawers-24x30x24',
    row: {
      id: 'fixture-04',
      sku: '201-24x30x24',
      description: 'Base Cabinet | 3 Drawers',
      has_drawers: true,
      cut_pieces: null,
    },
  },
  {
    label: 'drawer-base-DB3-suffix-18x30x24',
    row: {
      id: 'fixture-05',
      sku: 'DB-18x30x24-3',
      description: 'Drawer Base',
      has_drawers: true,
      cut_pieces: null,
    },
  },
  {
    label: 'wall-1door-18x18x12',
    row: {
      id: 'fixture-06',
      sku: '301-18x18x12',
      description: 'Wall Hung Cabinet | 1 Door',
      has_drawers: false,
      cut_pieces: null,
    },
  },
  {
    label: 'wall-2door-36x30x12',
    row: {
      id: 'fixture-07',
      sku: '302-36x30x12',
      description: 'Wall Hung Cabinet | 2 Doors',
      has_drawers: false,
      cut_pieces: null,
    },
  },
  {
    label: 'tall-pantry-18x84x24',
    row: {
      id: 'fixture-08',
      sku: '401-18x84x24',
      description: 'Tall Pantry | 2 Doors',
      has_drawers: false,
      cut_pieces: null,
    },
  },
  {
    label: 'closet-CAS-18x71.5x12-5',
    row: {
      id: 'fixture-09',
      sku: 'CAS-18x71.5x12-5',
      description: 'Closet Adjustable Shelves | 5 Shelves',
      has_drawers: false,
      cut_pieces: null,
    },
  },
  {
    label: 'wall-24x24x16-depth-bucket',
    row: {
      id: 'fixture-10',
      sku: '303-24x24x16',
      description: 'Wall Hung Cabinet | 2 Doors',
      has_drawers: false,
      cut_pieces: null,
    },
  },
];

/**
 * Strip the non-deterministic `id` field from a list of cut pieces so they
 * can be stable-compared (for snapshots) or deep-equal compared (for parity
 * tests against the legacy engine).
 */
export function stripIds<T extends { id: string }>(pieces: T[]): Omit<T, 'id'>[] {
  return pieces.map(({ id: _id, ...rest }) => rest);
}
