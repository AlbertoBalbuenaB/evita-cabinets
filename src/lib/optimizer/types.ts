// ─────────────────────────────────────────────────────────────
// OPTIMIZER TYPES
// Naming convention:
//   Spanish: domain data (ancho, alto, grosor, material, nombre)
//   English:  algorithmic / structural (boards, pieces, placed, score)
// ─────────────────────────────────────────────────────────────

export interface Pieza {
  id: string;
  nombre: string;
  material: string;
  grosor: number;
  ancho: number;    // mm
  alto: number;     // mm
  cantidad: number;
  vetaHorizontal: boolean;
  /** Edge banding per side: 0=none, 1=type A, 2=type B, 3=type C */
  cubrecanto: {
    sup: number;
    inf: number;
    izq: number;
    der: number;
  };
  /** Project area grouping (e.g. "Kitchen", "Closet") */
  area?: string;
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
}

export interface OptimizationResult {
  boards: BoardResult[];
  totalPieces: number;
  efficiency: number;    // 0-100
  totalCost: number;
  timeMs: number;
  strategy: string;
  usefulOffcuts: number;
}

export interface CutStep {
  n: number;
  type: 'H' | 'V';
  pos: number;
  desc: string;
  isTrim?: boolean;
}

export type OptimizerTab = 'boards' | 'cutlist' | 'summary';

/** Display unit system — the engine always stores and computes in mm internally */
export type UnitSystem = 'mm' | 'in';

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
