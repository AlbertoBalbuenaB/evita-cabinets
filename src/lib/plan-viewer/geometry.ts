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
  const suffix = { in: ' sq in', ft: ' sq ft', cm: ' sq cm', mm: ' sq mm' }[unit];
  const precision = unit === 'mm' ? 0 : unit === 'cm' ? 1 : 2;
  return value.toFixed(precision) + suffix;
}

const toMm: Record<MeasurementUnit, number> = { mm: 1, cm: 10, in: 25.4, ft: 304.8 };

export function convertUnit(value: number, from: MeasurementUnit, to: MeasurementUnit): number {
  return (value * toMm[from]) / toMm[to];
}
