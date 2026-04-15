/**
 * SKU/description heuristics used to derive cabinet metadata from a raw
 * `products_catalog` row. Extracted from the original `bulkDespieceGenerator`
 * so both interactive and bulk catalog flows share a single source of truth
 * for "how do we infer family, door/drawer counts, shelves, etc. from the
 * catalog row".
 *
 * Function bodies are byte-identical to the originals — only the module
 * location has changed.
 */

import type { CutPiece } from '../../types';

export interface ParsedDims {
  widthIn: number;
  heightIn: number;
  depthIn: number;
}

/** Parse WxHxD dimensions from a SKU string. */
export function parseDimsFromSku(sku: string): ParsedDims | null {
  const m = sku.match(/(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)/);
  if (!m) return null;
  return { widthIn: Number(m[1]), heightIn: Number(m[2]), depthIn: Number(m[3]) };
}

/** Parse WxH dimensions from a 460-series SKU (2D accessories). */
export function parse2dFromSku(sku: string): { widthIn: number; heightIn: number } | null {
  const m = sku.match(/(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)/);
  if (!m) return null;
  return { widthIn: Number(m[1]), heightIn: Number(m[2]) };
}

/** Fallback: parse dimensions from description like '18"W x 36"H x 16"D'. */
export function parseDimsFromDescription(desc: string): ParsedDims | null {
  const m = desc.match(
    /(\d+(?:\.\d+)?)"?\s*W\s*x\s*(\d+(?:\.\d+)?)"?\s*H\s*x\s*(\d+(?:\.\d+)?)"?\s*D/i
  );
  if (!m) return null;
  return { widthIn: Number(m[1]), heightIn: Number(m[2]), depthIn: Number(m[3]) };
}

/** Extract series prefix from SKU. */
export function getSeriesPrefix(sku: string): string {
  const m = sku.match(/^([A-Za-z]+|\d{3})/);
  return m ? m[1] : '';
}

/** Determine cabinet type from series prefix. */
export function cabinetTypeFromPrefix(
  prefix: string,
  description: string,
): 'base' | 'wall' | 'tall' | null {
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

export interface DoorDrawerConfig {
  hasDoors: boolean;
  numDoors: number;
  hasDrawers: boolean;
  numDrawers: number;
  isSink: boolean;
  isOpenBox: boolean;
}

/** Parse door/drawer counts from product description. */
export function parseDoorDrawerConfig(
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
export function getShelfCount(
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
export function hasExistingCutPieces(cutPieces: unknown): boolean {
  return Array.isArray(cutPieces) && cutPieces.length > 0;
}

/** Generate a single flat panel CutPiece for 460-series accessories. */
export function generate460Panel(widthIn: number, heightIn: number): CutPiece[] {
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
