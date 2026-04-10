import { useState } from 'react';
import { Trash2, Copy, CheckCircle2, XCircle, Minus, Route, Square, Check } from 'lucide-react';
import { usePlanViewerStore } from '../../hooks/usePlanViewerStore';
import { formatMeasurement, formatArea, convertUnit } from '../../lib/plan-viewer/geometry';
import type { Measurement, MeasurementUnit } from '../../lib/plan-viewer/types';

export function MeasurementsPanel() {
  const {
    calibration,
    measurements,
    selectedMeasurementId,
    selectMeasurement,
    deleteMeasurement,
    renameMeasurement,
    clearAllMeasurements,
    unit,
    currentPage,
  } = usePlanViewerStore();

  const pageMeasurements = measurements.filter((m) => m.page === currentPage);
  const otherPageCount = measurements.length - pageMeasurements.length;

  return (
    <div className="w-72 border-l border-slate-200 bg-white/80 backdrop-blur-sm flex flex-col flex-shrink-0 overflow-hidden">
      {/* Calibration status */}
      <div className="px-3 py-2.5 border-b border-slate-200">
        <div className="flex items-center gap-2">
          {calibration ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
              <div className="text-xs">
                <span className="font-medium text-green-700">Calibrated</span>
                <span className="text-slate-500 ml-1.5">
                  {formatMeasurement(calibration.realDistance, calibration.unit)}
                </span>
              </div>
            </>
          ) : (
            <>
              <XCircle className="h-4 w-4 text-amber-500 flex-shrink-0" />
              <span className="text-xs text-amber-600 font-medium">Not calibrated</span>
            </>
          )}
        </div>
      </div>

      {/* Header */}
      <div className="px-3 py-2 flex items-center justify-between border-b border-slate-100">
        <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
          Measurements
        </span>
        {pageMeasurements.length > 0 && (
          <button
            onClick={clearAllMeasurements}
            className="text-[10px] text-red-500 hover:text-red-700 font-medium"
          >
            Clear all
          </button>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {pageMeasurements.length === 0 ? (
          <div className="px-3 py-8 text-center">
            <p className="text-xs text-slate-400">
              {calibration
                ? 'Click on the drawing to start measuring'
                : 'Calibrate the scale first to begin measuring'}
            </p>
          </div>
        ) : (
          <div className="py-1">
            {pageMeasurements.map((m) => (
              <MeasurementRow
                key={m.id}
                measurement={m}
                selected={m.id === selectedMeasurementId}
                displayUnit={unit}
                onSelect={() => selectMeasurement(m.id === selectedMeasurementId ? null : m.id)}
                onDelete={() => deleteMeasurement(m.id)}
                onRename={(name) => renameMeasurement(m.id, name)}
              />
            ))}
          </div>
        )}

        {otherPageCount > 0 && (
          <div className="px-3 py-2 border-t border-slate-100">
            <p className="text-[10px] text-slate-400">
              +{otherPageCount} measurement{otherPageCount > 1 ? 's' : ''} on other pages
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Row component ─────────────────────────────────────────

function MeasurementRow({
  measurement: m,
  selected,
  displayUnit,
  onSelect,
  onDelete,
  onRename,
}: {
  measurement: Measurement;
  selected: boolean;
  displayUnit: MeasurementUnit;
  onSelect: () => void;
  onDelete: () => void;
  onRename: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(m.name);
  const [copied, setCopied] = useState(false);

  const TypeIcon = m.type === 'line' ? Minus : m.type === 'multiline' ? Route : Square;

  const displayValue = getDisplayValue(m, displayUnit);

  const handleCopy = () => {
    navigator.clipboard.writeText(displayValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const commitRename = () => {
    setEditing(false);
    if (editName.trim() && editName !== m.name) {
      onRename(editName.trim());
    } else {
      setEditName(m.name);
    }
  };

  return (
    <div
      className={`px-3 py-2 flex items-start gap-2 cursor-pointer transition-colors ${
        selected ? 'bg-blue-50' : 'hover:bg-slate-50'
      }`}
      onClick={onSelect}
    >
      <div
        className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ backgroundColor: m.color + '20' }}
      >
        <TypeIcon className="h-3 w-3" style={{ color: m.color }} />
      </div>

      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            autoFocus
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') {
                setEditing(false);
                setEditName(m.name);
              }
            }}
            className="text-xs font-medium text-slate-800 w-full bg-white border border-blue-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className="text-xs font-medium text-slate-700 cursor-text hover:text-blue-600 block truncate"
            onDoubleClick={(e) => {
              e.stopPropagation();
              setEditing(true);
            }}
          >
            {m.name}
          </span>
        )}
        <span className="text-[11px] text-slate-500 font-mono">{displayValue}</span>
      </div>

      <div className="flex items-center gap-0.5 flex-shrink-0">
        <button
          onClick={(e) => { e.stopPropagation(); handleCopy(); }}
          className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          title="Copy value"
        >
          {copied ? (
            <Check className="h-3 w-3 text-green-500" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50"
          title="Delete"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────

function getDisplayValue(m: Measurement, displayUnit: MeasurementUnit): string {
  if (m.type === 'line') {
    const val = displayUnit === m.unit ? m.realLength : convertUnit(m.realLength, m.unit, displayUnit);
    return formatMeasurement(val, displayUnit);
  }
  if (m.type === 'multiline') {
    const val = displayUnit === m.unit ? m.totalRealLength : convertUnit(m.totalRealLength, m.unit, displayUnit);
    return formatMeasurement(val, displayUnit);
  }
  // rectangle
  const w = displayUnit === m.unit ? m.realWidth : convertUnit(m.realWidth, m.unit, displayUnit);
  const h = displayUnit === m.unit ? m.realHeight : convertUnit(m.realHeight, m.unit, displayUnit);
  const a = displayUnit === m.unit ? m.realArea : convertUnit(m.realWidth, m.unit, displayUnit) * convertUnit(m.realHeight, m.unit, displayUnit);
  return `${formatMeasurement(w, displayUnit)} x ${formatMeasurement(h, displayUnit)} = ${formatArea(a, displayUnit)}`;
}
