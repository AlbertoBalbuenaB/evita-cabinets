import { usePlanViewerStore } from '../../hooks/usePlanViewerStore';
import { midpoint, formatMeasurement, formatArea } from '../../lib/plan-viewer/geometry';
import type {
  ViewportState,
  PdfPoint,
  Measurement,
  LineMeasurement,
  MultilineMeasurement,
  RectangleMeasurement,
} from '../../lib/plan-viewer/types';

interface MeasurementOverlayProps {
  canvasWidth: number;
  canvasHeight: number;
  viewport: ViewportState;
  renderScale: number;
  cursorPos: PdfPoint | null;
}

export function MeasurementOverlay({
  canvasWidth,
  canvasHeight,
  viewport,
  renderScale,
  cursorPos,
}: MeasurementOverlayProps) {
  const {
    measurements,
    calibration,
    activePoints,
    activeTool,
    showCrosshair,
    currentPage,
    selectedMeasurementId,
    unit,
  } = usePlanViewerStore();

  const scale = viewport.zoom * renderScale;
  const inv = 1 / scale;

  // Only render measurements for current page
  const pageMeasurements = measurements.filter((m) => m.page === currentPage);

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      style={{ width: '100%', height: '100%' }}
    >
      {/* Crosshair in screen space */}
      {showCrosshair && cursorPos && activeTool !== 'pan' && (
        <g>
          <line
            x1={cursorPos.x * scale + viewport.offsetX}
            y1={0}
            x2={cursorPos.x * scale + viewport.offsetX}
            y2="100%"
            stroke="#94a3b8"
            strokeWidth={0.5}
            strokeDasharray="4 4"
          />
          <line
            x1={0}
            y1={cursorPos.y * scale + viewport.offsetY}
            x2="100%"
            y2={cursorPos.y * scale + viewport.offsetY}
            stroke="#94a3b8"
            strokeWidth={0.5}
            strokeDasharray="4 4"
          />
        </g>
      )}

      {/* PDF-space group */}
      <g transform={`translate(${viewport.offsetX},${viewport.offsetY}) scale(${scale})`}>
        {/* Calibration line */}
        {calibration && (
          <g>
            <line
              x1={calibration.pointA.x}
              y1={calibration.pointA.y}
              x2={calibration.pointB.x}
              y2={calibration.pointB.y}
              stroke="#16a34a"
              strokeWidth={2 * inv}
              strokeDasharray={`${6 * inv} ${4 * inv}`}
            />
            <circle
              cx={calibration.pointA.x}
              cy={calibration.pointA.y}
              r={4 * inv}
              fill="#16a34a"
            />
            <circle
              cx={calibration.pointB.x}
              cy={calibration.pointB.y}
              r={4 * inv}
              fill="#16a34a"
            />
            <Label
              pt={midpoint(calibration.pointA, calibration.pointB)}
              text={formatMeasurement(calibration.realDistance, calibration.unit)}
              inv={inv}
              color="#16a34a"
              bg="#dcfce7"
            />
          </g>
        )}

        {/* Completed measurements */}
        {pageMeasurements.map((m) => (
          <MeasurementShape
            key={m.id}
            measurement={m}
            inv={inv}
            selected={m.id === selectedMeasurementId}
            displayUnit={unit}
          />
        ))}

        {/* Active drawing preview */}
        {activePoints.length > 0 && cursorPos && activeTool !== 'pan' && (
          <ActivePreview
            points={activePoints}
            cursor={cursorPos}
            tool={activeTool}
            inv={inv}
          />
        )}
      </g>
    </svg>
  );
}

// ── Sub-components ─────────────────────────────────────────

function MeasurementShape({
  measurement: m,
  inv,
  selected,
  displayUnit,
}: {
  measurement: Measurement;
  inv: number;
  selected: boolean;
  displayUnit: string;
}) {
  const sw = (selected ? 3 : 2) * inv;

  if (m.type === 'line') return <LineShape m={m} inv={inv} sw={sw} displayUnit={displayUnit} />;
  if (m.type === 'multiline') return <MultilineShape m={m} inv={inv} sw={sw} displayUnit={displayUnit} />;
  return <RectShape m={m} inv={inv} sw={sw} displayUnit={displayUnit} />;
}

function LineShape({ m, inv, sw, displayUnit }: { m: LineMeasurement; inv: number; sw: number; displayUnit: string }) {
  const mid = midpoint(m.pointA, m.pointB);
  const realInUnit = displayUnit === m.unit ? m.realLength : convertForDisplay(m, displayUnit);
  return (
    <g>
      <line
        x1={m.pointA.x} y1={m.pointA.y}
        x2={m.pointB.x} y2={m.pointB.y}
        stroke={m.color} strokeWidth={sw}
      />
      <circle cx={m.pointA.x} cy={m.pointA.y} r={3 * inv} fill={m.color} />
      <circle cx={m.pointB.x} cy={m.pointB.y} r={3 * inv} fill={m.color} />
      <Label
        pt={mid}
        text={formatMeasurement(realInUnit, displayUnit as 'in')}
        inv={inv}
        color={m.color}
      />
    </g>
  );
}

function MultilineShape({ m, inv, sw, displayUnit }: { m: MultilineMeasurement; inv: number; sw: number; displayUnit: string }) {
  const pts = m.points.map((p) => `${p.x},${p.y}`).join(' ');
  const last = m.points[m.points.length - 1];
  const realInUnit = displayUnit === m.unit ? m.totalRealLength : convertForDisplay(m, displayUnit);
  return (
    <g>
      <polyline
        points={pts}
        fill="none"
        stroke={m.color}
        strokeWidth={sw}
        strokeLinejoin="round"
      />
      {m.points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3 * inv} fill={m.color} />
      ))}
      <Label
        pt={last}
        text={formatMeasurement(realInUnit, displayUnit as 'in')}
        inv={inv}
        color={m.color}
        offsetY={-12}
      />
    </g>
  );
}

function RectShape({ m, inv, sw, displayUnit }: { m: RectangleMeasurement; inv: number; sw: number; displayUnit: string }) {
  const x = Math.min(m.cornerA.x, m.cornerB.x);
  const y = Math.min(m.cornerA.y, m.cornerB.y);
  const w = Math.abs(m.cornerB.x - m.cornerA.x);
  const h = Math.abs(m.cornerB.y - m.cornerA.y);
  const center: PdfPoint = { x: x + w / 2, y: y + h / 2 };

  const factor = getConversionFactor(m.unit, displayUnit);
  const realW = m.realWidth * factor;
  const realH = m.realHeight * factor;
  const realA = m.realArea * factor * factor;

  return (
    <g>
      <rect
        x={x} y={y} width={w} height={h}
        fill={m.color + '10'}
        stroke={m.color}
        strokeWidth={sw}
        strokeDasharray={`${6 * inv} ${3 * inv}`}
      />
      {/* Width label on top */}
      <Label
        pt={{ x: center.x, y }}
        text={formatMeasurement(realW, displayUnit as 'in')}
        inv={inv}
        color={m.color}
        offsetY={-8}
      />
      {/* Height label on right */}
      <Label
        pt={{ x: x + w, y: center.y }}
        text={formatMeasurement(realH, displayUnit as 'in')}
        inv={inv}
        color={m.color}
        offsetX={8}
      />
      {/* Area label in center */}
      <Label
        pt={center}
        text={formatArea(realA, displayUnit as 'in')}
        inv={inv}
        color={m.color}
      />
    </g>
  );
}

function ActivePreview({
  points,
  cursor,
  tool,
  inv,
}: {
  points: PdfPoint[];
  cursor: PdfPoint;
  tool: string;
  inv: number;
}) {
  const last = points[points.length - 1];

  if (tool === 'calibrate' && points.length === 1) {
    return (
      <g>
        <line
          x1={last.x} y1={last.y} x2={cursor.x} y2={cursor.y}
          stroke="#16a34a" strokeWidth={2 * inv} strokeDasharray={`${6 * inv} ${4 * inv}`}
        />
        <circle cx={last.x} cy={last.y} r={4 * inv} fill="#16a34a" />
        <circle cx={cursor.x} cy={cursor.y} r={4 * inv} fill="#16a34a" opacity={0.6} />
      </g>
    );
  }

  if ((tool === 'line' || tool === 'multiline') && points.length >= 1) {
    const allPts = [...points, cursor];
    return (
      <g>
        <polyline
          points={allPts.map((p) => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke="#2563eb"
          strokeWidth={2 * inv}
          strokeDasharray={`${6 * inv} ${4 * inv}`}
        />
        {allPts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={3 * inv} fill="#2563eb" opacity={i === allPts.length - 1 ? 0.6 : 1} />
        ))}
      </g>
    );
  }

  if (tool === 'rectangle' && points.length === 1) {
    const x = Math.min(last.x, cursor.x);
    const y = Math.min(last.y, cursor.y);
    const w = Math.abs(cursor.x - last.x);
    const h = Math.abs(cursor.y - last.y);
    return (
      <g>
        <rect
          x={x} y={y} width={w} height={h}
          fill="#2563eb10"
          stroke="#2563eb"
          strokeWidth={2 * inv}
          strokeDasharray={`${6 * inv} ${3 * inv}`}
        />
      </g>
    );
  }

  return null;
}

function Label({
  pt,
  text,
  inv,
  color,
  bg,
  offsetX = 0,
  offsetY = 0,
}: {
  pt: PdfPoint;
  text: string;
  inv: number;
  color: string;
  bg?: string;
  offsetX?: number;
  offsetY?: number;
}) {
  const fontSize = 11 * inv;
  const px = 4 * inv;
  const py = 2 * inv;
  return (
    <g transform={`translate(${pt.x + offsetX * inv},${pt.y + offsetY * inv})`}>
      <rect
        x={-px}
        y={-fontSize - py}
        width={(text.length * 0.6 + 1) * fontSize + px * 2}
        height={fontSize + py * 2}
        rx={3 * inv}
        fill={bg || 'white'}
        fillOpacity={0.9}
        stroke={color}
        strokeWidth={inv}
      />
      <text
        x={0}
        y={-py}
        fontSize={fontSize}
        fill={color}
        fontWeight={600}
        fontFamily="system-ui, sans-serif"
      >
        {text}
      </text>
    </g>
  );
}

// ── Helpers ──────────────────────────────────────────────

const MM_PER: Record<string, number> = { mm: 1, cm: 10, in: 25.4, ft: 304.8 };

function getConversionFactor(from: string, to: string): number {
  return MM_PER[from] / MM_PER[to];
}

function convertForDisplay(m: { unit: string; realLength?: number; totalRealLength?: number }, displayUnit: string): number {
  const value = 'realLength' in m && m.realLength !== undefined ? m.realLength : m.totalRealLength ?? 0;
  return value * getConversionFactor(m.unit, displayUnit);
}
