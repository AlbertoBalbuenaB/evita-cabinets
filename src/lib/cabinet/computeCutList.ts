import type { CutPiece, Cubrecanto } from '../../types';
import type { CabinetConfig } from './CabinetConfig';
import { toEngineFamily } from './CabinetConfig';

// ── Constants (mm) ───────────────────────────────────────────────────────────
const DOOR_OVERLAY_GAP   = 3;   // overlay gap between door/drawer face and opening
const SLIDE_CLEARANCE    = 26;  // total width deducted for drawer slides
const DRAWER_BACK_CLEAR  = 50;  // drawer box doesn't reach the back panel
const DRAWER_TOP_CLEAR   = 40;  // drawer box is shorter than its face
const RAIL_HEIGHT        = 100; // height of front rails (stretchers)

function uid(): string {
  return crypto.randomUUID();
}

/** Snap raw mm depth to nearest standard sheet fraction of 1220mm. */
function optimizeDepthMm(rawMm: number): number {
  if (rawMm <= 305) return 300;   // 12"D → 1/4 sheet (1220/4 ≈ 305)
  if (rawMm <= 410) return 400;   // 16"D → 1/3 sheet (1220/3 ≈ 407)
  if (rawMm <= 480) return 450;   // 18"D
  if (rawMm <= 630) return 600;   // 24"D → 1/2 sheet (1220/2 = 610)
  return rawMm;                    // keep raw for very deep cabinets
}

/**
 * Pure, deterministic (modulo piece IDs) cut-list engine. Takes a canonical
 * `CabinetConfig` and returns the flat list of cut pieces in mm, tagged with
 * material role, edgeband pattern, and grain direction.
 *
 * The engine operates directly in millimeters. It is agnostic to the origin
 * of its input: today it runs on catalog-derived configs, and Phase 2 will
 * run it on Draft Tool custom cabinets through the same entry point.
 */
export function computeCutList(config: CabinetConfig): CutPiece[] {
  const cabinetType = toEngineFamily(config.family);
  const esp = config.boxThicknessMm ?? 18;
  const drawerEsp = config.drawerBoxThicknessMm ?? 15;
  const shelfType = config.shelfType ?? (cabinetType === 'base' ? 'fixed' : 'adjustable');
  const doOptimize = config.optimizeDepth ?? true;
  const isSink = config.isSink ?? false;
  const hasDoors = config.hasDoors;
  const numDoors = config.doorCount;
  const hasDrawers = config.hasDrawers;
  const numDrawers = config.drawerCount;
  const shelves = config.shelfCount + (config.extraShelves ?? 0);

  // Canonical mm dimensions (already rounded integers when produced by
  // adapters via Math.round(inches * 25.4)).
  const H = config.heightMm;
  const W = config.widthMm;
  const rawD = config.depthMm;
  const D = doOptimize ? optimizeDepthMm(rawD) : rawD;

  // Inner width (between the two side panels)
  const innerW = W - 2 * esp;

  const pieces: CutPiece[] = [];

  const add = (
    nombre: string,
    ancho: number,
    alto: number,
    cantidad: number,
    material: CutPiece['material'],
    cubrecanto: Cubrecanto,
    veta: CutPiece['veta'],
  ) => {
    pieces.push({
      id: uid(),
      nombre,
      ancho: Math.round(ancho),
      alto:  Math.round(alto),
      cantidad,
      material,
      cubrecanto,
      veta,
    });
  };

  // ── Box structure (all cabinet types) ─────────────────────────────────────

  // Side Panels: full height × full depth
  const sideCb: Cubrecanto = cabinetType === 'wall'
    ? { sup: 2, inf: 2, izq: 1, der: 1 }   // wall: both top and bottom visible
    : { sup: 2, inf: 1, izq: 1, der: 1 };   // base/tall: bottom on floor
  add('Side Panels', D, H, 2, 'cuerpo', sideCb, 'vertical');

  // Back Panel: inner width × full height (fits between side panels)
  add('Back Panel', innerW, H, 1, 'back',
    { sup: 1, inf: 1, izq: 0, der: 0 }, 'vertical');

  // Top Panel: inner width × (depth minus back panel thickness)
  // Sink bases have NO top panel — replaced by stretchers below
  if (!isSink) {
    add('Top Panel', innerW, D - esp, 1, 'cuerpo',
      { sup: 2, inf: 0, izq: 0, der: 0 }, 'horizontal');
  }

  // Bottom Panel: same dimensions as Top
  add('Bottom Panel', innerW, D - esp, 1, 'cuerpo',
    { sup: 2, inf: 0, izq: 0, der: 0 }, 'horizontal');

  // ── Sink Base Stretchers ───────────────────────────────────────────────────
  // Sink bases get 2 front stretchers (armadores) instead of a top panel
  if (isSink) {
    add('Stretchers', innerW, RAIL_HEIGHT, 2, 'cuerpo',
      { sup: 1, inf: 0, izq: 0, der: 0 }, 'horizontal');
  }

  // ── Front Rails (Stretchers) ───────────────────────────────────────────────
  // Generated for Base and Tall cabinets whenever drawers are present.
  // One rail per drawer, spanning the inner width, at the front of the cabinet.
  if (!isSink && (cabinetType === 'base' || cabinetType === 'tall') && hasDrawers && numDrawers > 0) {
    add('Front Rails', innerW, RAIL_HEIGHT, numDrawers, 'cuerpo',
      { sup: 1, inf: 0, izq: 0, der: 0 }, 'horizontal');
  }

  // ── Shelves ────────────────────────────────────────────────────────────────
  // Sink bases have NO shelves
  if (shelves > 0 && !isSink) {
    const shelfDepth = cabinetType === 'wall'
      ? D - esp
      : D - 2 * esp;
    const shelfCb: Cubrecanto = shelfType === 'adjustable'
      ? { sup: 1, inf: 1, izq: 1, der: 1 }   // all 4 sides
      : { sup: 1, inf: 0, izq: 0, der: 0 };   // front edge only
    add('Shelves', innerW, shelfDepth, shelves, 'shelf', shelfCb, 'horizontal');
  }

  // ── Doors ──────────────────────────────────────────────────────────────────
  if (hasDoors && numDoors > 0) {
    const doorH = config.doorSectionHeightMm && config.doorSectionHeightMm > 0
      ? config.doorSectionHeightMm
      : H;
    add(
      'Doors',
      Math.round(W / numDoors) - DOOR_OVERLAY_GAP,
      doorH - DOOR_OVERLAY_GAP,
      numDoors,
      'frente',
      { sup: 2, inf: 2, izq: 2, der: 2 },
      'vertical',
    );
  }

  // ── Drawer Boxes ───────────────────────────────────────────────────────────
  if (hasDrawers && numDrawers > 0) {
    const drawerSectionMm = config.drawerSectionHeightMm && config.drawerSectionHeightMm > 0
      ? config.drawerSectionHeightMm
      : H;
    const faceHeight  = Math.round(drawerSectionMm / numDrawers);
    const boxOuterW   = innerW - SLIDE_CLEARANCE;   // outer width of drawer box
    const boxInnerH   = faceHeight - DRAWER_TOP_CLEAR;
    const boxDepth    = D - DRAWER_BACK_CLEAR;       // drawer box depth (guide length)

    // Drawer Faces (visible front panel)
    add('Drawer Faces', W - DOOR_OVERLAY_GAP, faceHeight, numDrawers, 'frente',
      { sup: 2, inf: 2, izq: 2, der: 2 }, 'vertical');

    // Drawer Box Sides (2 per drawer, running front-to-back)
    add('Drawer Box Sides', boxDepth, boxInnerH, numDrawers * 2, 'drawer_box',
      { sup: 1, inf: 1, izq: 0, der: 0 }, 'horizontal');

    // Drawer Box Ends (front & back of the box, between the sides) — uses drawerEsp (15mm)
    add('Drawer Box Ends', boxOuterW - 2 * drawerEsp, boxInnerH, numDrawers * 2, 'drawer_box',
      { sup: 0, inf: 0, izq: 0, der: 0 }, 'none');

    // Drawer Box Bottom (sits on the bottom of the drawer box frame)
    add('Drawer Box Bottom', boxOuterW, boxDepth, numDrawers, 'drawer_box',
      { sup: 0, inf: 0, izq: 0, der: 0 }, 'none');
  }

  return pieces;
}
