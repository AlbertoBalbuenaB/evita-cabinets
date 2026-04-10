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
export type ToolMode = 'pan' | 'calibrate' | 'line' | 'multiline' | 'rectangle';

// ── Measurements ─────────────────────────────────────────────
interface BaseMeasurement {
  id: string;
  name: string;
  type: 'line' | 'multiline' | 'rectangle';
  color: string;
  page: number;
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

export type Measurement = LineMeasurement | MultilineMeasurement | RectangleMeasurement;

// ── Undo/Redo ────────────────────────────────────────────────
export type UndoableAction =
  | { type: 'ADD_MEASUREMENT'; measurement: Measurement }
  | { type: 'DELETE_MEASUREMENT'; measurement: Measurement; index: number }
  | { type: 'SET_CALIBRATION'; prev: Calibration | null; next: Calibration }
  | { type: 'CLEAR_ALL'; measurements: Measurement[] };
