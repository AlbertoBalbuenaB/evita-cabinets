import { forwardRef } from 'react';
import { useTakeoffStore } from '../../hooks/useTakeoffStore';
import { midpoint, formatMeasurement, formatArea, formatAngle, polygonCentroid, convertUnit } from '../../lib/takeoff/geometry';
import { getHandlePositions } from '../../lib/takeoff/hitTest';
import { resolveMeasurementColor } from '../../lib/takeoff/categories';
import type {
  ViewportState,
  PdfPoint,
  Measurement,
  LineMeasurement,
  MultilineMeasurement,
  RectangleMeasurement,
  AngleMeasurement,
  PolygonMeasurement,
  CountMeasurement,
  CutoutMeasurement,
  MeasurementUnit,
  Annotation,
} from '../../lib/takeoff/types';

interface MeasurementOverlayProps {
  canvasWidth: number;
  canvasHeight: number;
  viewport: ViewportState;
  renderScale: number;
  cursorPos: PdfPoint | null;
}

export const MeasurementOverlay = forwardRef<SVGSVGElement, MeasurementOverlayProps>(
  function MeasurementOverlay({ viewport, renderScale, cursorPos }, ref) {
    const {
      measurements,
      calibrations,
      annotations,
      activePoints,
      activeTool,
      showCrosshair,
      showGrid,
      currentPage,
      selectedMeasurementId,
      unit,
      categories,
    } = useTakeoffStore();

    const scale = viewport.zoom * renderScale;
    const inv = 1 / scale;
    const calibration = calibrations[currentPage] ?? null;

    // Resolve color via category override at render time — the stored m.color is the
    // fallback, categories take precedence for assigned measurements.
    const pageMeasurements = measurements
      .filter((m) => m.page === currentPage)
      .map((m) => ({ ...m, color: resolveMeasurementColor(m, categories) }));
    const pageAnnotations = annotations.filter((a) => a.page === currentPage);
    const selectedMeasurement = selectedMeasurementId
      ? pageMeasurements.find((m) => m.id === selectedMeasurementId) ?? null
      : null;

    return (
      <svg
        ref={ref}
        className="absolute inset-0 pointer-events-none"
        style={{ width: '100%', height: '100%' }}
      >
        {/* Crosshair */}
        {showCrosshair && cursorPos && activeTool !== 'pan' && activeTool !== 'annotate' && (
          <g>
            <line
              x1={cursorPos.x * scale + viewport.offsetX} y1={0}
              x2={cursorPos.x * scale + viewport.offsetX} y2="100%"
              stroke="#94a3b8" strokeWidth={0.5} strokeDasharray="4 4"
            />
            <line
              x1={0} y1={cursorPos.y * scale + viewport.offsetY}
              x2="100%" y2={cursorPos.y * scale + viewport.offsetY}
              stroke="#94a3b8" strokeWidth={0.5} strokeDasharray="4 4"
            />
          </g>
        )}

        {/* PDF-space group */}
        <g transform={`translate(${viewport.offsetX},${viewport.offsetY}) scale(${scale})`}>
          {/* Grid overlay */}
          {showGrid && calibration && <GridOverlay calibration={calibration} inv={inv} unit={unit} />}

          {/* Calibration line */}
          {calibration && (
            <g>
              <line
                x1={calibration.pointA.x} y1={calibration.pointA.y}
                x2={calibration.pointB.x} y2={calibration.pointB.y}
                stroke="#16a34a" strokeWidth={2 * inv}
                strokeDasharray={`${6 * inv} ${4 * inv}`}
              />
              <circle cx={calibration.pointA.x} cy={calibration.pointA.y} r={4 * inv} fill="#16a34a" />
              <circle cx={calibration.pointB.x} cy={calibration.pointB.y} r={4 * inv} fill="#16a34a" />
              <Label
                pt={midpoint(calibration.pointA, calibration.pointB)}
                text={formatMeasurement(calibration.realDistance, calibration.unit)}
                inv={inv} color="#16a34a" bg="#dcfce7"
              />
            </g>
          )}

          {/* Measurements */}
          {pageMeasurements.map((m) => (
            <MeasurementShape
              key={m.id} measurement={m} inv={inv}
              selected={m.id === selectedMeasurementId} displayUnit={unit}
            />
          ))}

          {/* Annotations */}
          {pageAnnotations.map((a) => (
            <AnnotationLabel key={a.id} annotation={a} inv={inv} />
          ))}

          {/* Active preview */}
          {activePoints.length > 0 && cursorPos && activeTool !== 'pan' && activeTool !== 'annotate' && activeTool !== 'select' && (
            <ActivePreview points={activePoints} cursor={cursorPos} tool={activeTool} inv={inv} />
          )}

          {/* Selection handles (only rendered when Select tool is active) */}
          {selectedMeasurement && activeTool === 'select' && (
            <SelectionHandles m={selectedMeasurement} inv={inv} />
          )}
        </g>
      </svg>
    );
  }
);

// ── Selection handles ────────────────────────────────────────

function SelectionHandles({ m, inv }: { m: Measurement; inv: number }) {
  const handles = getHandlePositions(m);
  const color = m.color;
  const r = 5 * inv;
  return (
    <g>
      {handles.map(({ key, pt }) => (
        <circle
          key={key}
          cx={pt.x}
          cy={pt.y}
          r={r}
          fill="white"
          stroke={color}
          strokeWidth={1.5 * inv}
        />
      ))}
    </g>
  );
}

// ── Grid ─────────────────────────────────────────────────────

function GridOverlay({ calibration, inv, unit }: { calibration: { pixelsPerUnit: number }; inv: number; unit: MeasurementUnit }) {
  const ppu = calibration.pixelsPerUnit;
  // 1 unit grid spacing, max 200 lines
  let spacing = ppu;
  if (unit === 'ft') spacing = ppu; // 1 foot
  else if (unit === 'mm') spacing = ppu * 10; // 10mm = 1cm
  else if (unit === 'cm') spacing = ppu * 10; // 10cm
  else spacing = ppu * 12; // 12 inches = 1 foot

  if (spacing < 20 * inv) spacing *= 5;
  const count = 200;

  const lines = [];
  for (let i = -count; i <= count; i++) {
    const pos = i * spacing;
    lines.push(
      <line key={`v${i}`} x1={pos} y1={-count * spacing} x2={pos} y2={count * spacing}
        stroke="#cbd5e1" strokeWidth={0.5 * inv} opacity={0.4} />,
      <line key={`h${i}`} x1={-count * spacing} y1={pos} x2={count * spacing} y2={pos}
        stroke="#cbd5e1" strokeWidth={0.5 * inv} opacity={0.4} />
    );
  }
  return <g>{lines}</g>;
}

// ── Annotation ───────────────────────────────────────────────

function AnnotationLabel({ annotation: a, inv }: { annotation: Annotation; inv: number }) {
  const fontSize = 12 * inv;
  const px = 5 * inv;
  const py = 3 * inv;
  return (
    <g transform={`translate(${a.position.x},${a.position.y})`}>
      <rect
        x={-px} y={-fontSize - py}
        width={(a.text.length * 0.55 + 1.5) * fontSize + px * 2}
        height={fontSize + py * 2}
        rx={3 * inv}
        fill={a.color + '20'} stroke={a.color} strokeWidth={inv}
      />
      <text x={0} y={-py} fontSize={fontSize} fill={a.color} fontWeight={700} fontFamily="system-ui, sans-serif">
        {a.text}
      </text>
    </g>
  );
}

// ── Measurement shapes ───────────────────────────────────────

function MeasurementShape({ measurement: m, inv, selected, displayUnit }: {
  measurement: Measurement; inv: number; selected: boolean; displayUnit: string;
}) {
  const sw = (selected ? 3 : 2) * inv;
  if (m.type === 'line') return <LineShape m={m} inv={inv} sw={sw} displayUnit={displayUnit} />;
  if (m.type === 'multiline') return <MultilineShape m={m} inv={inv} sw={sw} displayUnit={displayUnit} />;
  if (m.type === 'rectangle') return <RectShape m={m} inv={inv} sw={sw} displayUnit={displayUnit} />;
  if (m.type === 'angle') return <AngleShape m={m} inv={inv} sw={sw} />;
  if (m.type === 'polygon') return <PolygonShape m={m} inv={inv} sw={sw} displayUnit={displayUnit} />;
  if (m.type === 'count') return <CountShape m={m} inv={inv} selected={selected} />;
  if (m.type === 'cutout') return <CutoutShape m={m} inv={inv} sw={sw} displayUnit={displayUnit} />;
  return null;
}

function LineShape({ m, inv, sw, displayUnit }: { m: LineMeasurement; inv: number; sw: number; displayUnit: string }) {
  const mid = midpoint(m.pointA, m.pointB);
  const val = displayUnit === m.unit ? m.realLength : convertUnit(m.realLength, m.unit, displayUnit as MeasurementUnit);
  return (
    <g>
      <line x1={m.pointA.x} y1={m.pointA.y} x2={m.pointB.x} y2={m.pointB.y} stroke={m.color} strokeWidth={sw} />
      <circle cx={m.pointA.x} cy={m.pointA.y} r={3 * inv} fill={m.color} />
      <circle cx={m.pointB.x} cy={m.pointB.y} r={3 * inv} fill={m.color} />
      <Label pt={mid} text={formatMeasurement(val, displayUnit as MeasurementUnit)} inv={inv} color={m.color} />
    </g>
  );
}

function MultilineShape({ m, inv, sw, displayUnit }: { m: MultilineMeasurement; inv: number; sw: number; displayUnit: string }) {
  const pts = m.points.map((p) => `${p.x},${p.y}`).join(' ');
  const last = m.points[m.points.length - 1];
  const val = displayUnit === m.unit ? m.totalRealLength : convertUnit(m.totalRealLength, m.unit, displayUnit as MeasurementUnit);
  return (
    <g>
      <polyline points={pts} fill="none" stroke={m.color} strokeWidth={sw} strokeLinejoin="round" />
      {m.points.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={3 * inv} fill={m.color} />)}
      <Label pt={last} text={formatMeasurement(val, displayUnit as MeasurementUnit)} inv={inv} color={m.color} offsetY={-12} />
    </g>
  );
}

function RectShape({ m, inv, sw, displayUnit }: { m: RectangleMeasurement; inv: number; sw: number; displayUnit: string }) {
  const x = Math.min(m.cornerA.x, m.cornerB.x);
  const y = Math.min(m.cornerA.y, m.cornerB.y);
  const w = Math.abs(m.cornerB.x - m.cornerA.x);
  const h = Math.abs(m.cornerB.y - m.cornerA.y);
  const center: PdfPoint = { x: x + w / 2, y: y + h / 2 };
  const f = getConversionFactor(m.unit, displayUnit);
  const du = displayUnit as MeasurementUnit;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={m.color + '10'} stroke={m.color} strokeWidth={sw} strokeDasharray={`${6 * inv} ${3 * inv}`} />
      <Label pt={{ x: center.x, y }} text={formatMeasurement(m.realWidth * f, du)} inv={inv} color={m.color} offsetY={-8} />
      <Label pt={{ x: x + w, y: center.y }} text={formatMeasurement(m.realHeight * f, du)} inv={inv} color={m.color} offsetX={8} />
      <Label pt={center} text={formatArea(m.realArea * f * f, du)} inv={inv} color={m.color} />
    </g>
  );
}

function AngleShape({ m, inv, sw }: { m: AngleMeasurement; inv: number; sw: number }) {
  const arcR = 25 * inv;
  const a1 = Math.atan2(m.pointA.y - m.vertex.y, m.pointA.x - m.vertex.x);
  const a2 = Math.atan2(m.pointC.y - m.vertex.y, m.pointC.x - m.vertex.x);
  const x1 = m.vertex.x + arcR * Math.cos(a1);
  const y1 = m.vertex.y + arcR * Math.sin(a1);
  const x2 = m.vertex.x + arcR * Math.cos(a2);
  const y2 = m.vertex.y + arcR * Math.sin(a2);
  const largeArc = m.degrees > 180 ? 1 : 0;
  // Determine sweep direction
  const cross = (m.pointA.x - m.vertex.x) * (m.pointC.y - m.vertex.y) - (m.pointA.y - m.vertex.y) * (m.pointC.x - m.vertex.x);
  const sweep = cross > 0 ? 1 : 0;
  const midAngle = (a1 + a2) / 2;
  const labelPt: PdfPoint = { x: m.vertex.x + arcR * 1.5 * Math.cos(midAngle), y: m.vertex.y + arcR * 1.5 * Math.sin(midAngle) };

  return (
    <g>
      <line x1={m.vertex.x} y1={m.vertex.y} x2={m.pointA.x} y2={m.pointA.y} stroke={m.color} strokeWidth={sw} />
      <line x1={m.vertex.x} y1={m.vertex.y} x2={m.pointC.x} y2={m.pointC.y} stroke={m.color} strokeWidth={sw} />
      <path
        d={`M ${x1} ${y1} A ${arcR} ${arcR} 0 ${largeArc} ${sweep} ${x2} ${y2}`}
        fill="none" stroke={m.color} strokeWidth={sw}
      />
      <circle cx={m.pointA.x} cy={m.pointA.y} r={3 * inv} fill={m.color} />
      <circle cx={m.vertex.x} cy={m.vertex.y} r={4 * inv} fill={m.color} />
      <circle cx={m.pointC.x} cy={m.pointC.y} r={3 * inv} fill={m.color} />
      <Label pt={labelPt} text={formatAngle(m.degrees)} inv={inv} color={m.color} />
    </g>
  );
}

function PolygonShape({ m, inv, sw, displayUnit }: { m: PolygonMeasurement; inv: number; sw: number; displayUnit: string }) {
  const pts = m.points.map((p) => `${p.x},${p.y}`).join(' ');
  const center = polygonCentroid(m.points);
  const f = getConversionFactor(m.unit, displayUnit);
  const du = displayUnit as MeasurementUnit;
  return (
    <g>
      <polygon points={pts} fill={m.color + '10'} stroke={m.color} strokeWidth={sw} strokeLinejoin="round" />
      {m.points.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={3 * inv} fill={m.color} />)}
      <Label pt={center} text={formatArea(m.realArea * f * f, du)} inv={inv} color={m.color} />
      <Label pt={center} text={formatMeasurement(m.realPerimeter * f, du)} inv={inv} color={m.color} offsetY={14} />
    </g>
  );
}

function CountShape({ m, inv, selected }: { m: CountMeasurement; inv: number; selected: boolean }) {
  const r = 14 * inv;
  const fontSize = 12 * inv;
  return (
    <g transform={`translate(${m.position.x},${m.position.y})`}>
      {selected && (
        <circle r={r + 4 * inv} fill="none" stroke={m.color} strokeWidth={1.5 * inv} strokeDasharray={`${3 * inv} ${2 * inv}`} />
      )}
      <circle r={r} fill={m.color} stroke="white" strokeWidth={2 * inv} />
      <text
        x={0}
        y={fontSize * 0.36}
        fontSize={fontSize}
        fill="white"
        fontWeight={700}
        textAnchor="middle"
        fontFamily="system-ui, sans-serif"
      >
        {m.number}
      </text>
    </g>
  );
}

function CutoutShape({ m, inv, sw, displayUnit }: { m: CutoutMeasurement; inv: number; sw: number; displayUnit: string }) {
  const x = Math.min(m.cornerA.x, m.cornerB.x);
  const y = Math.min(m.cornerA.y, m.cornerB.y);
  const w = Math.abs(m.cornerB.x - m.cornerA.x);
  const h = Math.abs(m.cornerB.y - m.cornerA.y);
  const f = getConversionFactor(m.unit, displayUnit);
  const du = displayUnit as MeasurementUnit;
  // Red-ish dashed outline + translucent fill + diagonal X to mark subtracted area.
  return (
    <g>
      <rect x={x} y={y} width={w} height={h}
        fill={m.color + '20'} stroke={m.color} strokeWidth={sw}
        strokeDasharray={`${6 * inv} ${3 * inv}`} />
      <line x1={x} y1={y} x2={x + w} y2={y + h} stroke={m.color} strokeWidth={sw * 0.6} strokeDasharray={`${3 * inv} ${3 * inv}`} />
      <line x1={x + w} y1={y} x2={x} y2={y + h} stroke={m.color} strokeWidth={sw * 0.6} strokeDasharray={`${3 * inv} ${3 * inv}`} />
      <Label pt={{ x: x + w / 2, y: y + h / 2 }} text={`− ${formatArea(m.realArea * f * f, du)}`} inv={inv} color={m.color} />
    </g>
  );
}

// ── Active preview ───────────────────────────────────────────

function ActivePreview({ points, cursor, tool, inv }: { points: PdfPoint[]; cursor: PdfPoint; tool: string; inv: number }) {
  const last = points[points.length - 1];

  if (tool === 'calibrate' && points.length === 1) {
    return (
      <g>
        <line x1={last.x} y1={last.y} x2={cursor.x} y2={cursor.y} stroke="#16a34a" strokeWidth={2 * inv} strokeDasharray={`${6 * inv} ${4 * inv}`} />
        <circle cx={last.x} cy={last.y} r={4 * inv} fill="#16a34a" />
        <circle cx={cursor.x} cy={cursor.y} r={4 * inv} fill="#16a34a" opacity={0.6} />
      </g>
    );
  }

  if ((tool === 'line' || tool === 'multiline') && points.length >= 1) {
    const allPts = [...points, cursor];
    return (
      <g>
        <polyline points={allPts.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#2563eb" strokeWidth={2 * inv} strokeDasharray={`${6 * inv} ${4 * inv}`} />
        {allPts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={3 * inv} fill="#2563eb" opacity={i === allPts.length - 1 ? 0.6 : 1} />)}
      </g>
    );
  }

  if (tool === 'rectangle' && points.length === 1) {
    const x = Math.min(last.x, cursor.x), y = Math.min(last.y, cursor.y);
    const w = Math.abs(cursor.x - last.x), h = Math.abs(cursor.y - last.y);
    return <rect x={x} y={y} width={w} height={h} fill="#2563eb10" stroke="#2563eb" strokeWidth={2 * inv} strokeDasharray={`${6 * inv} ${3 * inv}`} />;
  }

  if (tool === 'angle') {
    const allPts = [...points, cursor];
    return (
      <g>
        <polyline points={allPts.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#9333ea" strokeWidth={2 * inv} strokeDasharray={`${6 * inv} ${4 * inv}`} />
        {allPts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={3 * inv} fill="#9333ea" opacity={i === allPts.length - 1 ? 0.6 : 1} />)}
      </g>
    );
  }

  if (tool === 'polygon' && points.length >= 1) {
    const allPts = [...points, cursor];
    const ptStr = allPts.map((p) => `${p.x},${p.y}`).join(' ');
    return (
      <g>
        <polygon points={ptStr} fill="#2563eb08" stroke="#2563eb" strokeWidth={2 * inv} strokeDasharray={`${6 * inv} ${3 * inv}`} />
        {allPts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={3 * inv} fill="#2563eb" opacity={i === allPts.length - 1 ? 0.6 : 1} />)}
      </g>
    );
  }

  return null;
}

// ── Label ────────────────────────────────────────────────────

function Label({ pt, text, inv, color, bg, offsetX = 0, offsetY = 0 }: {
  pt: PdfPoint; text: string; inv: number; color: string; bg?: string; offsetX?: number; offsetY?: number;
}) {
  const fontSize = 11 * inv;
  const px = 4 * inv;
  const py = 2 * inv;
  return (
    <g transform={`translate(${pt.x + offsetX * inv},${pt.y + offsetY * inv})`}>
      <rect x={-px} y={-fontSize - py} width={(text.length * 0.6 + 1) * fontSize + px * 2} height={fontSize + py * 2} rx={3 * inv} fill={bg || 'white'} fillOpacity={0.9} stroke={color} strokeWidth={inv} />
      <text x={0} y={-py} fontSize={fontSize} fill={color} fontWeight={600} fontFamily="system-ui, sans-serif">{text}</text>
    </g>
  );
}

// ── Helpers ──────────────────────────────────────────────────

const MM_PER: Record<string, number> = { mm: 1, cm: 10, in: 25.4, ft: 304.8 };
function getConversionFactor(from: string, to: string): number { return MM_PER[from] / MM_PER[to]; }
