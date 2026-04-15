/**
 * Adapter: `products_catalog` row → canonical `CabinetConfig`.
 *
 * This is the ONLY place that knows how to interpret a raw catalog row
 * (parsing SKU / description heuristics, inferring family, etc.). Other
 * sources of `CabinetConfig` (e.g. future Draft Tool custom cabinets) will
 * have their own adapters.
 *
 * Behavior-preserving: returns `{ ok: false, reason }` for the same rows the
 * old `generateBulkDespieces` would skip (floating shelves, unparseable dims,
 * unknown prefix), plus a special `accessory-460-series` reason so the caller
 * can handle the 460-series flat-panel path itself.
 */

import type { CabinetConfig, CabinetFamily } from './CabinetConfig';
import {
  cabinetTypeFromPrefix,
  getSeriesPrefix,
  getShelfCount,
  hasExistingCutPieces,
  parseDimsFromDescription,
  parseDimsFromSku,
  parseDoorDrawerConfig,
  type ParsedDims,
} from './parseProductMetadata';

/**
 * Minimal `products_catalog` row shape required by the adapter. The full row
 * type (`Database['public']['Tables']['products_catalog']['Row']`) is a
 * superset of this.
 */
export interface CatalogProductInput {
  id: string;
  sku: string;
  description: string;
  has_drawers: boolean | null;
  cut_pieces: unknown;
}

export type CatalogAdapterReason =
  | 'already-has-cut-pieces'
  | 'floating-shelf'
  | 'accessory-460-series'
  | 'cannot-parse-dimensions'
  | 'unknown-cabinet-type';

export type CatalogAdapterResult =
  | { ok: true; config: CabinetConfig; parsedDims: ParsedDims }
  | { ok: false; reason: CatalogAdapterReason; message: string };

/**
 * Parse dimensions from a 460-series SKU and return them as a `ParsedDims`
 * with `depthIn = 0`. Callers that receive `{ ok: false, reason: 'accessory-460-series' }`
 * can use this helper to recover the width/height and build a flat panel.
 */
export { parse2dFromSku } from './parseProductMetadata';

export function cabinetConfigFromCatalogProduct(
  product: CatalogProductInput,
): CatalogAdapterResult {
  const { sku, description } = product;

  // ── Already has cut_pieces ──────────────────────────────────────────────
  if (hasExistingCutPieces(product.cut_pieces)) {
    return {
      ok: false,
      reason: 'already-has-cut-pieces',
      message: 'Already has cut_pieces',
    };
  }

  // ── Floating shelves have no box construction ───────────────────────────
  if (/floating\s*shelf/i.test(description)) {
    return {
      ok: false,
      reason: 'floating-shelf',
      message: 'Floating shelf — no box construction',
    };
  }

  // ── 460-series accessories are flat panels, handled by the caller ───────
  const prefix = getSeriesPrefix(sku);
  const numPrefix = parseInt(prefix, 10);
  if (!isNaN(numPrefix) && numPrefix >= 460 && numPrefix <= 499) {
    return {
      ok: false,
      reason: 'accessory-460-series',
      message: '460-series accessory — single flat panel, not a cabinet',
    };
  }

  // ── Parse dimensions from SKU or description ────────────────────────────
  const dims = parseDimsFromSku(sku) ?? parseDimsFromDescription(description);
  if (!dims) {
    return {
      ok: false,
      reason: 'cannot-parse-dimensions',
      message: 'Cannot parse dimensions from SKU or description',
    };
  }

  // ── Determine cabinet type from series prefix ───────────────────────────
  const cabinetType = cabinetTypeFromPrefix(prefix, description);
  if (!cabinetType) {
    return {
      ok: false,
      reason: 'unknown-cabinet-type',
      message: `Unknown cabinet type for series prefix "${prefix}"`,
    };
  }

  // ── Door / drawer / shelf configuration ─────────────────────────────────
  const dd = parseDoorDrawerConfig(sku, description, product.has_drawers);
  const shelf = getShelfCount(sku, description, cabinetType, dims.heightIn, dd.isSink);

  const family: CabinetFamily = cabinetType;

  const config: CabinetConfig = {
    productId: product.id,
    sku,
    widthMm: Math.round(dims.widthIn * 25.4),
    heightMm: Math.round(dims.heightIn * 25.4),
    depthMm: Math.round(dims.depthIn * 25.4),
    family,
    hasDoors: dd.hasDoors,
    doorCount: dd.numDoors,
    hasDrawers: dd.hasDrawers,
    drawerCount: dd.numDrawers,
    shelfCount: shelf.count,
    shelfType: shelf.type,
    isSink: dd.isSink,
    isOpenBox: dd.isOpenBox,
    optimizeDepth: true,
    boxThicknessMm: 18,
    drawerBoxThicknessMm: 15,
    // Section heights: 0 means "full cabinet height", matching the legacy
    // `doorSectionHeightIn: 0` / `drawerSectionHeightIn: 0` contract used by
    // the old bulk generator.
    doorSectionHeightMm: 0,
    drawerSectionHeightMm: 0,
    warnings: [],
  };

  return { ok: true, config, parsedDims: dims };
}
