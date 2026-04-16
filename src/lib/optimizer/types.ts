// ─────────────────────────────────────────────────────────────
// OPTIMIZER TYPES
// Naming convention:
//   Spanish: domain data (ancho, alto, grosor, material, nombre)
//   English:  algorithmic / structural (boards, pieces, placed, score)
// ─────────────────────────────────────────────────────────────

import type { Cubrecanto } from '../../types';

export interface Pieza {
  id: string;
  nombre: string;
  material: string;
  grosor: number;
  ancho: number;    // mm
  alto: number;     // mm
  cantidad: number;
  /** Grain direction: 'none'=free rotation, 'horizontal'=along width, 'vertical'=along height */
  veta: 'none' | 'horizontal' | 'vertical';
  /** Edge banding per side: 0=none, 1=type A, 2=type B, 3=type C */
  cubrecanto: Cubrecanto;
  /** Project area grouping (e.g. "Kitchen", "Closet") */
  area?: string;
  /** Quotation-pricing tagging: cabinet this piece belongs to (for attribution) */
  cabinetId?: string;
  /** Quotation-pricing tagging: project_areas.id (for per-area board attribution) */
  areaId?: string;
  /** Quotation-pricing tagging: original CutPiece role for cost-side mapping */
  cutPieceRole?: 'cuerpo' | 'frente' | 'back' | 'drawer_box' | 'shelf' | 'custom' | 'interior-finish';
  /** Quotation-pricing tagging: source CutPiece.id for traceability back to template */
  sourceCutPieceId?: string;
  // internal index assigned before optimization
  _idx?: number;
}

export interface StockSize {
  id: string;
  nombre: string;
  ancho: number;    // mm
  alto: number;     // mm
  costo: number;
  sierra: number;   // kerf mm
  /** Price list item ID for material tracking */
  materialId?: string;
  /** Max available sheets (0 or undefined = unlimited) */
  qty?: number;
}

export interface Remnant {
  id: string;
  material: string;
  grosor: number;
  ancho: number;
  alto: number;
  _used?: boolean;
}

export interface PlacedPiece {
  piece: Pieza;
  x: number;
  y: number;
  w: number;
  h: number;
  rotated: boolean;
  idx: number;
}

export interface FreeRectData {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface BoardResult {
  ancho: number;
  alto: number;
  sierra: number;
  material: string;
  grosor: number;
  stockInfo: {
    nombre: string;
    costo: number;
    isRemnant: boolean;
  };
  placed: PlacedPiece[];
  offcuts: FreeRectData[];
  // computed
  areaTotal: number;   // m²
  areaUsed: number;    // m²
  areaWaste: number;   // m²
  usage: number;       // 0-100
  trim: number;        // trim de bordes aplicado (mm)
  /** Guillotine cut tree — present only when the guillotine engine produced this board.
   *  Used by generateCutSequence() to emit valid panel-saw cut sequences.
   *  Undefined for boards produced by the MaxRect engine. */
  cutTree?: CutTreeNode;
}

/** A single guillotine cut separating two sub-rectangles. */
export interface GuillotineCut {
  type: 'H' | 'V';
  /** Absolute position of the cut line on the board (mm). */
  pos: number;
  /** true = this cut separates the piece from remaining space. */
  isPieceCut: boolean;
}

/** Node in a guillotine cut tree.
 *  Leaf nodes: piece !== null, cut/left/right are null.
 *  Internal nodes: cut !== null, left/right are child subtrees.
 *  Convention: left = piece-containing / denser subtree; right = free remainder. */
export interface CutTreeNode {
  x: number; y: number; w: number; h: number; // absolute rect on the board (mm)
  piece: PlacedPiece | null;
  cut: GuillotineCut | null;
  left: CutTreeNode | null;
  right: CutTreeNode | null;
}

export interface OptimizationResult {
  boards: BoardResult[];
  totalPieces: number;
  efficiency: number;    // 0-100
  totalCost: number;
  timeMs: number;
  strategy: string;
  usefulOffcuts: number;
  /** Pieces that could not be placed on any board (name × dims × count).
   *  Absent on results saved before this field was added. */
  unplacedPieces?: { nombre: string; ancho: number; alto: number; count: number }[];
}

export interface CutStep {
  n: number;
  type: 'H' | 'V';
  pos: number;
  desc: string;
  isTrim?: boolean;
}

export type OptimizerTab = 'setup' | 'results';

/** Display unit system — the engine always stores and computes in mm internally */
export type UnitSystem = 'mm' | 'in';

/** Which packing engine(s) to run.
 *  'guillotine' = only guillotine (panel-saw valid cuts, default).
 *  'both'       = run MaxRect in parallel and pick whichever scores better. */
export type EngineMode = 'guillotine' | 'both';

/** What the optimizer score function should minimize.
 *  'min-boards' — fewest boards used (default, lowest material cost).
 *  'min-waste'  — lowest waste %; may accept one extra board for better efficiency.
 *  'min-cuts'   — fewest panel-saw operations; useful when labor time is the constraint. */
export type OptimizationObjective = 'min-boards' | 'min-waste' | 'min-cuts';

export interface EbTypeConfig {
  id: string;        // price_list item ID (empty = not configured)
  name: string;      // concept_description
  price: number;     // price per meter
}

export interface EbConfig {
  a: EbTypeConfig;
  b: EbTypeConfig;
  c: EbTypeConfig;
}

/**
 * Per-cabinet edgeband price lookup.
 *
 * Maps cabinetId → cubrecanto code → edgeband info. This replaces the
 * 3-fixed-slot system for pricing purposes — each piece is priced at its
 * cabinet's actual edgeband assignment instead of a single global rate
 * per slot. Supports N distinct edgeband types across a quotation.
 *
 * Cubrecanto codes: 1 = box construction, 2 = doors/fronts.
 * (Future: 3 = drawer box, 4 = shelf.)
 */
export type EbCabinetMap = Record<string, Record<number, {
  pricePerMeter: number;
  plId: string;
  name: string;
}>>;

/** Summary of all distinct edgeband types found across a quotation. */
export interface EbTypeSummary {
  name: string;
  pricePerMeter: number;
  plId: string;
  roles: ('box' | 'doors')[];
}
