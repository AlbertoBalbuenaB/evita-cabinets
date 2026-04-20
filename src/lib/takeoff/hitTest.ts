import type { Measurement, PdfPoint, HandleKey } from './types';

// ── Geometry primitives ──────────────────────────────────────

function pointToSegmentDistance(p: PdfPoint, a: PdfPoint, b: PdfPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function pointInPolygon(p: PdfPoint, points: PdfPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i].x, yi = points[i].y;
    const xj = points[j].x, yj = points[j].y;
    const intersect = yi > p.y !== yj > p.y &&
      p.x < ((xj - xi) * (p.y - yi)) / (yj - yi || 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function pointInRect(p: PdfPoint, a: PdfPoint, b: PdfPoint): boolean {
  const xMin = Math.min(a.x, b.x);
  const xMax = Math.max(a.x, b.x);
  const yMin = Math.min(a.y, b.y);
  const yMax = Math.max(a.y, b.y);
  return p.x >= xMin && p.x <= xMax && p.y >= yMin && p.y <= yMax;
}

// ── Body hit-tests ───────────────────────────────────────────

function hitTestBody(p: PdfPoint, m: Measurement, threshold: number): boolean {
  if (m.type === 'line') {
    return pointToSegmentDistance(p, m.pointA, m.pointB) <= threshold;
  }
  if (m.type === 'multiline') {
    for (let i = 1; i < m.points.length; i++) {
      if (pointToSegmentDistance(p, m.points[i - 1], m.points[i]) <= threshold) return true;
    }
    return false;
  }
  if (m.type === 'rectangle' || m.type === 'cutout') {
    return pointInRect(p, m.cornerA, m.cornerB);
  }
  if (m.type === 'angle') {
    return pointToSegmentDistance(p, m.vertex, m.pointA) <= threshold
        || pointToSegmentDistance(p, m.vertex, m.pointC) <= threshold;
  }
  if (m.type === 'polygon') {
    if (pointInPolygon(p, m.points)) return true;
    // Also pick on the edge (helps if polygon is narrow / user clicks near edge)
    for (let i = 0; i < m.points.length; i++) {
      const j = (i + 1) % m.points.length;
      if (pointToSegmentDistance(p, m.points[i], m.points[j]) <= threshold) return true;
    }
    return false;
  }
  if (m.type === 'count') {
    // Count pin: generous hit radius (the visible pin is ~10px; we allow a bit more to feel forgiving).
    return Math.hypot(p.x - m.position.x, p.y - m.position.y) <= Math.max(threshold, 12);
  }
  return false;
}

// ── Handle positions ─────────────────────────────────────────

export function getHandlePositions(m: Measurement): { key: HandleKey; pt: PdfPoint }[] {
  if (m.type === 'line') {
    return [
      { key: 'pointA', pt: m.pointA },
      { key: 'pointB', pt: m.pointB },
    ];
  }
  if (m.type === 'multiline' || m.type === 'polygon') {
    return m.points.map((p, i) => ({ key: `points[${i}]` as HandleKey, pt: p }));
  }
  if (m.type === 'rectangle' || m.type === 'cutout') {
    const xMin = Math.min(m.cornerA.x, m.cornerB.x);
    const xMax = Math.max(m.cornerA.x, m.cornerB.x);
    const yMin = Math.min(m.cornerA.y, m.cornerB.y);
    const yMax = Math.max(m.cornerA.y, m.cornerB.y);
    return [
      { key: 'tl', pt: { x: xMin, y: yMin } },
      { key: 'tr', pt: { x: xMax, y: yMin } },
      { key: 'bl', pt: { x: xMin, y: yMax } },
      { key: 'br', pt: { x: xMax, y: yMax } },
    ];
  }
  if (m.type === 'angle') {
    return [
      { key: 'pointA', pt: m.pointA },
      { key: 'vertex', pt: m.vertex },
      { key: 'pointC', pt: m.pointC },
    ];
  }
  // Count pins have no resize handles — you just drag the body to reposition them.
  return [];
}

function pickHandle(p: PdfPoint, m: Measurement, threshold: number): HandleKey | null {
  let best: { key: HandleKey; dist: number } | null = null;
  for (const { key, pt } of getHandlePositions(m)) {
    const d = Math.hypot(p.x - pt.x, p.y - pt.y);
    if (d <= threshold && (!best || d < best.dist)) best = { key, dist: d };
  }
  return best?.key ?? null;
}

// ── Combined pick ────────────────────────────────────────────

export type HitResult =
  | { kind: 'handle'; measurementId: string; handleKey: HandleKey }
  | { kind: 'body'; measurementId: string }
  | null;

export function pickAt(
  p: PdfPoint,
  measurements: Measurement[],
  selectedId: string | null,
  bodyThreshold: number,
  handleThreshold: number,
): HitResult {
  // Handles of the currently selected measurement win over body picks,
  // so the user can grab a handle even if it sits on top of another shape.
  if (selectedId) {
    const m = measurements.find((x) => x.id === selectedId);
    if (m) {
      const hk = pickHandle(p, m, handleThreshold);
      if (hk) return { kind: 'handle', measurementId: m.id, handleKey: hk };
    }
  }
  for (let i = measurements.length - 1; i >= 0; i--) {
    const m = measurements[i];
    if (hitTestBody(p, m, bodyThreshold)) {
      return { kind: 'body', measurementId: m.id };
    }
  }
  return null;
}
