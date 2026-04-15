import { useState } from 'react';
import {
  Trash2, Copy, CheckCircle2, XCircle, Minus, Route, Square, Hexagon,
  Locate, Check, FileDown, ClipboardCopy, Save, Plus, X, Type,
} from 'lucide-react';
import { usePlanViewerStore } from '../../hooks/usePlanViewerStore';
import { formatMeasurement, formatArea, formatAngle, convertUnit } from '../../lib/plan-viewer/geometry';
import type { Measurement, MeasurementUnit, Annotation } from '../../lib/plan-viewer/types';
import { pdfToScreen } from '../../lib/plan-viewer/transforms';

const RENDER_SCALE = 2;

export function MeasurementsPanel() {
  const store = usePlanViewerStore();
  const {
    calibrations, measurements, annotations, selectedMeasurementId,
    selectMeasurement, deleteMeasurement, renameMeasurement,
    deleteAnnotation, clearAllMeasurements, unit, currentPage,
    groups, activeGroup, setActiveGroup, addGroup, removeGroup,
    saveSession, exportSession, importSession, viewport,
  } = store;

  const [showSessionMenu, setShowSessionMenu] = useState(false);
  const [newGroup, setNewGroup] = useState('');
  const [showGroupInput, setShowGroupInput] = useState(false);

  const calibration = calibrations[currentPage] ?? null;
  const pageMeasurements = measurements.filter((m) => m.page === currentPage);
  const pageAnnotations = annotations.filter((a) => a.page === currentPage);
  const filteredMeasurements = activeGroup
    ? pageMeasurements.filter((m) => m.group === activeGroup)
    : pageMeasurements;
  const otherPageCount = measurements.length - pageMeasurements.length;

  // ── Totals ───────────────────────────────────────────
  const totalLinear = filteredMeasurements.reduce((sum, m) => {
    if (m.type === 'line') return sum + (unit === m.unit ? m.realLength : convertUnit(m.realLength, m.unit, unit));
    if (m.type === 'multiline') return sum + (unit === m.unit ? m.totalRealLength : convertUnit(m.totalRealLength, m.unit, unit));
    if (m.type === 'polygon') return sum + (unit === m.unit ? m.realPerimeter : convertUnit(m.realPerimeter, m.unit, unit));
    return sum;
  }, 0);

  const totalArea = filteredMeasurements.reduce((sum, m) => {
    if (m.type === 'rectangle') {
      const a = unit === m.unit ? m.realArea : convertUnit(m.realWidth, m.unit, unit) * convertUnit(m.realHeight, m.unit, unit);
      return sum + a;
    }
    if (m.type === 'polygon') {
      const f = unit === m.unit ? 1 : (convertUnit(1, m.unit, unit) ** 2);
      return sum + m.realArea * f;
    }
    return sum;
  }, 0);

  // ── Export CSV ────────────────────────────────────────
  const exportCsv = () => {
    const rows = [['Name', 'Type', 'Value', 'Unit', 'Group']];
    for (const m of measurements) {
      rows.push([m.name, m.type, getDisplayValue(m, unit), unit, m.group || '']);
    }
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'measurements.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const copyAll = () => {
    const lines = filteredMeasurements.map((m) => `${m.name}: ${getDisplayValue(m, unit)}`);
    if (totalLinear > 0) lines.push(`Total linear: ${formatMeasurement(totalLinear, unit)}`);
    if (totalArea > 0) lines.push(`Total area: ${formatArea(totalArea, unit)}`);
    navigator.clipboard.writeText(lines.join('\n'));
  };

  // ── Zoom to measurement ──────────────────────────────
  const zoomTo = (m: Measurement) => {
    let center: { x: number; y: number };
    if (m.type === 'line') center = { x: (m.pointA.x + m.pointB.x) / 2, y: (m.pointA.y + m.pointB.y) / 2 };
    else if (m.type === 'rectangle') center = { x: (m.cornerA.x + m.cornerB.x) / 2, y: (m.cornerA.y + m.cornerB.y) / 2 };
    else if (m.type === 'angle') center = m.vertex;
    else if (m.type === 'multiline' || m.type === 'polygon') {
      const pts = m.points;
      center = { x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length };
    } else return;

    // Calculate screen center position and offset to center the measurement
    const screenPt = pdfToScreen(center, viewport, RENDER_SCALE);
    const container = document.querySelector('.flex-1.relative.overflow-hidden.bg-slate-100');
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const targetZoom = Math.max(viewport.zoom, 1.5);
    const zoomRatio = targetZoom / viewport.zoom;
    store.setViewport({
      zoom: targetZoom,
      offsetX: rect.width / 2 - (screenPt.x - viewport.offsetX) * zoomRatio,
      offsetY: rect.height / 2 - (screenPt.y - viewport.offsetY) * zoomRatio,
    });
  };

  // ── Session handlers ─────────────────────────────────
  const handleSave = () => { saveSession(); setShowSessionMenu(false); };
  const handleExportJson = () => {
    const json = exportSession();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'plan-viewer-session.json'; a.click();
    URL.revokeObjectURL(url);
    setShowSessionMenu(false);
  };
  const handleImportJson = () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await file.text();
      importSession(text);
    };
    input.click();
    setShowSessionMenu(false);
  };

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
                <span className="text-slate-500 ml-1.5">{formatMeasurement(calibration.realDistance, calibration.unit)}</span>
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

      {/* Actions bar */}
      <div className="px-3 py-1.5 flex items-center gap-1 border-b border-slate-100">
        <button onClick={copyAll} className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100" title="Copy all measurements">
          <ClipboardCopy className="h-3.5 w-3.5" />
        </button>
        <button onClick={exportCsv} className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100" title="Export CSV">
          <FileDown className="h-3.5 w-3.5" />
        </button>
        <div className="relative">
          <button onClick={() => setShowSessionMenu(!showSessionMenu)} className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100" title="Session">
            <Save className="h-3.5 w-3.5" />
          </button>
          {showSessionMenu && (
            <div className="absolute right-0 top-7 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-10 w-40">
              <button onClick={handleSave} className="w-full px-3 py-1.5 text-xs text-left hover:bg-slate-50">Save to browser</button>
              <button onClick={() => { store.loadSession(); setShowSessionMenu(false); }} className="w-full px-3 py-1.5 text-xs text-left hover:bg-slate-50">Load from browser</button>
              <hr className="my-1 border-slate-100" />
              <button onClick={handleExportJson} className="w-full px-3 py-1.5 text-xs text-left hover:bg-slate-50">Export JSON</button>
              <button onClick={handleImportJson} className="w-full px-3 py-1.5 text-xs text-left hover:bg-slate-50">Import JSON</button>
            </div>
          )}
        </div>
        <div className="flex-1" />
        {filteredMeasurements.length > 0 && (
          <button onClick={clearAllMeasurements} className="text-[10px] text-red-500 hover:text-red-700 font-medium">Clear all</button>
        )}
      </div>

      {/* Groups */}
      {groups.length > 0 && (
        <div className="px-3 py-1.5 border-b border-slate-100 flex items-center gap-1 flex-wrap">
          <button
            onClick={() => setActiveGroup(undefined)}
            className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors ${
              !activeGroup ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
          >All</button>
          {groups.map((g) => (
            <button key={g} onClick={() => setActiveGroup(g === activeGroup ? undefined : g)}
              className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors flex items-center gap-1 ${
                activeGroup === g ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              {g}
              <X className="h-2.5 w-2.5 hover:text-red-500" onClick={(e) => { e.stopPropagation(); removeGroup(g); }} />
            </button>
          ))}
        </div>
      )}

      {/* Add group */}
      <div className="px-3 py-1 border-b border-slate-100">
        {showGroupInput ? (
          <div className="flex items-center gap-1">
            <input autoFocus value={newGroup} onChange={(e) => setNewGroup(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && newGroup.trim()) { addGroup(newGroup.trim()); setNewGroup(''); setShowGroupInput(false); } if (e.key === 'Escape') setShowGroupInput(false); }}
              className="text-xs border border-slate-200 rounded px-1.5 py-0.5 flex-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Group name..."
            />
          </div>
        ) : (
          <button onClick={() => setShowGroupInput(true)} className="text-[10px] text-blue-500 hover:text-blue-700 flex items-center gap-0.5">
            <Plus className="h-3 w-3" /> Add group
          </button>
        )}
      </div>

      {/* Header */}
      <div className="px-3 py-1.5 border-b border-slate-100">
        <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Measurements</span>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {filteredMeasurements.length === 0 ? (
          <div className="px-3 py-6 text-center">
            <p className="text-xs text-slate-400">
              {calibration ? 'Click on the drawing to start measuring' : 'Calibrate the scale first to begin measuring'}
            </p>
          </div>
        ) : (
          <div className="py-1">
            {filteredMeasurements.map((m) => (
              <MeasurementRow key={m.id} measurement={m} selected={m.id === selectedMeasurementId} displayUnit={unit}
                onSelect={() => { selectMeasurement(m.id === selectedMeasurementId ? null : m.id); zoomTo(m); }}
                onDelete={() => deleteMeasurement(m.id)} onRename={(name) => renameMeasurement(m.id, name)}
              />
            ))}
          </div>
        )}

        {/* Annotations */}
        {pageAnnotations.length > 0 && (
          <>
            <div className="px-3 py-1.5 border-t border-slate-100">
              <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Annotations</span>
            </div>
            {pageAnnotations.map((a) => (
              <AnnotationRow key={a.id} annotation={a} onDelete={() => deleteAnnotation(a.id)} />
            ))}
          </>
        )}

        {otherPageCount > 0 && (
          <div className="px-3 py-2 border-t border-slate-100">
            <p className="text-[10px] text-slate-400">+{otherPageCount} on other pages</p>
          </div>
        )}
      </div>

      {/* Totals */}
      {(totalLinear > 0 || totalArea > 0) && (
        <div className="px-3 py-2 border-t border-slate-200 bg-slate-50/80">
          <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-1">Totals</div>
          {totalLinear > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Linear</span>
              <span className="font-mono font-medium text-slate-700">{formatMeasurement(totalLinear, unit)}</span>
            </div>
          )}
          {totalArea > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Area</span>
              <span className="font-mono font-medium text-slate-700">{formatArea(totalArea, unit)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Row components ──────────────────────────────────────────

function MeasurementRow({ measurement: m, selected, displayUnit, onSelect, onDelete, onRename }: {
  measurement: Measurement; selected: boolean; displayUnit: MeasurementUnit;
  onSelect: () => void; onDelete: () => void; onRename: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(m.name);
  const [copied, setCopied] = useState(false);

  const iconMap = { line: Minus, multiline: Route, rectangle: Square, angle: Locate, polygon: Hexagon };
  const TypeIcon = iconMap[m.type];
  const displayValue = getDisplayValue(m, displayUnit);

  const handleCopy = () => { navigator.clipboard.writeText(displayValue); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  const commitRename = () => { setEditing(false); if (editName.trim() && editName !== m.name) onRename(editName.trim()); else setEditName(m.name); };

  return (
    <div className={`px-3 py-2 flex items-start gap-2 cursor-pointer transition-colors ${selected ? 'bg-blue-50' : 'hover:bg-slate-50'}`} onClick={onSelect}>
      <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: m.color + '20' }}>
        <TypeIcon className="h-3 w-3" style={{ color: m.color }} />
      </div>
      <div className="flex-1 min-w-0">
        {editing ? (
          <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)} onBlur={commitRename}
            onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') { setEditing(false); setEditName(m.name); } }}
            className="text-xs font-medium text-slate-800 w-full bg-white border border-blue-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="text-xs font-medium text-slate-700 cursor-text hover:text-blue-600 block truncate"
            onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }}>{m.name}</span>
        )}
        <span className="text-[11px] text-slate-500 font-mono">{displayValue}</span>
        {m.group && <span className="text-[9px] bg-slate-100 text-slate-500 rounded px-1 ml-1">{m.group}</span>}
      </div>
      <div className="flex items-center gap-0.5 flex-shrink-0">
        <button onClick={(e) => { e.stopPropagation(); handleCopy(); }} className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100" title="Copy">
          {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
        </button>
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50" title="Delete">
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

function AnnotationRow({ annotation: a, onDelete }: { annotation: Annotation; onDelete: () => void }) {
  return (
    <div className="px-3 py-1.5 flex items-center gap-2 hover:bg-slate-50">
      <Type className="h-3 w-3 flex-shrink-0" style={{ color: a.color }} />
      <span className="text-xs text-slate-600 flex-1 truncate">{a.text}</span>
      <button onClick={onDelete} className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50"><Trash2 className="h-3 w-3" /></button>
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
  if (m.type === 'rectangle') {
    const w = displayUnit === m.unit ? m.realWidth : convertUnit(m.realWidth, m.unit, displayUnit);
    const h = displayUnit === m.unit ? m.realHeight : convertUnit(m.realHeight, m.unit, displayUnit);
    const a = w * h;
    return `${formatMeasurement(w, displayUnit)} x ${formatMeasurement(h, displayUnit)} = ${formatArea(a, displayUnit)}`;
  }
  if (m.type === 'angle') return formatAngle(m.degrees);
  if (m.type === 'polygon') {
    const f = displayUnit === m.unit ? 1 : (convertUnit(1, m.unit, displayUnit) ** 2);
    return `${formatArea(m.realArea * f, displayUnit)}, perimeter ${formatMeasurement(
      displayUnit === m.unit ? m.realPerimeter : convertUnit(m.realPerimeter, m.unit, displayUnit), displayUnit
    )}`;
  }
  return '';
}
