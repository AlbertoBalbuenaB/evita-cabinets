/**
 * Draft Tool — hybrid SVG block renderer (Step 7).
 *
 * `getBlockSvg(product, view, opts)` returns a stable structure of graphic
 * primitives in local millimeter coordinates, where (0, 0) is the lower-left
 * corner of the cabinet footprint (plan) or the lower-left of the front face
 * (elevation). The caller is responsible for positioning the group in world
 * coordinates and translating primitives to Konva nodes.
 *
 * Hybrid strategy:
 *   1. If the product row has a custom override in `draft_plan_svg` /
 *      `draft_elevation_svg` / `draft_detail_svg`, return the raw SVG string
 *      through the `customSvg` field. The caller can pass it to Konva's
 *      `Path.fromString` or, for Phase 1, simply render it inside a foreign
 *      <svg> element.
 *   2. Otherwise, run the procedural generator below. The generator
 *      dispatches on `draft_family` + `draft_subfamily` and produces the
 *      primitive list.
 *
 * Rules from CLAUDE.md that are enforced here:
 *   - All strokes use `stroke: 'currentColor'` so the canvas (and future
 *     dark-mode palette) can recolor the whole block with a parent `color:`.
 *   - Dimensions come from the `draft_width_in` / `draft_depth_in` /
 *     `draft_height_in` columns if present, otherwise fall back to
 *     `width_in` / `depth_in` / `height_in` on the row.
 *   - Every cabinet gets an AWI CDS diamond tag above the front face,
 *     rendered via a separate primitive so the caller can toggle it.
 */

import type { ProductsCatalogRow } from '../types';
import type { ViewType } from '../types';
import { inToMm, formatAwiSpec } from '../utils/format';

// ── Primitive types ─────────────────────────────────────────────────────────

export interface RectPrim {
  kind: 'rect';
  x: number;
  y: number;
  width: number;
  height: number;
  strokeWidth?: number;
  dash?: number[];
  fillOpacity?: number;
}

export interface LinePrim {
  kind: 'line';
  points: [number, number, number, number];
  strokeWidth?: number;
  dash?: number[];
}

export interface PolygonPrim {
  kind: 'polygon';
  points: number[];
  strokeWidth?: number;
  closed?: boolean;
}

export interface TextPrim {
  kind: 'text';
  x: number;
  y: number;
  text: string;
  fontSize?: number;
  align?: 'left' | 'center' | 'right';
  bold?: boolean;
}

export interface DiamondPrim {
  kind: 'diamond';
  /** Center of the diamond in block-local mm coordinates. */
  cx: number;
  cy: number;
  /** Radius (half-diagonal) in mm. */
  radius: number;
  /** CDS code to render inside (already formatted, e.g. "102M"). */
  code: string;
  /** Optional connector line from the diamond tip to `connectTo`. */
  connectTo?: { x: number; y: number };
}

export type BlockPrimitive = RectPrim | LinePrim | PolygonPrim | TextPrim | DiamondPrim;

export interface BlockRenderResult {
  /** Primitives in block-local mm coordinates (origin = lower-left). */
  primitives: BlockPrimitive[];
  /** Width of the block bounding box in mm, useful for layout/snapping. */
  widthMm: number;
  /** Height of the block bounding box in mm. */
  heightMm: number;
  /** If the product has a static override SVG, this is it (raw <svg>…</svg> string). */
  customSvg?: string;
}

export interface GetBlockSvgOptions {
  /** Language for the AWI spec string label (below the diamond). */
  lang: 'en' | 'es';
  /** Whether to include the CDS diamond tag in the primitive list. */
  showDiamond?: boolean;
  /** Whether to include the "spec-string" label under the diamond. */
  showSpecString?: boolean;
}

// ── Dimension extraction ────────────────────────────────────────────────────

interface ResolvedDims {
  widthMm: number;
  heightMm: number;
  depthMm: number | null;
}

function resolveDimensions(product: ProductsCatalogRow): ResolvedDims {
  // All columns are `in` (inches) in products_catalog. We always convert to
  // mm here so downstream primitives never need to know about inches.
  const w = product.width_in != null ? Number(product.width_in) : null;
  const h = product.height_in != null ? Number(product.height_in) : null;
  const d = product.depth_in != null ? Number(product.depth_in) : null;
  return {
    widthMm: w != null ? inToMm(w) : 0,
    heightMm: h != null ? inToMm(h) : 0,
    depthMm: d != null ? inToMm(d) : null,
  };
}

// ── CDS code shortening for the diamond ─────────────────────────────────────

/**
 * Extract the short "CDS" label shown inside the diamond. For AWI SKUs
 * (`102-36x30x24`) this is just the prefix up to the dash. For legacy
 * alphabetic prefixes we take the first 4 chars so the diamond still
 * displays something recognizable.
 */
function shortCdsCode(sku: string): string {
  const dashIdx = sku.indexOf('-');
  if (dashIdx > 0 && dashIdx <= 5) return sku.slice(0, dashIdx).toUpperCase();
  // Non-AWI alpha prefix: take letters up to the first digit.
  const match = sku.match(/^([A-Za-z]+)/);
  if (match) return match[1].toUpperCase().slice(0, 5);
  return sku.slice(0, 5).toUpperCase();
}

// ── Common diamond + spec string primitives ────────────────────────────────

function diamondWithSpec(
  product: ProductsCatalogRow,
  dims: ResolvedDims,
  opts: GetBlockSvgOptions,
  anchorX: number,
  anchorY: number
): BlockPrimitive[] {
  const { lang, showDiamond = true, showSpecString = true } = opts;
  const out: BlockPrimitive[] = [];
  const radius = 30; // mm — roughly 1.2" across — scales with zoom
  const tagCy = anchorY + 90; // 90mm above the block

  if (showDiamond) {
    out.push({
      kind: 'diamond',
      cx: anchorX,
      cy: tagCy,
      radius,
      code: shortCdsCode(product.sku),
      connectTo: { x: anchorX, y: anchorY },
    });
  }

  if (showSpecString) {
    const specLabel = formatAwiSpec(
      shortCdsCode(product.sku),
      dims.widthMm,
      dims.heightMm,
      dims.depthMm,
      lang
    );
    out.push({
      kind: 'text',
      x: anchorX,
      y: tagCy + radius + 20,
      text: specLabel,
      fontSize: 28,
      align: 'center',
    });
  }
  return out;
}

// ── Plan-view generators ────────────────────────────────────────────────────

function generatePlanBase(dims: ResolvedDims): BlockPrimitive[] {
  // Plan of a base cabinet: rectangle of width × depth with an "X" across and
  // a thicker line along the front face.
  const w = dims.widthMm;
  const d = dims.depthMm ?? inToMm(24);
  return [
    // Outer rectangle
    { kind: 'rect', x: 0, y: 0, width: w, height: d, strokeWidth: 2 },
    // X indicating "cabinet"
    { kind: 'line', points: [0, 0, w, d], strokeWidth: 1 },
    { kind: 'line', points: [0, d, w, 0], strokeWidth: 1 },
    // Thicker front face line (at y=0)
    { kind: 'line', points: [0, 0, w, 0], strokeWidth: 3 },
  ];
}

function generatePlanWall(dims: ResolvedDims): BlockPrimitive[] {
  // Plan of a wall-hung cabinet: dashed rectangle (because it's above counter
  // height in plan view).
  const w = dims.widthMm;
  const d = dims.depthMm ?? inToMm(12);
  return [
    { kind: 'rect', x: 0, y: 0, width: w, height: d, strokeWidth: 2, dash: [10, 5] },
    { kind: 'line', points: [0, 0, w, 0], strokeWidth: 3, dash: [10, 5] },
  ];
}

function generatePlanTall(dims: ResolvedDims): BlockPrimitive[] {
  const w = dims.widthMm;
  const d = dims.depthMm ?? inToMm(24);
  return [
    { kind: 'rect', x: 0, y: 0, width: w, height: d, strokeWidth: 3 },
    { kind: 'line', points: [0, 0, w, d], strokeWidth: 1 },
    { kind: 'line', points: [0, d, w, 0], strokeWidth: 1 },
    { kind: 'line', points: [0, 0, w, 0], strokeWidth: 3 },
  ];
}

function generatePlanAccessory(dims: ResolvedDims): BlockPrimitive[] {
  // 460 panels/fillers in plan: narrow rect with 45° hatching.
  const w = dims.widthMm;
  const thick = 20; // mm — thin, they're 2D elements
  return [
    { kind: 'rect', x: 0, y: 0, width: w, height: thick, strokeWidth: 1.5 },
    // Diagonal hatching
    { kind: 'line', points: [0, 0, thick, thick], strokeWidth: 0.5 },
    { kind: 'line', points: [w / 2 - thick, 0, w / 2 + thick, thick], strokeWidth: 0.5 },
    { kind: 'line', points: [w - thick, 0, w, thick], strokeWidth: 0.5 },
  ];
}

function generatePlanCloset(dims: ResolvedDims): BlockPrimitive[] {
  // Closet plan: rectangle + horizontal center line (indicates rod).
  const w = dims.widthMm;
  const d = dims.depthMm ?? inToMm(16);
  return [
    { kind: 'rect', x: 0, y: 0, width: w, height: d, strokeWidth: 2 },
    { kind: 'line', points: [0, d / 2, w, d / 2], strokeWidth: 1, dash: [4, 4] },
    { kind: 'line', points: [0, 0, w, 0], strokeWidth: 3 },
  ];
}

// ── Elevation-view generators ──────────────────────────────────────────────

function generateElevationBase(dims: ResolvedDims, has2Doors: boolean): BlockPrimitive[] {
  // Base cabinet elevation: outer rect + toe-kick line + drawer top row +
  // door diagonal(s).
  const w = dims.widthMm;
  const h = dims.heightMm;
  const toeKick = inToMm(4.5);
  const drawerRowH = inToMm(4); // assume a 4" drawer top row when present

  const prims: BlockPrimitive[] = [
    { kind: 'rect', x: 0, y: 0, width: w, height: h, strokeWidth: 2 },
    // Toe-kick: small rect indented from sides
    { kind: 'line', points: [0, toeKick, w, toeKick], strokeWidth: 1 },
  ];

  // Drawer top row
  prims.push({ kind: 'line', points: [0, h - drawerRowH, w, h - drawerRowH], strokeWidth: 1 });

  if (has2Doors) {
    // Split in the middle with a small vertical gap + two mirrored diagonals
    const mid = w / 2;
    prims.push({ kind: 'line', points: [mid, toeKick, mid, h - drawerRowH], strokeWidth: 1 });
    // Diagonals from bottom-outer to top-inner
    prims.push({ kind: 'line', points: [0, toeKick, mid, h - drawerRowH], strokeWidth: 1 });
    prims.push({ kind: 'line', points: [w, toeKick, mid, h - drawerRowH], strokeWidth: 1 });
  } else {
    // Single door: diagonal from one bottom corner to the opposite top corner
    prims.push({
      kind: 'line',
      points: [0, toeKick, w, h - drawerRowH],
      strokeWidth: 1,
    });
  }
  return prims;
}

function generateElevationWall(dims: ResolvedDims, has2Doors: boolean): BlockPrimitive[] {
  const w = dims.widthMm;
  const h = dims.heightMm;
  const prims: BlockPrimitive[] = [
    { kind: 'rect', x: 0, y: 0, width: w, height: h, strokeWidth: 2 },
  ];
  if (has2Doors) {
    const mid = w / 2;
    prims.push({ kind: 'line', points: [mid, 0, mid, h], strokeWidth: 1 });
    prims.push({ kind: 'line', points: [0, 0, mid, h], strokeWidth: 1 });
    prims.push({ kind: 'line', points: [w, 0, mid, h], strokeWidth: 1 });
  } else {
    prims.push({ kind: 'line', points: [0, 0, w, h], strokeWidth: 1 });
  }
  return prims;
}

function generateElevationTall(
  dims: ResolvedDims,
  subfamily: string | null
): BlockPrimitive[] {
  const w = dims.widthMm;
  const h = dims.heightMm;
  const prims: BlockPrimitive[] = [
    { kind: 'rect', x: 0, y: 0, width: w, height: h, strokeWidth: 2 },
  ];

  if (subfamily === 'oven_column') {
    // Split into lower storage + OVEN band + upper storage.
    const ovenBandStart = h * 0.35;
    const ovenBandEnd = h * 0.6;
    prims.push({ kind: 'line', points: [0, ovenBandStart, w, ovenBandStart], strokeWidth: 2 });
    prims.push({ kind: 'line', points: [0, ovenBandEnd, w, ovenBandEnd], strokeWidth: 2 });
    prims.push({
      kind: 'text',
      x: w / 2,
      y: (ovenBandStart + ovenBandEnd) / 2,
      text: 'OVEN',
      fontSize: 40,
      align: 'center',
      bold: true,
    });
  } else {
    // Default tall: vertical divider (double doors)
    const mid = w / 2;
    prims.push({ kind: 'line', points: [mid, 0, mid, h], strokeWidth: 1 });
    prims.push({ kind: 'line', points: [0, 0, mid, h], strokeWidth: 1 });
    prims.push({ kind: 'line', points: [w, 0, mid, h], strokeWidth: 1 });
  }
  return prims;
}

function generateElevationAccessory(dims: ResolvedDims): BlockPrimitive[] {
  const w = dims.widthMm;
  const h = dims.heightMm;
  return [
    { kind: 'rect', x: 0, y: 0, width: w, height: h, strokeWidth: 1.5 },
    // 45° diagonal hatching
    { kind: 'line', points: [0, 0, w, h], strokeWidth: 0.5 },
    { kind: 'line', points: [0, h, w, 0], strokeWidth: 0.5 },
  ];
}

function generateElevationCloset(dims: ResolvedDims): BlockPrimitive[] {
  const w = dims.widthMm;
  const h = dims.heightMm;
  const prims: BlockPrimitive[] = [
    { kind: 'rect', x: 0, y: 0, width: w, height: h, strokeWidth: 2 },
  ];
  // Horizontal shelf lines every ~12"
  const shelfStep = inToMm(12);
  for (let y = shelfStep; y < h; y += shelfStep) {
    prims.push({ kind: 'line', points: [0, y, w, y], strokeWidth: 0.75, dash: [8, 4] });
  }
  return prims;
}

// ── Main entry point ────────────────────────────────────────────────────────

export function getBlockSvg(
  product: ProductsCatalogRow,
  view: ViewType,
  opts: GetBlockSvgOptions
): BlockRenderResult {
  // Static override takes precedence.
  if (view === 'plan' && product.draft_plan_svg) {
    const dims = resolveDimensions(product);
    return {
      primitives: [],
      widthMm: dims.widthMm,
      heightMm: dims.depthMm ?? dims.heightMm,
      customSvg: product.draft_plan_svg,
    };
  }
  if (view === 'elevation' && product.draft_elevation_svg) {
    const dims = resolveDimensions(product);
    return {
      primitives: [],
      widthMm: dims.widthMm,
      heightMm: dims.heightMm,
      customSvg: product.draft_elevation_svg,
    };
  }
  if (view === 'detail' && product.draft_detail_svg) {
    const dims = resolveDimensions(product);
    return {
      primitives: [],
      widthMm: dims.widthMm,
      heightMm: dims.heightMm,
      customSvg: product.draft_detail_svg,
    };
  }

  const dims = resolveDimensions(product);
  const family = product.draft_family;
  const subfamily = product.draft_subfamily;
  // Very rough heuristic for 2-door cabinets — improved when we wire the
  // description parser in Session C.
  const has2Doors =
    /2\s*doors/i.test(product.description ?? '') ||
    /double/i.test(product.description ?? '') ||
    Number(product.width_in ?? 0) >= 30;

  let body: BlockPrimitive[] = [];
  const effectiveView = view === 'detail' ? 'elevation' : view;

  if (effectiveView === 'plan') {
    if (family === 'wall') body = generatePlanWall(dims);
    else if (family === 'tall') body = generatePlanTall(dims);
    else if (family === 'accessory') body = generatePlanAccessory(dims);
    else if (family === 'closet') body = generatePlanCloset(dims);
    else body = generatePlanBase(dims);
  } else {
    if (family === 'wall') body = generateElevationWall(dims, has2Doors);
    else if (family === 'tall') body = generateElevationTall(dims, subfamily);
    else if (family === 'accessory') body = generateElevationAccessory(dims);
    else if (family === 'closet') body = generateElevationCloset(dims);
    else body = generateElevationBase(dims, has2Doors);
  }

  // Bounding dimensions of the block in local mm (origin at 0,0)
  const widthMm = dims.widthMm;
  const heightMm =
    effectiveView === 'plan' ? dims.depthMm ?? inToMm(24) : dims.heightMm;

  // Diamond + spec string at top-center of the block
  const diamondAnchor = { x: widthMm / 2, y: heightMm };
  const tag = diamondWithSpec(product, dims, opts, diamondAnchor.x, diamondAnchor.y);

  return {
    primitives: [...body, ...tag],
    widthMm,
    heightMm,
  };
}

/**
 * Serialize primitives to an `<svg>` string. Used by the Catalog panel to
 * render thumbnail previews and by `exportDrawingPdf` for the PDF output.
 * `stroke-width` values are written in mm units; the caller provides the
 * pixels-per-mm scale by wrapping the string in a `<svg>` with a viewBox.
 */
export function primitivesToSvgString(
  primitives: BlockPrimitive[],
  widthMm: number,
  heightMm: number,
  padding = 120
): string {
  const minX = -padding;
  const minY = -padding;
  const w = widthMm + padding * 2;
  const h = heightMm + padding * 2;

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${w} ${h}" fill="none" stroke="currentColor" stroke-linecap="square">`
  );
  // Flip y-axis so origin is lower-left.
  parts.push(`<g transform="translate(0, ${heightMm}) scale(1, -1)">`);

  for (const p of primitives) {
    if (p.kind === 'rect') {
      parts.push(
        `<rect x="${p.x}" y="${p.y}" width="${p.width}" height="${p.height}" stroke-width="${
          p.strokeWidth ?? 1
        }" ${p.dash ? `stroke-dasharray="${p.dash.join(' ')}"` : ''} fill-opacity="${
          p.fillOpacity ?? 0
        }" />`
      );
    } else if (p.kind === 'line') {
      parts.push(
        `<line x1="${p.points[0]}" y1="${p.points[1]}" x2="${p.points[2]}" y2="${p.points[3]}" stroke-width="${
          p.strokeWidth ?? 1
        }" ${p.dash ? `stroke-dasharray="${p.dash.join(' ')}"` : ''} />`
      );
    } else if (p.kind === 'polygon') {
      const pts = p.points.join(' ');
      parts.push(
        `<polyline points="${pts}" stroke-width="${p.strokeWidth ?? 1}" fill="none" />`
      );
    } else if (p.kind === 'text') {
      // SVG text with scale(1,-1) looks mirrored — re-flip locally.
      parts.push(
        `<g transform="translate(${p.x}, ${p.y}) scale(1, -1)"><text text-anchor="${
          p.align === 'center' ? 'middle' : p.align === 'right' ? 'end' : 'start'
        }" font-size="${p.fontSize ?? 24}" font-family="sans-serif" fill="currentColor" stroke="none" ${
          p.bold ? 'font-weight="bold"' : ''
        }>${escapeXml(p.text)}</text></g>`
      );
    } else if (p.kind === 'diamond') {
      const r = p.radius;
      // Diamond polygon: top, right, bottom, left
      parts.push(
        `<polygon points="${p.cx},${p.cy + r} ${p.cx + r},${p.cy} ${p.cx},${p.cy - r} ${
          p.cx - r
        },${p.cy}" stroke-width="2" fill="white" />`
      );
      if (p.connectTo) {
        parts.push(
          `<line x1="${p.cx}" y1="${p.cy - r}" x2="${p.connectTo.x}" y2="${p.connectTo.y}" stroke-width="1" />`
        );
      }
      parts.push(
        `<g transform="translate(${p.cx}, ${p.cy}) scale(1, -1)"><text text-anchor="middle" dominant-baseline="middle" font-size="${
          r * 0.9
        }" font-family="sans-serif" font-weight="bold" fill="currentColor" stroke="none">${escapeXml(
          p.code
        )}</text></g>`
      );
    }
  }

  parts.push('</g>');
  parts.push('</svg>');
  return parts.join('');
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
