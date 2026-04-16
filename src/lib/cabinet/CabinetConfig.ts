/**
 * Canonical cabinet configuration consumed by the pure despiece engine
 * (`computeCutList`). This type is agnostic to the origin of its data — today
 * it is produced by `cabinetConfigFromCatalogProduct` from `products_catalog`
 * rows, and in a later phase it will also be produced from Draft Tool
 * parametric custom cabinets.
 *
 * All geometry is in millimeters (canonical unit). Adapters are responsible
 * for any unit conversion at the boundary.
 */

/**
 * Full set of cabinet families the domain eventually cares about. Only the
 * three "engine families" (`base`, `wall`, `tall`) are currently wired through
 * the cut-list math; the rest narrow to one of those via `toEngineFamily` so
 * Phase 2 code can already type-check against the canonical enum.
 */
export type CabinetFamily =
  | 'base'
  | 'wall'
  | 'tall'
  | 'vanity'
  | 'oven'
  | 'corner_base'
  | 'corner_wall'
  | 'closet';

/** Family values actually supported by the engine today. */
export type EngineFamily = 'base' | 'wall' | 'tall';

/**
 * Edgeband code used across cut pieces:
 *   0 = none
 *   1 = Type A (Box Construction EB)
 *   2 = Type B (Doors & Fronts EB)
 *   3 = Type C (reserved / overflow)
 */
export type EdgebandType = 0 | 1 | 2 | 3;

export interface CabinetConfig {
  // ── Identity ──────────────────────────────────────────────────────────────
  productId?: string | null;
  sku?: string | null;
  label?: string;

  // ── Dimensions (mm) ───────────────────────────────────────────────────────
  widthMm: number;
  heightMm: number;
  depthMm: number;

  // ── Family ────────────────────────────────────────────────────────────────
  family: CabinetFamily;

  // ── Doors ─────────────────────────────────────────────────────────────────
  hasDoors: boolean;
  doorCount: number;
  doorHinge?: 'left' | 'right' | 'double' | 'none';
  /** 0 or undefined → full cabinet height. */
  doorSectionHeightMm?: number;

  // ── Drawers ───────────────────────────────────────────────────────────────
  hasDrawers: boolean;
  drawerCount: number;
  /** 0 or undefined → full cabinet height. */
  drawerSectionHeightMm?: number;
  /** Reserved for future per-drawer height control; unused by engine today. */
  drawerHeightsMm?: number[];

  // ── Shelves ───────────────────────────────────────────────────────────────
  shelfCount: number;
  shelfType?: 'fixed' | 'adjustable';
  /** Additional shelves beyond the product template default. */
  extraShelves?: number;

  // ── Structural flags ──────────────────────────────────────────────────────
  isSink?: boolean;
  isOpenBox?: boolean;
  /** Snap mm depth to standard sheet fractions of 1220mm. Default: true. */
  optimizeDepth?: boolean;

  // ── Thicknesses (mm) ──────────────────────────────────────────────────────
  /** Default: 18. */
  boxThicknessMm?: number;
  /** Default: same as `boxThicknessMm`. */
  backThicknessMm?: number;
  /** Default: 15. Drawer face uses door material, NOT this thickness. */
  drawerBoxThicknessMm?: number;

  // ── Material UUIDs (optional) ─────────────────────────────────────────────
  // Carried through for future callers that want to record material bindings
  // at engine time. The engine itself still emits pieces tagged by role
  // ('cuerpo' | 'frente' | 'back' | 'custom') — material UUID resolution
  // happens downstream at the `area_cabinets` level.
  boxMaterialId?: string | null;
  doorMaterialId?: string | null;
  backMaterialId?: string | null;
  boxEdgebandId?: string | null;
  doorEdgebandId?: string | null;

  /** Adapter-emitted warnings (e.g. "shelf count inferred from height"). */
  warnings?: string[];
}

/**
 * Narrow a `CabinetFamily` to one of the three values the engine actually
 * handles today. Non-engine families are mapped to the closest structural
 * equivalent so Phase 2 code can compile without the engine needing feature
 * changes yet.
 *
 * TODO(phase2): extend the engine to natively handle vanity/oven/corner/closet
 * structural variants.
 */
export function toEngineFamily(family: CabinetFamily): EngineFamily {
  switch (family) {
    case 'base':
    case 'vanity':
    case 'corner_base':
      return 'base';
    case 'wall':
    case 'corner_wall':
      return 'wall';
    case 'tall':
    case 'oven':
    case 'closet':
      return 'tall';
  }
}
