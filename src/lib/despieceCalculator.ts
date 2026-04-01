import type { CutPiece } from '../types';

const GAP_FRENTE      = 3;   // mm — overlay gap for doors/fronts
const GAP_CORREDERA   = 26;  // mm — total drawer slide clearance
const CLEARANCE_FONDO = 50;  // mm — drawer box doesn't reach back
const CLEARANCE_ALTO  = 40;  // mm — drawer box shorter than front
const ANCHO_ARMADOR   = 100; // mm — rail height for base cabinets

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

function mm(inches: number): number {
  return Math.round(inches * 25.4);
}

export function calculateDespiece(input: DespieceInput): CutPiece[] {
  const {
    heightIn, widthIn, depthIn,
    cabinetType, bodyThickness: esp,
    shelves,
    hasDoors, numDoors, doorSectionHeightIn,
    hasDrawers, numDrawers, drawerSectionHeightIn,
  } = input;

  const H = mm(heightIn);
  const W = mm(widthIn);
  const D = mm(depthIn);
  const anchoInt = W - 2 * esp;

  const pieces: CutPiece[] = [];

  const add = (
    nombre: string,
    ancho: number,
    alto: number,
    cantidad: number,
    material: CutPiece['material'],
  ) => {
    pieces.push({ id: uid(), nombre, ancho: Math.round(ancho), alto: Math.round(alto), cantidad, material });
  };

  // --- Structural pieces ---
  add('Costados',  D,         H,             2, 'cuerpo');
  add('Trasero',   anchoInt,  H - 2 * esp,   1, 'cuerpo');

  if (cabinetType === 'base') {
    add('Piso',       anchoInt,     D - esp, 1, 'cuerpo');
    add('Armadores',  anchoInt,     ANCHO_ARMADOR, 4, 'cuerpo');
  } else {
    // wall / tall
    add('Techo', anchoInt, D, 1, 'cuerpo');
    add('Piso',  anchoInt, D, 1, 'cuerpo');
  }

  if (shelves > 0) {
    add('Entrepaños', anchoInt - 1, D - 20, shelves, 'cuerpo');
  }

  // --- Doors ---
  if (hasDoors && numDoors > 0) {
    const doorH = doorSectionHeightIn > 0 ? mm(doorSectionHeightIn) : H;
    add(
      'Puertas',
      Math.round(W / numDoors) - GAP_FRENTE,
      doorH - GAP_FRENTE,
      numDoors,
      'frente',
    );
  }

  // --- Drawers ---
  if (hasDrawers && numDrawers > 0) {
    const drawerH_in = drawerSectionHeightIn > 0 ? drawerSectionHeightIn : heightIn;
    const altoFrente   = Math.round((drawerH_in / numDrawers) * 25.4);
    const anchoCajaExt = anchoInt - GAP_CORREDERA;
    const altoCajaInt  = altoFrente - CLEARANCE_ALTO;
    const largoGuia    = D - CLEARANCE_FONDO;

    add('Frente Cajón', W - GAP_FRENTE,                 altoFrente,  numDrawers,     'frente');
    add('C.Costados',   largoGuia,                       altoCajaInt, numDrawers * 2, 'cuerpo');
    add('C.Contras',    anchoCajaExt - 2 * esp,          altoCajaInt, numDrawers * 2, 'cuerpo');
    add('C.Piso',       anchoCajaExt,                    largoGuia,   numDrawers,     'cuerpo');
  }

  return pieces;
}
