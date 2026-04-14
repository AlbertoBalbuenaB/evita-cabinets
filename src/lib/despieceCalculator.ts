import type { CutPiece, Cubrecanto } from '../types';

// ── Constants (mm) ───────────────────────────────────────────────────────────
const DOOR_OVERLAY_GAP   = 3;   // overlay gap between door/drawer face and opening
const SLIDE_CLEARANCE    = 26;  // total width deducted for drawer slides
const DRAWER_BACK_CLEAR  = 50;  // drawer box doesn't reach the back panel
const DRAWER_TOP_CLEAR   = 40;  // drawer box is shorter than its face
const RAIL_HEIGHT        = 100; // height of front rails (stretchers)

export interface DespieceInput {
  heightIn: number;
  widthIn: number;
  depthIn: number;
  cabinetType: 'base' | 'wall' | 'tall';
  bodyThickness: number;
  shelves: number;
  hasDoors: boolean;
  numDoors: number;
  doorSectionHeightIn: number;
  hasDrawers: boolean;
  numDrawers: number;
  drawerSectionHeightIn: number;
  // V2 additions (all optional for backward compatibility)
  shelfType?: 'fixed' | 'adjustable';
  optimizeDepth?: boolean;
  isSink?: boolean;
  drawerBoxThickness?: number;  // mm, default 15. Thickness for drawer box sides/ends/bottom
}

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

export function calculateDespiece(input: DespieceInput): CutPiece[] {
  const {
    heightIn, widthIn, depthIn,
    cabinetType, bodyThickness: esp,
    shelves,
    hasDoors, numDoors, doorSectionHeightIn,
    hasDrawers, numDrawers, drawerSectionHeightIn,
  } = input;

  // V2 defaults
  const shelfType = input.shelfType ?? (cabinetType === 'base' ? 'fixed' : 'adjustable');
  const doOptimize = input.optimizeDepth ?? true;
  const isSink = input.isSink ?? false;
  const drawerEsp = input.drawerBoxThickness ?? 15;

  const H = Math.round(heightIn * 25.4);
  const W = Math.round(widthIn  * 25.4);
  const rawD = Math.round(depthIn * 25.4);
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
    add('Shelves', innerW, shelfDepth, shelves, 'cuerpo', shelfCb, 'horizontal');
  }

  // ── Doors ──────────────────────────────────────────────────────────────────
  if (hasDoors && numDoors > 0) {
    const doorH = doorSectionHeightIn > 0 ? Math.round(doorSectionHeightIn * 25.4) : H;
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
    const drawerH_in  = drawerSectionHeightIn > 0 ? drawerSectionHeightIn : heightIn;
    const faceHeight  = Math.round((drawerH_in / numDrawers) * 25.4);
    const boxOuterW   = innerW - SLIDE_CLEARANCE;   // outer width of drawer box
    const boxInnerH   = faceHeight - DRAWER_TOP_CLEAR;
    const boxDepth    = D - DRAWER_BACK_CLEAR;       // drawer box depth (guide length)

    // Drawer Faces (visible front panel)
    add('Drawer Faces', W - DOOR_OVERLAY_GAP, faceHeight, numDrawers, 'frente',
      { sup: 2, inf: 2, izq: 2, der: 2 }, 'vertical');

    // Drawer Box Sides (2 per drawer, running front-to-back)
    add('Drawer Box Sides', boxDepth, boxInnerH, numDrawers * 2, 'cuerpo',
      { sup: 1, inf: 1, izq: 0, der: 0 }, 'horizontal');

    // Drawer Box Ends (front & back of the box, between the sides) — uses drawerEsp (15mm)
    add('Drawer Box Ends', boxOuterW - 2 * drawerEsp, boxInnerH, numDrawers * 2, 'cuerpo',
      { sup: 0, inf: 0, izq: 0, der: 0 }, 'none');

    // Drawer Box Bottom (sits on the bottom of the drawer box frame)
    add('Drawer Box Bottom', boxOuterW, boxDepth, numDrawers, 'cuerpo',
      { sup: 0, inf: 0, izq: 0, der: 0 }, 'none');
  }

  return pieces;
}
