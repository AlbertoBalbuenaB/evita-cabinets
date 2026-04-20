// ── Units ────────────────────────────────────────────────────
export type MeasurementUnit = 'in' | 'ft' | 'cm' | 'mm';

// ── Coordinate spaces ────────────────────────────────────────
export interface PdfPoint {
  x: number;
  y: number;
}

// ── Viewport ─────────────────────────────────────────────────
export interface ViewportState {
  zoom: number;
  offsetX: number;
  offsetY: number;
}

// ── Calibration ──────────────────────────────────────────────
export interface Calibration {
  pointA: PdfPoint;
  pointB: PdfPoint;
  pxDistance: number;
  realDistance: number;
  unit: MeasurementUnit;
  pixelsPerUnit: number;
}

// ── Tools ────────────────────────────────────────────────────
export type ToolMode =
  | 'pan'
  | 'select'
  | 'calibrate'
  | 'line'
  | 'multiline'
  | 'rectangle'
  | 'angle'
  | 'polygon'
  | 'count'
  | 'cutout'
  | 'annotate';

// ── Categories (takeoff layers: Base Cab, Wall Cab, Countertop, etc.) ─
export interface Category {
  id: string;
  name: string;
  color: string; // hex — also used as default color for measurements assigned to this category
}

// ── Selection handles ────────────────────────────────────────
// Identifies which vertex/corner of a measurement is being dragged.
// For rectangles the 4 virtual corners (tl/tr/bl/br) are derived from
// cornerA/cornerB even if those weren't stored as the top-left/bottom-right pair.
export type HandleKey =
  | 'pointA'
  | 'pointB'
  | 'vertex'
  | 'pointC'
  | 'tl'
  | 'tr'
  | 'bl'
  | 'br'
  | `points[${number}]`;

// ── Measurements ─────────────────────────────────────────────
interface BaseMeasurement {
  id: string;
  name: string;
  type: 'line' | 'multiline' | 'rectangle' | 'angle' | 'polygon' | 'count' | 'cutout';
  color: string;
  page: number;
  group?: string;
  categoryId?: string | null;
}

export interface LineMeasurement extends BaseMeasurement {
  type: 'line';
  pointA: PdfPoint;
  pointB: PdfPoint;
  pxLength: number;
  realLength: number;
  unit: MeasurementUnit;
}

export interface MultilineMeasurement extends BaseMeasurement {
  type: 'multiline';
  points: PdfPoint[];
  segments: number[];
  totalPxLength: number;
  totalRealLength: number;
  unit: MeasurementUnit;
}

export interface RectangleMeasurement extends BaseMeasurement {
  type: 'rectangle';
  cornerA: PdfPoint;
  cornerB: PdfPoint;
  pxWidth: number;
  pxHeight: number;
  realWidth: number;
  realHeight: number;
  realArea: number;
  unit: MeasurementUnit;
}

export interface AngleMeasurement extends BaseMeasurement {
  type: 'angle';
  pointA: PdfPoint;
  vertex: PdfPoint;
  pointC: PdfPoint;
  degrees: number;
}

export interface PolygonMeasurement extends BaseMeasurement {
  type: 'polygon';
  points: PdfPoint[];
  pxPerimeter: number;
  pxArea: number;
  realPerimeter: number;
  realArea: number;
  unit: MeasurementUnit;
}

export interface CountMeasurement extends BaseMeasurement {
  type: 'count';
  position: PdfPoint;
  number: number; // sequential label within its category (1-based)
  unit: MeasurementUnit; // unused for counts, kept to match the union shape
}

export interface CutoutMeasurement extends BaseMeasurement {
  type: 'cutout';
  parentId: string; // id of the RectangleMeasurement or PolygonMeasurement this cutout subtracts from
  shape: 'rectangle'; // only rectangular cutouts for now; polygon cutouts can come later
  cornerA: PdfPoint;
  cornerB: PdfPoint;
  pxWidth: number;
  pxHeight: number;
  realWidth: number;
  realHeight: number;
  realArea: number;
  unit: MeasurementUnit;
}

export type Measurement =
  | LineMeasurement
  | MultilineMeasurement
  | RectangleMeasurement
  | AngleMeasurement
  | PolygonMeasurement
  | CountMeasurement
  | CutoutMeasurement;

// ── Annotations ──────────────────────────────────────────────
export interface Annotation {
  id: string;
  text: string;
  position: PdfPoint;
  color: string;
  page: number;
}

// ── Undo/Redo ────────────────────────────────────────────────
export type UndoableAction =
  | { type: 'ADD_MEASUREMENT'; measurement: Measurement }
  | { type: 'DELETE_MEASUREMENT'; measurement: Measurement; index: number }
  | { type: 'SET_CALIBRATION'; page: number; prev: Calibration | null; next: Calibration }
  | { type: 'CLEAR_ALL'; measurements: Measurement[] }
  | { type: 'ADD_ANNOTATION'; annotation: Annotation }
  | { type: 'DELETE_ANNOTATION'; annotation: Annotation; index: number }
  | { type: 'REPLACE_MEASUREMENT'; prev: Measurement; next: Measurement };

// ── Session ──────────────────────────────────────────────────
export interface SessionData {
  calibrations: Record<number, Calibration>;
  measurements: Measurement[];
  annotations: Annotation[];
  unit: MeasurementUnit;
  groups: string[];
  categories?: Category[]; // optional for backward compat with pre-PR-3 sessions
}
