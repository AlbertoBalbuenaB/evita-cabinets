import type { Measurement, PdfPoint, Calibration, HandleKey } from './types';
import { euclideanDistance, polylineLength, polygonArea, polygonPerimeter, angleBetweenPoints } from './geometry';

// Translate every point of a measurement by (dx, dy). Lengths/areas/angles
// are translation-invariant, so derived values are left untouched.
export function translateMeasurement(m: Measurement, dx: number, dy: number): Measurement {
  const t = (p: PdfPoint): PdfPoint => ({ x: p.x + dx, y: p.y + dy });
  if (m.type === 'line') return { ...m, pointA: t(m.pointA), pointB: t(m.pointB) };
  if (m.type === 'multiline') return { ...m, points: m.points.map(t) };
  if (m.type === 'rectangle') return { ...m, cornerA: t(m.cornerA), cornerB: t(m.cornerB) };
  if (m.type === 'angle') return { ...m, pointA: t(m.pointA), vertex: t(m.vertex), pointC: t(m.pointC) };
  if (m.type === 'polygon') return { ...m, points: m.points.map(t) };
  return m;
}

// Update a single handle/vertex and recompute derived values (lengths, areas, angles).
export function updateMeasurementHandle(
  m: Measurement,
  handleKey: HandleKey,
  newPt: PdfPoint,
  cal: Calibration,
): Measurement {
  const ppu = cal.pixelsPerUnit;

  if (m.type === 'line') {
    const pointA = handleKey === 'pointA' ? newPt : m.pointA;
    const pointB = handleKey === 'pointB' ? newPt : m.pointB;
    const pxLength = euclideanDistance(pointA, pointB);
    return { ...m, pointA, pointB, pxLength, realLength: pxLength / ppu };
  }

  if (m.type === 'multiline') {
    const idx = parsePointIndex(handleKey);
    if (idx === null) return m;
    const points = m.points.map((p, i) => (i === idx ? newPt : p));
    const { segments, total } = polylineLength(points);
    return {
      ...m,
      points,
      segments: segments.map((s) => s / ppu),
      totalPxLength: total,
      totalRealLength: total / ppu,
    };
  }

  if (m.type === 'rectangle') {
    const xMin = Math.min(m.cornerA.x, m.cornerB.x);
    const xMax = Math.max(m.cornerA.x, m.cornerB.x);
    const yMin = Math.min(m.cornerA.y, m.cornerB.y);
    const yMax = Math.max(m.cornerA.y, m.cornerB.y);

    let cornerA: PdfPoint = m.cornerA;
    let cornerB: PdfPoint = m.cornerB;
    if (handleKey === 'tl') { cornerA = newPt; cornerB = { x: xMax, y: yMax }; }
    else if (handleKey === 'tr') { cornerA = { x: xMin, y: newPt.y }; cornerB = { x: newPt.x, y: yMax }; }
    else if (handleKey === 'bl') { cornerA = { x: newPt.x, y: yMin }; cornerB = { x: xMax, y: newPt.y }; }
    else if (handleKey === 'br') { cornerA = { x: xMin, y: yMin }; cornerB = newPt; }
    else return m;

    const pxWidth = Math.abs(cornerB.x - cornerA.x);
    const pxHeight = Math.abs(cornerB.y - cornerA.y);
    const realWidth = pxWidth / ppu;
    const realHeight = pxHeight / ppu;
    return { ...m, cornerA, cornerB, pxWidth, pxHeight, realWidth, realHeight, realArea: realWidth * realHeight };
  }

  if (m.type === 'angle') {
    const pointA = handleKey === 'pointA' ? newPt : m.pointA;
    const vertex = handleKey === 'vertex' ? newPt : m.vertex;
    const pointC = handleKey === 'pointC' ? newPt : m.pointC;
    return { ...m, pointA, vertex, pointC, degrees: angleBetweenPoints(pointA, vertex, pointC) };
  }

  if (m.type === 'polygon') {
    const idx = parsePointIndex(handleKey);
    if (idx === null) return m;
    const points = m.points.map((p, i) => (i === idx ? newPt : p));
    const pxPerimeter = polygonPerimeter(points);
    const pxArea = polygonArea(points);
    return {
      ...m,
      points,
      pxPerimeter,
      pxArea,
      realPerimeter: pxPerimeter / ppu,
      realArea: pxArea / (ppu * ppu),
    };
  }

  return m;
}

function parsePointIndex(key: HandleKey): number | null {
  const m = /^points\[(\d+)\]$/.exec(key);
  return m ? parseInt(m[1], 10) : null;
}
