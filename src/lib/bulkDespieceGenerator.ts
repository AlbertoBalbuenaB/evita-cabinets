/**
 * Batch adapter from raw `products_catalog` rows to cut-list results. This
 * file used to own the SKU/description parsing heuristics and call the old
 * `calculateDespiece` engine directly; the refactor moved those heuristics
 * into `./cabinet/parseProductMetadata` and replaced the engine with
 * `computeCutList(CabinetConfig)`.
 *
 * Public types (`BulkProduct`, `BulkResult`, `BulkOutput`) and the function
 * signature (`generateBulkDespieces`) are preserved so the existing test
 * suite and any future UI wiring can consume this module unchanged.
 */

import type { CutPiece } from '../types';
import {
  cabinetConfigFromCatalogProduct,
  computeCutList,
} from './cabinet';
import {
  generate460Panel,
  parse2dFromSku,
} from './cabinet/parseProductMetadata';

// ── Public types ─────────────────────────────────────────────────────────────

export interface BulkProduct {
  id: string;
  sku: string;
  description: string;
  height_in: number | null;
  width_in: number | null;
  depth_in: number | null;
  has_drawers: boolean | null;
  cut_pieces: unknown;  // raw JSONB from DB
}

export interface BulkResult {
  id: string;
  sku: string;
  cut_pieces: CutPiece[];
  parsed_width: number;
  parsed_height: number;
  parsed_depth: number;
  cabinet_type: 'base' | 'wall' | 'tall';
  warnings: string[];
}

export interface BulkOutput {
  results: BulkResult[];
  skipped: Array<{ sku: string; reason: string }>;
  stats: { total: number; generated: number; skipped: number };
}

// ── Main export ──────────────────────────────────────────────────────────────

export function generateBulkDespieces(products: BulkProduct[]): BulkOutput {
  const results: BulkResult[] = [];
  const skipped: Array<{ sku: string; reason: string }> = [];

  for (const product of products) {
    const adapted = cabinetConfigFromCatalogProduct(product);

    if (adapted.ok) {
      const cutPieces = computeCutList(adapted.config);
      // `family` on a catalog-derived config is always one of base/wall/tall
      // because `cabinetTypeFromPrefix` returns exactly that union. The cast
      // below reflects that invariant.
      const cabinetType = adapted.config.family as 'base' | 'wall' | 'tall';
      results.push({
        id: product.id,
        sku: product.sku,
        cut_pieces: cutPieces,
        parsed_width: adapted.parsedDims.widthIn,
        parsed_height: adapted.parsedDims.heightIn,
        parsed_depth: adapted.parsedDims.depthIn,
        cabinet_type: cabinetType,
        warnings: adapted.config.warnings ?? [],
      });
      continue;
    }

    // ── 460-series: flat panel fallback ─────────────────────────────────
    if (adapted.reason === 'accessory-460-series') {
      const dims2d = parse2dFromSku(product.sku);
      if (!dims2d) {
        skipped.push({
          sku: product.sku,
          reason: 'Cannot parse dimensions from 460-series SKU',
        });
        continue;
      }
      results.push({
        id: product.id,
        sku: product.sku,
        cut_pieces: generate460Panel(dims2d.widthIn, dims2d.heightIn),
        parsed_width: dims2d.widthIn,
        parsed_height: dims2d.heightIn,
        parsed_depth: 0,
        cabinet_type: 'base', // placeholder for 460
        warnings: ['460-series accessory — single flat panel, not a cabinet'],
      });
      continue;
    }

    // ── All other skip reasons: forward the adapter's message ───────────
    skipped.push({ sku: product.sku, reason: adapted.message });
  }

  return {
    results,
    skipped,
    stats: {
      total: products.length,
      generated: results.length,
      skipped: skipped.length,
    },
  };
}
