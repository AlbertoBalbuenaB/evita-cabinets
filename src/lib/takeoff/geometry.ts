import type { PdfPoint, MeasurementUnit, Calibration } from './types';

export function euclideanDistance(a: PdfPoint, b: PdfPoint): number {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
}

export function midpoint(a: PdfPoint, b: PdfPoint): PdfPoint {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function rectDimensions(a: PdfPoint, b: PdfPoint): { width: number; height: number } {
  return { width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y) };
}

export function polylineLength(points: PdfPoint[]): { segments: number[]; total: number } {
  const segments: number[] = [];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const d = euclideanDistance(points[i - 1], points[i]);
    segments.push(d);
    total += d;
  }
  return { segments, total };
}

export function toRealWorld(pxDist: number, calibration: Calibration): number {
  return pxDist / calibration.pixelsPerUnit;
}

// ── Angle ────────────────────────────────────────────────────

export function angleBetweenPoints(a: PdfPoint, vertex: PdfPoint, c: PdfPoint): number {
  const v1 = { x: a.x - vertex.x, y: a.y - vertex.y };
  const v2 = { x: c.x - vertex.x, y: c.y - vertex.y };
  const dot = v1.x * v2.x + v1.y * v2.y;
  const cross = v1.x * v2.y - v1.y * v2.x;
  const rad = Math.atan2(Math.abs(cross), dot);
  return rad * (180 / Math.PI);
}

// ── Polygon area (shoelace formula) ──────────────────────────

export function polygonArea(points: PdfPoint[]): number {
  if (points.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  return Math.abs(area) / 2;
}

export function polygonPerimeter(points: PdfPoint[]): number {
  let perimeter = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    perimeter += euclideanDistance(points[i], points[j]);
  }
  return perimeter;
}

export function polygonCentroid(points: PdfPoint[]): PdfPoint {
  let cx = 0, cy = 0;
  for (const p of points) { cx += p.x; cy += p.y; }
  return { x: cx / points.length, y: cy / points.length };
}

// ── Snap ─────────────────────────────────────────────────────

export function snapPoint(pt: PdfPoint, anchor: PdfPoint, snapAngle: number = 45): PdfPoint {
  const dx = pt.x - anchor.x;
  const dy = pt.y - anchor.y;
  const angle = Math.atan2(dy, dx);
  const dist = Math.sqrt(dx * dx + dy * dy);
  const snapRad = (snapAngle * Math.PI) / 180;
  const snapped = Math.round(angle / snapRad) * snapRad;
  return {
    x: anchor.x + dist * Math.cos(snapped),
    y: anchor.y + dist * Math.sin(snapped),
  };
}

// ── Formatting ───────────────────────────────────────────────

export function formatMeasurement(value: number, unit: MeasurementUnit): string {
  if (unit === 'ft') {
    const feet = Math.floor(value);
    const inches = (value - feet) * 12;
    if (feet === 0) return `${inches.toFixed(1)}"`;
    return `${feet}'-${inches.toFixed(1)}"`;
  }
  const precision = unit === 'mm' ? 0 : unit === 'cm' ? 1 : 2;
  const suffix = { in: '"', cm: ' cm', mm: ' mm' }[unit];
  return value.toFixed(precision) + suffix;
}

export function formatArea(value: number, unit: MeasurementUnit): string {
  // Auto-escalar a unidades útiles para takeoff: sq in → sq ft; sq cm/mm → sq m.
  if (unit === 'in' && value >= 144) {
    return (value / 144).toFixed(2) + ' sq ft';
  }
  if (unit === 'cm' && value >= 10_000) {
    return (value / 10_000).toFixed(2) + ' sq m';
  }
  if (unit === 'mm' && value >= 1_000_000) {
    return (value / 1_000_000).toFixed(2) + ' sq m';
  }
  const suffix = { in: ' sq in', ft: ' sq ft', cm: ' sq cm', mm: ' sq mm' }[unit];
  const precision = unit === 'mm' ? 0 : unit === 'cm' ? 1 : 2;
  return value.toFixed(precision) + suffix;
}

export function formatAngle(degrees: number): string {
  return `${degrees.toFixed(1)}°`;
}

const toMm: Record<MeasurementUnit, number> = { mm: 1, cm: 10, in: 25.4, ft: 304.8 };

export function convertUnit(value: number, from: MeasurementUnit, to: MeasurementUnit): number {
  return (value * toMm[from]) / toMm[to];
}
