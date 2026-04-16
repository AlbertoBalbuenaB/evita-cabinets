#!/usr/bin/env node
/**
 * One-shot generator for the CDB cut_pieces fix + dedupe migration SQL.
 *
 * Background and decisions are in
 * .claude/plans/in-the-products-catalog-there-flickering-dewdrop.md
 *
 * What this prints to stdout (no DB side-effects):
 *   1. UPDATE products_catalog cut_pieces + has_drawers for the 22 broken old-format
 *      CDB SKUs, regenerated via a faithful port of computeCutList()
 *      (src/lib/cabinet/computeCutList.ts).
 *   2. UPDATE area_cabinets.product_sku from the 3 dashed-format SKUs to their
 *      compact-format equivalents.
 *   3. Sanity-guard DO block.
 *   4. DELETE the 3 dashed-format duplicates.
 *
 * Usage:
 *   node scripts/generateCdbCutPiecesFix.mjs > /tmp/cdb-fix.sql
 *
 * No env vars or DB access required — all geometry is hard-coded from the
 * authoritative audit (see plan file). After review, paste into a migration
 * and apply via the Supabase MCP `apply_migration`.
 */

import { randomUUID } from 'node:crypto';

// ─── Engine port ─────────────────────────────────────────────────────────────
// Port of src/lib/cabinet/computeCutList.ts. Match the constants and behavior
// EXACTLY. If the source engine ever diverges, regenerate this script (or
// switch to importing the TS via tsx) before re-running.
const DOOR_OVERLAY_GAP = 3;
const SLIDE_CLEARANCE = 26;
const DRAWER_BACK_CLEAR = 50;
const DRAWER_TOP_CLEAR = 40;
const RAIL_HEIGHT = 100;

function optimizeDepthMm(rawMm) {
  if (rawMm <= 305) return 300;
  if (rawMm <= 410) return 400;
  if (rawMm <= 480) return 450;
  if (rawMm <= 630) return 600;
  return rawMm;
}

function inToMm(inches) {
  return Math.round(inches * 25.4);
}

/**
 * @param {Object} cfg
 * @param {number} cfg.widthIn
 * @param {number} cfg.heightIn
 * @param {number} cfg.depthIn
 * @param {boolean} cfg.hasDoors
 * @param {number} cfg.doorCount
 * @param {boolean} cfg.hasDrawers
 * @param {number} cfg.drawerCount
 * @param {number} cfg.shelfCount
 * @param {'fixed'|'adjustable'} cfg.shelfType
 * @param {'base'|'wall'|'tall'} cfg.cabinetType
 */
function computeCutList(cfg) {
  const esp = 18;
  const drawerEsp = 15;
  const isSink = false;

  const H = inToMm(cfg.heightIn);
  const W = inToMm(cfg.widthIn);
  const rawD = inToMm(cfg.depthIn);
  const D = optimizeDepthMm(rawD);

  const innerW = W - 2 * esp;
  const pieces = [];
  const add = (nombre, ancho, alto, cantidad, material, cubrecanto, veta) => {
    pieces.push({
      id: randomUUID(),
      nombre,
      ancho: Math.round(ancho),
      alto: Math.round(alto),
      cantidad,
      material,
      cubrecanto,
      veta,
    });
  };

  // Side Panels
  const sideCb =
    cfg.cabinetType === 'wall'
      ? { sup: 2, inf: 2, izq: 1, der: 1 }
      : { sup: 2, inf: 1, izq: 1, der: 1 };
  add('Side Panels', D, H, 2, 'cuerpo', sideCb, 'vertical');

  // Back Panel
  add('Back Panel', innerW, H, 1, 'back', { sup: 1, inf: 1, izq: 0, der: 0 }, 'vertical');

  // Top Panel
  if (!isSink) {
    add('Top Panel', innerW, D - esp, 1, 'cuerpo', { sup: 2, inf: 0, izq: 0, der: 0 }, 'horizontal');
  }
  // Bottom Panel
  add('Bottom Panel', innerW, D - esp, 1, 'cuerpo', { sup: 2, inf: 0, izq: 0, der: 0 }, 'horizontal');

  // Front Rails (base/tall + drawers)
  if (
    !isSink &&
    (cfg.cabinetType === 'base' || cfg.cabinetType === 'tall') &&
    cfg.hasDrawers &&
    cfg.drawerCount > 0
  ) {
    add('Front Rails', innerW, RAIL_HEIGHT, cfg.drawerCount, 'cuerpo', { sup: 1, inf: 0, izq: 0, der: 0 }, 'horizontal');
  }

  // Shelves
  if (cfg.shelfCount > 0 && !isSink) {
    const shelfDepth = cfg.cabinetType === 'wall' ? D - esp : D - 2 * esp;
    const shelfCb =
      cfg.shelfType === 'adjustable'
        ? { sup: 4, inf: 4, izq: 4, der: 4 }
        : { sup: 4, inf: 0, izq: 0, der: 0 };
    add('Shelves', innerW, shelfDepth, cfg.shelfCount, 'shelf', shelfCb, 'horizontal');
  }

  // Doors
  if (cfg.hasDoors && cfg.doorCount > 0) {
    add(
      'Doors',
      Math.round(W / cfg.doorCount) - DOOR_OVERLAY_GAP,
      H - DOOR_OVERLAY_GAP,
      cfg.doorCount,
      'frente',
      { sup: 2, inf: 2, izq: 2, der: 2 },
      'vertical',
    );
  }

  // Drawer Boxes
  if (cfg.hasDrawers && cfg.drawerCount > 0) {
    const faceHeight = Math.round(H / cfg.drawerCount);
    const boxOuterW = innerW - SLIDE_CLEARANCE;
    const boxInnerH = faceHeight - DRAWER_TOP_CLEAR;
    const boxDepth = D - DRAWER_BACK_CLEAR;

    add('Drawer Faces', W - DOOR_OVERLAY_GAP, faceHeight, cfg.drawerCount, 'frente', { sup: 2, inf: 2, izq: 2, der: 2 }, 'vertical');
    add('Drawer Box Sides', boxDepth, boxInnerH, cfg.drawerCount * 2, 'drawer_box', { sup: 3, inf: 3, izq: 0, der: 0 }, 'horizontal');
    add('Drawer Box Ends', boxOuterW - 2 * drawerEsp, boxInnerH, cfg.drawerCount * 2, 'drawer_box', { sup: 0, inf: 0, izq: 0, der: 0 }, 'none');
    add('Drawer Box Bottom', boxOuterW, boxDepth, cfg.drawerCount, 'drawer_box', { sup: 0, inf: 0, izq: 0, der: 0 }, 'none');
  }

  return pieces;
}

// ─── Audit-derived dataset ────────────────────────────────────────────────────
// 22 broken old-format CDB SKUs to regenerate.
// Drawer/shelf rules from the 16"D twins:
//   H=30 or 36 → 3 drawers, 1 shelf
//   H=39, 42, 46 → 4 drawers, 2 shelves
// The 2 "27-prefix" oddballs say "4 Drawers" in the description — trust that;
// pick shelf count from the height rule (H=30 → 1, H=39 → 2).

function rule(heightIn) {
  if (heightIn >= 39) return { drawerCount: 4, shelfCount: 2 };
  return { drawerCount: 3, shelfCount: 1 };
}

const BROKEN = [];
for (const w of [18, 24, 30, 36, 42]) {
  for (const h of [30, 36, 39, 42]) {
    const sku = `CDB${w}${h}24`;
    const r = rule(h);
    BROKEN.push({
      sku,
      widthIn: w,
      heightIn: h,
      depthIn: 24,
      drawerCount: r.drawerCount,
      shelfCount: r.shelfCount,
      hasDrawers: true,
    });
  }
}
// 27W oddballs — description says "4 Drawers" → override
BROKEN.push({
  sku: 'CDB27x30x16',
  widthIn: 27,
  heightIn: 30,
  depthIn: 16,
  drawerCount: 4,
  shelfCount: 1,
  hasDrawers: true,
});
BROKEN.push({
  sku: 'CDB27x39x24',
  widthIn: 27,
  heightIn: 39,
  depthIn: 24,
  drawerCount: 4,
  shelfCount: 2,
  hasDrawers: true,
});

if (BROKEN.length !== 22) {
  console.error(`ERROR: expected 22 broken SKUs, got ${BROKEN.length}`);
  process.exit(1);
}

// 3 dashed → compact mappings (for area_cabinets migration + DELETE).
const DASHED_TO_COMPACT = [
  { dashed: 'CDB-24x30x24-3', compact: 'CDB243024' },
  { dashed: 'CDB-30x42x24-4', compact: 'CDB304224' },
  { dashed: 'CDB-42x30x24-3', compact: 'CDB423024' },
];

// 21 already-complete CDB SKUs to ALSO regenerate, to consolidate cubrecanto
// codes (commit 22ea626 introduced codes 3/4 for drawer_box/shelf — old data
// uses code 1). Run separately with --drift mode.
const DRIFT_SKUS = [];
for (const w of [18, 24, 30, 36, 42]) {
  for (const h of [30, 36, 39, 42]) {
    const r = rule(h);
    DRIFT_SKUS.push({
      sku: `CDB${w}${h}-${r.drawerCount}`,
      widthIn: w,
      heightIn: h,
      depthIn: 16,
      drawerCount: r.drawerCount,
      shelfCount: r.shelfCount,
      hasDrawers: true,
    });
  }
}
DRIFT_SKUS.push({
  sku: 'CDB36x46x20-4',
  widthIn: 36,
  heightIn: 46,
  depthIn: 20,
  drawerCount: 4,
  shelfCount: 2,
  hasDrawers: true,
});

if (DRIFT_SKUS.length !== 21) {
  console.error(`ERROR: expected 21 drift SKUs, got ${DRIFT_SKUS.length}`);
  process.exit(1);
}

const MODE = process.argv[2] === '--drift' ? 'drift' : 'fix';

// ─── SQL emitter ──────────────────────────────────────────────────────────────
function sqlString(s) {
  return `'${String(s).replace(/'/g, "''")}'`;
}
function sqlJsonb(obj) {
  return `$json$${JSON.stringify(obj)}$json$::jsonb`;
}

const out = [];
out.push(`-- Generated by scripts/generateCdbCutPiecesFix.mjs ${MODE === 'drift' ? '--drift' : ''}`);
out.push(`-- Run at: ${new Date().toISOString()}`);
out.push('-- See .claude/plans/in-the-products-catalog-there-flickering-dewdrop.md');
out.push('');
out.push('BEGIN;');
out.push('');

const targets = MODE === 'drift' ? DRIFT_SKUS : BROKEN;
const sectionLabel =
  MODE === 'drift'
    ? `-- Regenerate cut_pieces for the ${DRIFT_SKUS.length} already-complete CDB SKUs to align cubrecanto codes with the current engine (commit 22ea626).`
    : `-- (A) Regenerate cut_pieces + force has_drawers=TRUE for the ${BROKEN.length} broken CDB SKUs`;
out.push(sectionLabel);

for (const b of targets) {
  const pieces = computeCutList({
    widthIn: b.widthIn,
    heightIn: b.heightIn,
    depthIn: b.depthIn,
    hasDoors: false,
    doorCount: 0,
    hasDrawers: b.hasDrawers,
    drawerCount: b.drawerCount,
    shelfCount: b.shelfCount,
    shelfType: 'fixed',
    cabinetType: 'base',
  });
  out.push(
    `UPDATE products_catalog SET cut_pieces = ${sqlJsonb(pieces)}, has_drawers = TRUE, updated_at = NOW() WHERE sku = ${sqlString(b.sku)};`,
  );
}

if (MODE === 'fix') {
  out.push('');
  out.push('-- (B) Migrate area_cabinets references from dashed to compact format');
  for (const m of DASHED_TO_COMPACT) {
    out.push(
      `UPDATE area_cabinets SET product_sku = ${sqlString(m.compact)} WHERE product_sku = ${sqlString(m.dashed)};`,
    );
  }
  out.push('');
  out.push('-- (C) Sanity guard: refuse to delete if any area_cabinets still reference CDB-* SKUs');
  out.push(`DO $$
DECLARE leftover INT;
BEGIN
  SELECT COUNT(*) INTO leftover FROM area_cabinets WHERE product_sku LIKE 'CDB-%';
  IF leftover > 0 THEN
    RAISE EXCEPTION 'Refusing to delete: % area_cabinets still reference CDB-* SKUs', leftover;
  END IF;
END $$;`);
  out.push('');
  out.push('-- (D) Delete the 3 dashed-format duplicates');
  out.push(
    `DELETE FROM products_catalog WHERE sku IN (${DASHED_TO_COMPACT.map((m) => sqlString(m.dashed)).join(', ')});`,
  );
}
out.push('');
out.push('COMMIT;');
out.push('');

process.stdout.write(out.join('\n'));
console.error(
  MODE === 'drift'
    ? `OK. Emitted SQL for ${DRIFT_SKUS.length} drift-regen.`
    : `OK. Emitted SQL for ${BROKEN.length} regen + ${DASHED_TO_COMPACT.length} dedupe.`,
);
