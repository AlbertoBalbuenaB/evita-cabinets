import type { CutPiece } from '../types';

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
}

function uid(): string {
  return crypto.randomUUID();
}

export function calculateDespiece(input: DespieceInput): CutPiece[] {
  const {
    heightIn, widthIn, depthIn,
    cabinetType, bodyThickness: esp,
    shelves,
    hasDoors, numDoors, doorSectionHeightIn,
    hasDrawers, numDrawers, drawerSectionHeightIn,
  } = input;

  const H = Math.round(heightIn * 25.4);
  const W = Math.round(widthIn  * 25.4);
  const D = Math.round(depthIn  * 25.4);

  // Inner width (between the two side panels)
  const innerW = W - 2 * esp;

  const pieces: CutPiece[] = [];

  const add = (
    nombre: string,
    ancho: number,
    alto: number,
    cantidad: number,
    material: CutPiece['material'],
  ) => {
    pieces.push({
      id: uid(),
      nombre,
      ancho: Math.round(ancho),
      alto:  Math.round(alto),
      cantidad,
      material,
    });
  };

  // ── Box structure (all cabinet types) ─────────────────────────────────────
  // Sides: full height × full depth
  add('Side Panels',   D,        H,         2, 'cuerpo');

  // Back Panel: inner width × full height (fits between side panels)
  add('Back Panel',    innerW,   H,         1, 'back');

  // Top Panel: inner width × (depth minus back panel thickness)
  add('Top Panel',     innerW,   D - esp,   1, 'cuerpo');

  // Bottom Panel: same dimensions as Top
  add('Bottom Panel',  innerW,   D - esp,   1, 'cuerpo');

  // ── Front Rails (Stretchers) ───────────────────────────────────────────────
  // Generated for Base and Tall cabinets whenever drawers are present.
  // One rail per drawer, spanning the inner width, at the front of the cabinet.
  if ((cabinetType === 'base' || cabinetType === 'tall') && hasDrawers && numDrawers > 0) {
    add('Front Rails',   innerW,   RAIL_HEIGHT,   numDrawers, 'cuerpo');
  }

  // ── Shelves ────────────────────────────────────────────────────────────────
  // Wall/Upper: shelf depth = D − back panel thickness (shelves reach the front edge)
  // Base/Tall:  shelf depth = D − 2×back panel thickness (back AND front deducted,
  //             since front rails / stretchers occupy that space at the front)
  if (shelves > 0) {
    const shelfDepth = cabinetType === 'wall'
      ? D - esp
      : D - 2 * esp;
    add('Shelves', innerW, shelfDepth, shelves, 'cuerpo');
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
    add('Drawer Faces',        W - DOOR_OVERLAY_GAP,       faceHeight,  numDrawers,     'frente');

    // Drawer Box Sides (2 per drawer, running front-to-back)
    add('Drawer Box Sides',    boxDepth,                    boxInnerH,   numDrawers * 2, 'cuerpo');

    // Drawer Box Ends (front & back of the box, between the sides)
    add('Drawer Box Ends',     boxOuterW - 2 * esp,         boxInnerH,   numDrawers * 2, 'cuerpo');

    // Drawer Box Bottom (sits on the bottom of the drawer box frame)
    add('Drawer Box Bottom',   boxOuterW,                   boxDepth,    numDrawers,     'cuerpo');
  }

  return pieces;
}
