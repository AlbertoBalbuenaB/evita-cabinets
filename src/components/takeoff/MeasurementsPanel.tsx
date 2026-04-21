import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Trash2, Copy, CheckCircle2, XCircle, Minus, Route, Square, Hexagon,
  Locate, Check, FileDown, ClipboardCopy, Save, Plus, X, Type, Hash, Scissors,
  Link2, Link2Off, Send,
} from 'lucide-react';
import { useTakeoffStore } from '../../hooks/useTakeoffStore';
import { formatMeasurement, formatArea, formatAngle, convertUnit } from '../../lib/takeoff/geometry';
import { CATEGORY_PALETTE, resolveMeasurementColor, getNetArea, getCutoutsFor } from '../../lib/takeoff/categories';
import type { Measurement, MeasurementUnit, Annotation, Category, LinkedProduct } from '../../lib/takeoff/types';
import { pdfToScreen } from '../../lib/takeoff/transforms';
import { LinkProductPicker } from './LinkProductPicker';
import { SendToQuotationModal } from './SendToQuotationModal';

const RENDER_SCALE = 2;

export function MeasurementsPanel() {
  const store = useTakeoffStore();
  const {
    calibrations, measurements, annotations, selectedMeasurementId,
    selectMeasurement, deleteMeasurement, renameMeasurement,
    deleteAnnotation, clearAllMeasurements, unit, currentPage,
    groups, activeGroup, setActiveGroup, addGroup, removeGroup,
    categories, activeCategoryId, setActiveCategory, addCategory, removeCategory,
    saveSession, exportSession, importSession, viewport,
    sessionProjectId, setMeasurementLinkedProduct,
  } = store;

  const [linkPickerFor, setLinkPickerFor] = useState<string | null>(null);
  const [showSendToQuotation, setShowSendToQuotation] = useState(false);

  const [showSessionMenu, setShowSessionMenu] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const sessionBtnRef = useRef<HTMLButtonElement>(null);
  const sessionMenuRef = useRef<HTMLDivElement>(null);
  const [newGroup, setNewGroup] = useState('');
  const [showGroupInput, setShowGroupInput] = useState(false);
  const [showCategoryInput, setShowCategoryInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState(CATEGORY_PALETTE[0]);

  const closeSessionMenu = () => { setShowSessionMenu(false); setMenuPos(null); };

  const toggleSessionMenu = () => {
    if (showSessionMenu) { closeSessionMenu(); return; }
    const r = sessionBtnRef.current?.getBoundingClientRect();
    if (!r) return;
    setMenuPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
    setShowSessionMenu(true);
  };

  useEffect(() => {
    if (!showSessionMenu) return;
    const onMouseDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (sessionBtnRef.current?.contains(t)) return;
      if (sessionMenuRef.current?.contains(t)) return;
      closeSessionMenu();
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [showSessionMenu]);

  const calibration = calibrations[currentPage] ?? null;
  const pageMeasurements = measurements.filter((m) => m.page === currentPage);
  const pageAnnotations = annotations.filter((a) => a.page === currentPage);
  const filteredMeasurements = pageMeasurements.filter((m) => {
    if (activeGroup && m.group !== activeGroup) return false;
    if (activeCategoryId && m.categoryId !== activeCategoryId) return false;
    return true;
  });
  const otherPageCount = measurements.length - pageMeasurements.length;

  // ── Totals (global, filtered) ────────────────────────
  const totalLinear = filteredMeasurements.reduce((sum, m) => {
    if (m.type === 'line') return sum + (unit === m.unit ? m.realLength : convertUnit(m.realLength, m.unit, unit));
    if (m.type === 'multiline') return sum + (unit === m.unit ? m.totalRealLength : convertUnit(m.totalRealLength, m.unit, unit));
    if (m.type === 'polygon') return sum + (unit === m.unit ? m.realPerimeter : convertUnit(m.realPerimeter, m.unit, unit));
    return sum;
  }, 0);

  const totalArea = filteredMeasurements.reduce((sum, m) => {
    if (m.type === 'rectangle') {
      const net = getNetArea(m, measurements);
      const f = unit === m.unit ? 1 : (convertUnit(1, m.unit, unit) ** 2);
      return sum + net * f;
    }
    if (m.type === 'polygon') {
      const net = getNetArea(m, measurements);
      const f = unit === m.unit ? 1 : (convertUnit(1, m.unit, unit) ** 2);
      return sum + net * f;
    }
    return sum;
  }, 0);

  const totalCount = filteredMeasurements.reduce((sum, m) => sum + (m.type === 'count' ? 1 : 0), 0);

  // ── Totals by category (only over pageMeasurements; respects group filter if set) ─
  type CategoryTotal = { categoryId: string | null; name: string; color: string | null; linear: number; area: number; count: number };
  const byCategory = new Map<string, CategoryTotal>();
  for (const m of pageMeasurements) {
    if (activeGroup && m.group !== activeGroup) continue;
    const catId = m.categoryId ?? null;
    const key = catId ?? '__uncat__';
    if (!byCategory.has(key)) {
      const cat = catId ? categories.find((c) => c.id === catId) : null;
      byCategory.set(key, { categoryId: catId, name: cat?.name ?? 'Uncategorized', color: cat?.color ?? null, linear: 0, area: 0, count: 0 });
    }
    const bucket = byCategory.get(key)!;
    if (m.type === 'line') {
      bucket.linear += unit === m.unit ? m.realLength : convertUnit(m.realLength, m.unit, unit);
    } else if (m.type === 'multiline') {
      bucket.linear += unit === m.unit ? m.totalRealLength : convertUnit(m.totalRealLength, m.unit, unit);
    } else if (m.type === 'polygon') {
      const fArea = unit === m.unit ? 1 : (convertUnit(1, m.unit, unit) ** 2);
      bucket.linear += unit === m.unit ? m.realPerimeter : convertUnit(m.realPerimeter, m.unit, unit);
      bucket.area += getNetArea(m, measurements) * fArea;
    } else if (m.type === 'rectangle') {
      const fArea = unit === m.unit ? 1 : (convertUnit(1, m.unit, unit) ** 2);
      bucket.area += getNetArea(m, measurements) * fArea;
    } else if (m.type === 'count') {
      bucket.count += 1;
    }
    // cutouts: subtracted via getNetArea on their parent — no direct contribution here
    // angle: not summable — skipped
  }
  const categoryTotals = Array.from(byCategory.values())
    .filter((b) => b.linear > 0 || b.area > 0 || b.count > 0)
    .sort((a, b) => (a.categoryId === null ? 1 : b.categoryId === null ? -1 : a.name.localeCompare(b.name)));

  // ── Export CSV ────────────────────────────────────────
  const exportCsv = () => {
    const rows = [['Name', 'Type', 'Value', 'Unit', 'Category', 'Group']];
    for (const m of measurements) {
      const catName = m.categoryId ? categories.find((c) => c.id === m.categoryId)?.name ?? '' : '';
      rows.push([m.name, m.type, getDisplayValue(m, unit, measurements), unit, catName, m.group || '']);
    }
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'measurements.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const copyAll = () => {
    const lines = filteredMeasurements.map((m) => `${m.name}: ${getDisplayValue(m, unit, measurements)}`);
    if (totalLinear > 0) lines.push(`Total linear: ${formatMeasurement(totalLinear, unit)}`);
    if (totalArea > 0) lines.push(`Total area: ${formatArea(totalArea, unit)}`);
    if (totalCount > 0) lines.push(`Total count: ${totalCount}`);
    navigator.clipboard.writeText(lines.join('\n'));
  };

  // ── Zoom to measurement ──────────────────────────────
  const zoomTo = (m: Measurement) => {
    let center: { x: number; y: number };
    if (m.type === 'line') center = { x: (m.pointA.x + m.pointB.x) / 2, y: (m.pointA.y + m.pointB.y) / 2 };
    else if (m.type === 'rectangle' || m.type === 'cutout') center = { x: (m.cornerA.x + m.cornerB.x) / 2, y: (m.cornerA.y + m.cornerB.y) / 2 };
    else if (m.type === 'angle') center = m.vertex;
    else if (m.type === 'count') center = m.position;
    else if (m.type === 'multiline' || m.type === 'polygon') {
      const pts = m.points;
      center = { x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length };
    } else return;

    // Calculate screen center position and offset to center the measurement
    const screenPt = pdfToScreen(center, viewport, RENDER_SCALE);
    const container = document.querySelector('.flex-1.relative.overflow-hidden.bg-surf-muted');
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
  const handleSave = () => { saveSession(); closeSessionMenu(); };
  const handleExportJson = () => {
    const json = exportSession();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'takeoff-session.json'; a.click();
    URL.revokeObjectURL(url);
    closeSessionMenu();
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
    closeSessionMenu();
  };

  // ── Category handlers ────────────────────────────────
  const submitNewCategory = () => {
    const name = newCategoryName.trim();
    if (!name) return;
    const cat: Category = { id: crypto.randomUUID(), name, color: newCategoryColor };
    addCategory(cat);
    setActiveCategory(cat.id);
    setNewCategoryName('');
    setNewCategoryColor(CATEGORY_PALETTE[(categories.length + 1) % CATEGORY_PALETTE.length]);
    setShowCategoryInput(false);
  };

  return (
    <>
    <div className="w-72 border-l border-border-soft bg-surf-card backdrop-blur-sm flex flex-col flex-shrink-0 overflow-hidden">
      {/* Calibration status */}
      <div className="px-3 py-2.5 border-b border-border-soft">
        <div className="flex items-center gap-2">
          {calibration ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-status-emerald-fg flex-shrink-0" />
              <div className="text-xs">
                <span className="font-medium text-status-emerald-fg">Calibrated</span>
                <span className="text-fg-500 ml-1.5">{formatMeasurement(calibration.realDistance, calibration.unit)}</span>
              </div>
            </>
          ) : (
            <>
              <XCircle className="h-4 w-4 text-amber-500 flex-shrink-0" />
              <span className="text-xs text-status-amber-fg font-medium">Not calibrated</span>
            </>
          )}
        </div>
      </div>

      {/* Actions bar */}
      <div className="px-3 py-1.5 flex items-center gap-1 border-b border-border-soft">
        <button onClick={copyAll} className="p-1 rounded text-fg-400 hover:text-fg-600 hover:bg-surf-muted" title="Copy all measurements">
          <ClipboardCopy className="h-3.5 w-3.5" />
        </button>
        <button onClick={exportCsv} className="p-1 rounded text-fg-400 hover:text-fg-600 hover:bg-surf-muted" title="Export CSV">
          <FileDown className="h-3.5 w-3.5" />
        </button>
        <button ref={sessionBtnRef} onClick={toggleSessionMenu} className="p-1 rounded text-fg-400 hover:text-fg-600 hover:bg-surf-muted" title="Session">
          <Save className="h-3.5 w-3.5" />
        </button>
        {sessionProjectId && (
          <button
            onClick={() => setShowSendToQuotation(true)}
            className="p-1 rounded text-fg-400 hover:text-accent-text hover:bg-accent-tint-soft"
            title="Send linked measurements to a quotation in this project"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        )}
        <div className="flex-1" />
        {filteredMeasurements.length > 0 && (
          <button onClick={clearAllMeasurements} className="text-[10px] text-red-500 hover:text-status-red-fg font-medium">Clear all</button>
        )}
      </div>

      {/* Categories — layer/takeoff categories with color. Active one auto-assigns to new measurements. */}
      <div className="px-3 py-1.5 border-b border-border-soft">
        <div className="flex items-center gap-1 flex-wrap">
          <button
            onClick={() => setActiveCategory(null)}
            className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors ${
              !activeCategoryId ? 'bg-accent-tint-soft text-accent-text' : 'bg-surf-muted text-fg-500 hover:bg-surf-muted'
            }`}
            title="Show all / no active category"
          >All</button>
          {categories.map((c) => (
            <button key={c.id} onClick={() => setActiveCategory(c.id === activeCategoryId ? null : c.id)}
              className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors flex items-center gap-1 ${
                activeCategoryId === c.id ? 'text-fg-800' : 'text-fg-600 hover:bg-surf-muted'
              }`}
              style={activeCategoryId === c.id ? { backgroundColor: c.color + '33', border: `1px solid ${c.color}` } : { backgroundColor: c.color + '18' }}
              title={`${c.name} — click to ${c.id === activeCategoryId ? 'deactivate' : 'activate'}`}
            >
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
              {c.name}
              <X className="h-2.5 w-2.5 hover:text-red-500"
                onClick={(e) => { e.stopPropagation(); if (window.confirm(`Delete category "${c.name}"? Measurements will keep their stored color.`)) removeCategory(c.id); }}
              />
            </button>
          ))}
          {!showCategoryInput && (
            <button onClick={() => setShowCategoryInput(true)} className="text-[10px] text-blue-500 hover:text-accent-text flex items-center gap-0.5 px-1">
              <Plus className="h-3 w-3" /> Category
            </button>
          )}
        </div>
        {showCategoryInput && (
          <div className="mt-1.5 flex items-center gap-1">
            <div className="flex items-center gap-0.5 flex-shrink-0">
              {CATEGORY_PALETTE.slice(0, 6).map((color) => (
                <button key={color} onClick={() => setNewCategoryColor(color)}
                  className={`w-3.5 h-3.5 rounded-full transition-transform ${newCategoryColor === color ? 'ring-2 ring-offset-1 ring-slate-400 scale-110' : 'hover:scale-110'}`}
                  style={{ backgroundColor: color }} title={color}
                />
              ))}
            </div>
            <input autoFocus value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitNewCategory(); if (e.key === 'Escape') { setShowCategoryInput(false); setNewCategoryName(''); } }}
              className="text-xs border border-border-soft rounded px-1.5 py-0.5 flex-1 min-w-0 focus:outline-none focus:ring-1 focus-visible:ring-focus"
              placeholder="e.g. Base Cabinets"
            />
            <button onClick={submitNewCategory} disabled={!newCategoryName.trim()} className="text-[10px] text-accent-text hover:text-accent-text disabled:text-fg-300 font-medium px-1">Add</button>
          </div>
        )}
      </div>

      {/* Groups (legacy) */}
      {groups.length > 0 && (
        <div className="px-3 py-1.5 border-b border-border-soft flex items-center gap-1 flex-wrap">
          <button
            onClick={() => setActiveGroup(undefined)}
            className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors ${
              !activeGroup ? 'bg-accent-tint-soft text-accent-text' : 'bg-surf-muted text-fg-500 hover:bg-surf-muted'
            }`}
          >All</button>
          {groups.map((g) => (
            <button key={g} onClick={() => setActiveGroup(g === activeGroup ? undefined : g)}
              className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors flex items-center gap-1 ${
                activeGroup === g ? 'bg-accent-tint-soft text-accent-text' : 'bg-surf-muted text-fg-500 hover:bg-surf-muted'
              }`}
            >
              {g}
              <X className="h-2.5 w-2.5 hover:text-red-500" onClick={(e) => { e.stopPropagation(); removeGroup(g); }} />
            </button>
          ))}
        </div>
      )}

      {/* Add group */}
      <div className="px-3 py-1 border-b border-border-soft">
        {showGroupInput ? (
          <div className="flex items-center gap-1">
            <input autoFocus value={newGroup} onChange={(e) => setNewGroup(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && newGroup.trim()) { addGroup(newGroup.trim()); setNewGroup(''); setShowGroupInput(false); } if (e.key === 'Escape') setShowGroupInput(false); }}
              className="text-xs border border-border-soft rounded px-1.5 py-0.5 flex-1 focus:outline-none focus:ring-1 focus-visible:ring-focus"
              placeholder="Group name..."
            />
          </div>
        ) : (
          <button onClick={() => setShowGroupInput(true)} className="text-[10px] text-blue-500 hover:text-accent-text flex items-center gap-0.5">
            <Plus className="h-3 w-3" /> Add group
          </button>
        )}
      </div>

      {/* Header */}
      <div className="px-3 py-1.5 border-b border-border-soft">
        <span className="text-xs font-semibold text-fg-700 uppercase tracking-wider">Measurements</span>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {filteredMeasurements.length === 0 ? (
          <div className="px-3 py-6 text-center">
            <p className="text-xs text-fg-400">
              {calibration ? 'Click on the drawing to start measuring' : 'Calibrate the scale first to begin measuring'}
            </p>
          </div>
        ) : (
          <div className="py-1">
            {filteredMeasurements.map((m) => (
              <MeasurementRow key={m.id} measurement={m} selected={m.id === selectedMeasurementId} displayUnit={unit}
                categories={categories} allMeasurements={measurements}
                onSelect={() => { selectMeasurement(m.id === selectedMeasurementId ? null : m.id); zoomTo(m); }}
                onDelete={() => deleteMeasurement(m.id)} onRename={(name) => renameMeasurement(m.id, name)}
                onLink={() => setLinkPickerFor(m.id)}
              />
            ))}
          </div>
        )}

        {/* Annotations */}
        {pageAnnotations.length > 0 && (
          <>
            <div className="px-3 py-1.5 border-t border-border-soft">
              <span className="text-xs font-semibold text-fg-700 uppercase tracking-wider">Annotations</span>
            </div>
            {pageAnnotations.map((a) => (
              <AnnotationRow key={a.id} annotation={a} onDelete={() => deleteAnnotation(a.id)} />
            ))}
          </>
        )}

        {otherPageCount > 0 && (
          <div className="px-3 py-2 border-t border-border-soft">
            <p className="text-[10px] text-fg-400">+{otherPageCount} on other pages</p>
          </div>
        )}
      </div>

      {/* Totals — grand total + per-category breakdown */}
      {(totalLinear > 0 || totalArea > 0 || totalCount > 0) && (
        <div className="px-3 py-2 border-t border-border-soft bg-surf-app max-h-52 overflow-y-auto">
          <div className="text-[10px] font-semibold text-fg-600 uppercase tracking-wider mb-1">Totals</div>
          {totalLinear > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-fg-500">Linear</span>
              <span className="font-mono font-medium text-fg-700">{formatMeasurement(totalLinear, unit)}</span>
            </div>
          )}
          {totalArea > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-fg-500">Area</span>
              <span className="font-mono font-medium text-fg-700">{formatArea(totalArea, unit)}</span>
            </div>
          )}
          {totalCount > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-fg-500">Count</span>
              <span className="font-mono font-medium text-fg-700">{totalCount}</span>
            </div>
          )}
          {categoryTotals.length > 1 && (
            <div className="mt-2 pt-2 border-t border-border-soft space-y-1.5">
              <div className="text-[9px] font-semibold text-fg-400 uppercase tracking-wider">By category</div>
              {categoryTotals.map((b) => (
                <div key={b.categoryId ?? '__uncat__'} className="text-[11px]">
                  <div className="flex items-center gap-1 mb-0.5">
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: b.color ?? '#cbd5e1' }} />
                    <span className="font-medium text-fg-600 truncate">{b.name}</span>
                  </div>
                  <div className="pl-3 text-fg-500 font-mono space-y-0.5">
                    {b.linear > 0 && <div className="flex justify-between"><span>Linear</span><span>{formatMeasurement(b.linear, unit)}</span></div>}
                    {b.area > 0 && <div className="flex justify-between"><span>Area</span><span>{formatArea(b.area, unit)}</span></div>}
                    {b.count > 0 && <div className="flex justify-between"><span>Count</span><span>{b.count}</span></div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>

    {/* Link-to-product picker (only rendered when a row's link icon was clicked) */}
    {linkPickerFor && (
      <LinkProductPicker
        isOpen
        onClose={() => setLinkPickerFor(null)}
        measurementName={measurements.find((m) => m.id === linkPickerFor)?.name ?? ''}
        currentLink={measurements.find((m) => m.id === linkPickerFor)?.linkedProduct ?? null}
        onSave={(link: LinkedProduct | null) => {
          if (linkPickerFor) setMeasurementLinkedProduct(linkPickerFor, link);
        }}
      />
    )}

    {/* Send linked measurements as area_items to a quotation (only when this takeoff is
        attached to a project). */}
    {showSendToQuotation && sessionProjectId && (
      <SendToQuotationModal
        isOpen
        onClose={() => setShowSendToQuotation(false)}
        projectId={sessionProjectId}
        displayUnit={unit}
      />
    )}

    {/* Session menu — portal to escape the panel's overflow-hidden */}
    {showSessionMenu && menuPos && createPortal(
      <div
        ref={sessionMenuRef}
        style={{ position: 'fixed', top: menuPos.top, right: menuPos.right, zIndex: 60 }}
        className="bg-surf-card rounded-lg shadow-lg border border-border-soft py-1 w-40"
      >
        <button onClick={handleSave} className="w-full px-3 py-1.5 text-xs text-left hover:bg-surf-app">Save to browser</button>
        <button onClick={() => { store.loadSession(); closeSessionMenu(); }} className="w-full px-3 py-1.5 text-xs text-left hover:bg-surf-app">Load from browser</button>
        <hr className="my-1 border-border-soft" />
        <button onClick={handleExportJson} className="w-full px-3 py-1.5 text-xs text-left hover:bg-surf-app">Export JSON</button>
        <button onClick={handleImportJson} className="w-full px-3 py-1.5 text-xs text-left hover:bg-surf-app">Import JSON</button>
      </div>,
      document.body
    )}
    </>
  );
}

// ── Row components ──────────────────────────────────────────

function MeasurementRow({ measurement: m, selected, displayUnit, categories, allMeasurements, onSelect, onDelete, onRename, onLink }: {
  measurement: Measurement; selected: boolean; displayUnit: MeasurementUnit;
  categories: Category[]; allMeasurements: Measurement[];
  onSelect: () => void; onDelete: () => void; onRename: (name: string) => void; onLink: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(m.name);
  const [copied, setCopied] = useState(false);

  const iconMap = { line: Minus, multiline: Route, rectangle: Square, angle: Locate, polygon: Hexagon, count: Hash, cutout: Scissors };
  const TypeIcon = iconMap[m.type];
  const displayValue = getDisplayValue(m, displayUnit, allMeasurements);
  const effectiveColor = resolveMeasurementColor(m, categories);
  const category = m.categoryId ? categories.find((c) => c.id === m.categoryId) : null;
  // Angles and cutouts don't have a natural orderable quantity, so hide the link button for them.
  const linkable = m.type !== 'angle' && m.type !== 'cutout';

  const handleCopy = () => { navigator.clipboard.writeText(displayValue); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  const commitRename = () => { setEditing(false); if (editName.trim() && editName !== m.name) onRename(editName.trim()); else setEditName(m.name); };

  return (
    <div className={`px-3 py-2 flex items-start gap-2 cursor-pointer transition-colors ${selected ? 'bg-accent-tint-soft' : 'hover:bg-surf-app'}`} onClick={onSelect}>
      <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: effectiveColor + '20' }}>
        <TypeIcon className="h-3 w-3" style={{ color: effectiveColor }} />
      </div>
      <div className="flex-1 min-w-0">
        {editing ? (
          <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)} onBlur={commitRename}
            onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') { setEditing(false); setEditName(m.name); } }}
            className="text-xs font-medium text-fg-800 w-full bg-surf-card border border-accent-tint-border rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus-visible:ring-focus"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="text-xs font-medium text-fg-700 cursor-text hover:text-accent-text block truncate"
            onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }}>{m.name}</span>
        )}
        <span className="text-[11px] text-fg-500 font-mono">{displayValue}</span>
        <div className="flex items-center gap-1 flex-wrap mt-0.5">
          {category && (
            <span className="text-[9px] rounded px-1 font-medium" style={{ backgroundColor: category.color + '22', color: category.color }}>{category.name}</span>
          )}
          {m.group && <span className="text-[9px] bg-surf-muted text-fg-500 rounded px-1">{m.group}</span>}
          {m.linkedProduct && (
            <span
              className="text-[9px] bg-accent-tint-soft text-accent-text rounded px-1 inline-flex items-center gap-0.5 max-w-[11rem]"
              title={`Linked to ${m.linkedProduct.label}`}
            >
              <Link2 className="h-2.5 w-2.5 flex-shrink-0" />
              <span className="truncate">{m.linkedProduct.label}</span>
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-0.5 flex-shrink-0">
        {linkable && (
          <button
            onClick={(e) => { e.stopPropagation(); onLink(); }}
            className={`p-1 rounded ${m.linkedProduct ? 'text-accent-text hover:bg-accent-tint-soft' : 'text-fg-400 hover:text-fg-600 hover:bg-surf-muted'}`}
            title={m.linkedProduct ? `Linked: ${m.linkedProduct.label}` : 'Link to price list'}
          >
            {m.linkedProduct ? <Link2 className="h-3 w-3" /> : <Link2Off className="h-3 w-3" />}
          </button>
        )}
        <button onClick={(e) => { e.stopPropagation(); handleCopy(); }} className="p-1 rounded text-fg-400 hover:text-fg-600 hover:bg-surf-muted" title="Copy">
          {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
        </button>
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1 rounded text-fg-400 hover:text-red-500 hover:bg-status-red-bg" title="Delete">
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

function AnnotationRow({ annotation: a, onDelete }: { annotation: Annotation; onDelete: () => void }) {
  return (
    <div className="px-3 py-1.5 flex items-center gap-2 hover:bg-surf-app">
      <Type className="h-3 w-3 flex-shrink-0" style={{ color: a.color }} />
      <span className="text-xs text-fg-600 flex-1 truncate">{a.text}</span>
      <button onClick={onDelete} className="p-1 rounded text-fg-400 hover:text-red-500 hover:bg-status-red-bg"><Trash2 className="h-3 w-3" /></button>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────

function getDisplayValue(m: Measurement, displayUnit: MeasurementUnit, allMeasurements: Measurement[] = []): string {
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
    const f = displayUnit === m.unit ? 1 : (convertUnit(1, m.unit, displayUnit) ** 2);
    const cutouts = getCutoutsFor(m.id, allMeasurements);
    const netArea = getNetArea(m, allMeasurements) * f;
    const grossArea = m.realArea * f;
    if (cutouts.length > 0 && netArea !== grossArea) {
      return `${formatMeasurement(w, displayUnit)} × ${formatMeasurement(h, displayUnit)} · Net ${formatArea(netArea, displayUnit)} (gross ${formatArea(grossArea, displayUnit)})`;
    }
    return `${formatMeasurement(w, displayUnit)} × ${formatMeasurement(h, displayUnit)} = ${formatArea(grossArea, displayUnit)}`;
  }
  if (m.type === 'angle') return formatAngle(m.degrees);
  if (m.type === 'polygon') {
    const f = displayUnit === m.unit ? 1 : (convertUnit(1, m.unit, displayUnit) ** 2);
    const cutouts = getCutoutsFor(m.id, allMeasurements);
    const grossArea = m.realArea * f;
    const netArea = getNetArea(m, allMeasurements) * f;
    const perimeter = formatMeasurement(displayUnit === m.unit ? m.realPerimeter : convertUnit(m.realPerimeter, m.unit, displayUnit), displayUnit);
    if (cutouts.length > 0 && netArea !== grossArea) {
      return `Net ${formatArea(netArea, displayUnit)} (gross ${formatArea(grossArea, displayUnit)}), perimeter ${perimeter}`;
    }
    return `${formatArea(grossArea, displayUnit)}, perimeter ${perimeter}`;
  }
  if (m.type === 'count') return `#${m.number}`;
  if (m.type === 'cutout') {
    const f = displayUnit === m.unit ? 1 : (convertUnit(1, m.unit, displayUnit) ** 2);
    return `− ${formatArea(m.realArea * f, displayUnit)}`;
  }
  return '';
}
