import type { CutPiece } from '../types';
import { calculateDespiece, type DespieceInput } from './despieceCalculator';

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

// ── Internal helpers ─────────────────────────────────────────────────────────

interface ParsedDims {
  widthIn: number;
  heightIn: number;
  depthIn: number;
}

/** Parse WxHxD dimensions from a SKU string. */
function parseDimsFromSku(sku: string): ParsedDims | null {
  const m = sku.match(/(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)/);
  if (!m) return null;
  return { widthIn: Number(m[1]), heightIn: Number(m[2]), depthIn: Number(m[3]) };
}

/** Parse WxH dimensions from a 460-series SKU (2D accessories). */
function parse2dFromSku(sku: string): { widthIn: number; heightIn: number } | null {
  const m = sku.match(/(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)/);
  if (!m) return null;
  return { widthIn: Number(m[1]), heightIn: Number(m[2]) };
}

/** Fallback: parse dimensions from description like '18"W x 36"H x 16"D'. */
function parseDimsFromDescription(desc: string): ParsedDims | null {
  const m = desc.match(
    /(\d+(?:\.\d+)?)"?\s*W\s*x\s*(\d+(?:\.\d+)?)"?\s*H\s*x\s*(\d+(?:\.\d+)?)"?\s*D/i
  );
  if (!m) return null;
  return { widthIn: Number(m[1]), heightIn: Number(m[2]), depthIn: Number(m[3]) };
}

/** Extract series prefix from SKU. */
function getSeriesPrefix(sku: string): string {
  const m = sku.match(/^([A-Za-z]+|\d{3})/);
  return m ? m[1] : '';
}

/** Determine cabinet type from series prefix. */
function cabinetTypeFromPrefix(prefix: string, description: string): 'base' | 'wall' | 'tall' | null {
  // Numeric series
  const num = parseInt(prefix, 10);
  if (!isNaN(num)) {
    if (num >= 100 && num <= 299) return 'base';
    if (num >= 300 && num <= 399) return 'wall';
    if (num >= 400 && num <= 459) return 'tall';
    if (num >= 460 && num <= 499) return null; // accessories — handled separately
    return null;
  }

  // Alpha prefixes
  const upper = prefix.toUpperCase();
  if (['CAS', 'H'].includes(upper)) return 'tall';
  if (['B', 'DB', 'DBO', 'GDB', 'GDD', 'KSC', 'KCS', 'P'].includes(upper)) return 'base';
  if (['GW', 'W'].includes(upper)) return 'wall';

  // Infer from description for S, T, and unknown prefixes
  if (/\bwall\b/i.test(description)) return 'wall';
  if (/\btall\b/i.test(description)) return 'tall';
  if (/\bbase\b/i.test(description)) return 'base';

  return null;
}

interface DoorDrawerConfig {
  hasDoors: boolean;
  numDoors: number;
  hasDrawers: boolean;
  numDrawers: number;
  isSink: boolean;
  isOpenBox: boolean;
}

/** Parse door/drawer counts from product description. */
function parseDoorDrawerConfig(
  sku: string,
  description: string,
  hasDrawersDb: boolean | null,
): DoorDrawerConfig {
  const doorMatch = description.match(/(\d+)\s*doors?/i);
  const drawerMatch = description.match(/(\d+)\s*drawers?/i);
  const isSink = /sink/i.test(description);
  const isOpenBox = /open\s*box/i.test(description);

  let numDoors = doorMatch ? Number(doorMatch[1]) : 0;
  let numDrawers = drawerMatch ? Number(drawerMatch[1]) : 0;

  // Fallback: "Door Garage Base" without a numeric prefix → 1 door
  if (numDoors === 0 && /\bdoor\b/i.test(description) && !isOpenBox) {
    numDoors = 1;
  }
  if (numDrawers === 0 && /\bdrawer\b/i.test(description)) {
    numDrawers = 1;
  }

  // DB/DBO/GDB/GDD series: -N suffix = drawer count
  const skuDrawerSuffix = /^(DB|DBO|GDB|GDD)/i.test(sku) ? sku.match(/-(\d+)$/) : null;
  if (skuDrawerSuffix && numDrawers <= 1) {
    numDrawers = Number(skuDrawerSuffix[1]);
  }

  // has_drawers from DB takes priority
  if (hasDrawersDb === true && numDrawers === 0) {
    numDrawers = 1;
  }
  if (hasDrawersDb === false) {
    numDrawers = 0;
  }

  const hasDoors = !isOpenBox && numDoors > 0;
  const hasDrawers = numDrawers > 0;

  return { hasDoors, numDoors, hasDrawers, numDrawers, isSink, isOpenBox };
}

/** Parse shelf count from description or SKU, or use heuristic. */
function getShelfCount(
  sku: string,
  description: string,
  cabinetType: 'base' | 'wall' | 'tall',
  heightIn: number,
  isSink: boolean,
): { count: number; type: 'fixed' | 'adjustable' } {
  if (isSink) return { count: 0, type: 'fixed' };

  // From description: "5 Shelves"
  const shelfMatch = description.match(/(\d+)\s*shelv(?:es|e)/i);
  if (shelfMatch) {
    return {
      count: Number(shelfMatch[1]),
      type: cabinetType === 'base' ? 'fixed' : 'adjustable',
    };
  }

  // CAS series: -N suffix = shelf count
  const skuShelfSuffix = /^CAS/i.test(sku) ? sku.match(/-(\d+)$/) : null;
  if (skuShelfSuffix) {
    return { count: Number(skuShelfSuffix[1]), type: 'adjustable' };
  }

  // Heuristic based on cabinet type and height
  switch (cabinetType) {
    case 'base':
      return { count: heightIn <= 36 ? 1 : 2, type: 'fixed' };
    case 'wall':
      return { count: heightIn <= 18 ? 1 : 2, type: 'adjustable' };
    case 'tall':
      return { count: Math.min(Math.floor(heightIn / 18), 6), type: 'adjustable' };
  }
}

/** Check if a product already has cut_pieces populated. */
function hasExistingCutPieces(cutPieces: unknown): boolean {
  return Array.isArray(cutPieces) && cutPieces.length > 0;
}

/** Generate a single flat panel CutPiece for 460-series accessories. */
function generate460Panel(widthIn: number, heightIn: number): CutPiece[] {
  return [{
    id: crypto.randomUUID(),
    nombre: 'Panel',
    ancho: Math.round(widthIn * 25.4),
    alto: Math.round(heightIn * 25.4),
    cantidad: 1,
    material: 'custom',
    cubrecanto: { sup: 1, inf: 1, izq: 1, der: 1 },
    veta: 'vertical',
  }];
}

// ── Main export ──────────────────────────────────────────────────────────────

export function generateBulkDespieces(products: BulkProduct[]): BulkOutput {
  const results: BulkResult[] = [];
  const skipped: Array<{ sku: string; reason: string }> = [];

  for (const product of products) {
    const { sku, description } = product;

    // Skip products that already have cut_pieces
    if (hasExistingCutPieces(product.cut_pieces)) {
      skipped.push({ sku, reason: 'Already has cut_pieces' });
      continue;
    }

    // Skip floating shelves
    if (/floating\s*shelf/i.test(description)) {
      skipped.push({ sku, reason: 'Floating shelf — no box construction' });
      continue;
    }

    const prefix = getSeriesPrefix(sku);
    const numPrefix = parseInt(prefix, 10);
    const is460 = !isNaN(numPrefix) && numPrefix >= 460 && numPrefix <= 499;

    // ── 460 series: single flat panel ──────────────────────────────────────
    if (is460) {
      const dims2d = parse2dFromSku(sku);
      if (!dims2d) {
        skipped.push({ sku, reason: 'Cannot parse dimensions from 460-series SKU' });
        continue;
      }
      results.push({
        id: product.id,
        sku,
        cut_pieces: generate460Panel(dims2d.widthIn, dims2d.heightIn),
        parsed_width: dims2d.widthIn,
        parsed_height: dims2d.heightIn,
        parsed_depth: 0,
        cabinet_type: 'base', // placeholder for 460
        warnings: ['460-series accessory — single flat panel, not a cabinet'],
      });
      continue;
    }

    // ── Parse dimensions ───────────────────────────────────────────────────
    const dims = parseDimsFromSku(sku) ?? parseDimsFromDescription(description);
    if (!dims) {
      skipped.push({ sku, reason: 'Cannot parse dimensions from SKU or description' });
      continue;
    }

    // ── Determine cabinet type ─────────────────────────────────────────────
    const cabinetType = cabinetTypeFromPrefix(prefix, description);
    if (!cabinetType) {
      skipped.push({ sku, reason: `Unknown cabinet type for series prefix "${prefix}"` });
      continue;
    }

    // ── Parse door/drawer configuration ────────────────────────────────────
    const config = parseDoorDrawerConfig(sku, description, product.has_drawers);
    const warnings: string[] = [];

    // ── Parse shelf configuration ──────────────────────────────────────────
    const shelf = getShelfCount(sku, description, cabinetType, dims.heightIn, config.isSink);

    // ── Build DespieceInput ────────────────────────────────────────────────
    const input: DespieceInput = {
      heightIn: dims.heightIn,
      widthIn: dims.widthIn,
      depthIn: dims.depthIn,
      cabinetType,
      bodyThickness: 18,
      shelves: shelf.count,
      hasDoors: config.hasDoors,
      numDoors: config.numDoors,
      doorSectionHeightIn: 0, // full height
      hasDrawers: config.hasDrawers,
      numDrawers: config.numDrawers,
      drawerSectionHeightIn: 0, // full height
      shelfType: shelf.type,
      optimizeDepth: true,
      isSink: config.isSink,
    };

    const cutPieces = calculateDespiece(input);

    results.push({
      id: product.id,
      sku,
      cut_pieces: cutPieces,
      parsed_width: dims.widthIn,
      parsed_height: dims.heightIn,
      parsed_depth: dims.depthIn,
      cabinet_type: cabinetType,
      warnings,
    });
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
