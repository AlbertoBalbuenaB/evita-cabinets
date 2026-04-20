import {
  Hand, MousePointer2, Ruler, Minus, Route, Square, Hexagon, Locate, Type, Hash, Scissors,
  ZoomIn, ZoomOut, Maximize2,
  ChevronLeft, ChevronRight,
  Undo2, Redo2, Crosshair, Magnet, Grid3x3,
  Upload, Download,
} from 'lucide-react';
import type { ToolMode, MeasurementUnit } from '../../lib/takeoff/types';

interface ToolbarProps {
  activeTool: ToolMode;
  onToolChange: (tool: ToolMode) => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  currentPage: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  unit: MeasurementUnit;
  onUnitChange: (u: MeasurementUnit) => void;
  showCrosshair: boolean;
  onToggleCrosshair: () => void;
  snapEnabled: boolean;
  onToggleSnap: () => void;
  showGrid: boolean;
  onToggleGrid: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onUpload: () => void;
  onExport: () => void;
  isCalibrated: boolean;
}

const tools: { mode: ToolMode; icon: typeof Hand; label: string; shortcut: string; needsCal?: boolean; hint?: string }[] = [
  { mode: 'select', icon: MousePointer2, label: 'Select', shortcut: 'S' },
  { mode: 'pan', icon: Hand, label: 'Pan', shortcut: 'V' },
  { mode: 'calibrate', icon: Ruler, label: 'Calibrate', shortcut: 'C' },
  { mode: 'line', icon: Minus, label: 'Line', shortcut: 'L', needsCal: true },
  { mode: 'multiline', icon: Route, label: 'Multi-line', shortcut: 'M', needsCal: true },
  { mode: 'rectangle', icon: Square, label: 'Rectangle', shortcut: 'R', needsCal: true },
  { mode: 'angle', icon: Locate, label: 'Angle', shortcut: 'A' },
  { mode: 'polygon', icon: Hexagon, label: 'Polygon', shortcut: 'P', needsCal: true },
  { mode: 'count', icon: Hash, label: 'Count', shortcut: 'N' },
  { mode: 'cutout', icon: Scissors, label: 'Cutout', shortcut: 'X', needsCal: true, hint: 'Select a rectangle/polygon first, then draw the cutout inside' },
  { mode: 'annotate', icon: Type, label: 'Annotate', shortcut: 'T' },
];

const unitOptions: { value: MeasurementUnit; label: string }[] = [
  { value: 'in', label: 'in' },
  { value: 'ft', label: 'ft' },
  { value: 'cm', label: 'cm' },
  { value: 'mm', label: 'mm' },
];

function ToolBtn({ active, onClick, title, disabled, children }: {
  active?: boolean; onClick: () => void; title: string; disabled?: boolean; children: React.ReactNode;
}) {
  return (
    <button onClick={onClick} disabled={disabled} title={title}
      className={`p-1.5 rounded-md transition-colors ${
        active ? 'bg-blue-100 text-blue-700 shadow-sm'
        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed'
      }`}
    >{children}</button>
  );
}

function Divider() { return <div className="w-px h-6 bg-slate-200 mx-1" />; }

export function Toolbar({
  activeTool, onToolChange, zoom, onZoomIn, onZoomOut, onFit,
  currentPage, pageCount, onPageChange, unit, onUnitChange,
  showCrosshair, onToggleCrosshair, snapEnabled, onToggleSnap,
  showGrid, onToggleGrid, canUndo, canRedo, onUndo, onRedo,
  onUpload, onExport, isCalibrated,
}: ToolbarProps) {
  return (
    <div className="flex items-center gap-1 px-3 py-1.5 border-b border-slate-200 bg-white/80 backdrop-blur-sm flex-shrink-0 overflow-x-auto">
      {tools.map((t) => {
        const Icon = t.icon;
        const disabled = t.needsCal && !isCalibrated;
        const hint = t.hint ? ` — ${t.hint}` : '';
        return (
          <ToolBtn key={t.mode} active={activeTool === t.mode}
            onClick={() => onToolChange(t.mode)}
            title={`${t.label} (${t.shortcut})${disabled ? ' — calibrate first' : hint}`}
            disabled={disabled}
          ><Icon className="h-4 w-4" /></ToolBtn>
        );
      })}

      <Divider />

      <ToolBtn onClick={onZoomOut} title="Zoom out"><ZoomOut className="h-4 w-4" /></ToolBtn>
      <span className="text-xs text-slate-500 font-medium w-12 text-center tabular-nums select-none">{Math.round(zoom * 100)}%</span>
      <ToolBtn onClick={onZoomIn} title="Zoom in"><ZoomIn className="h-4 w-4" /></ToolBtn>
      <ToolBtn onClick={onFit} title="Fit to screen (F)"><Maximize2 className="h-4 w-4" /></ToolBtn>

      <Divider />

      {pageCount > 1 && (
        <>
          <ToolBtn onClick={() => onPageChange(currentPage - 1)} disabled={currentPage <= 1} title="Previous page"><ChevronLeft className="h-4 w-4" /></ToolBtn>
          <span className="text-xs text-slate-500 font-medium px-1 select-none tabular-nums">{currentPage}/{pageCount}</span>
          <ToolBtn onClick={() => onPageChange(currentPage + 1)} disabled={currentPage >= pageCount} title="Next page"><ChevronRight className="h-4 w-4" /></ToolBtn>
          <Divider />
        </>
      )}

      <select value={unit} onChange={(e) => onUnitChange(e.target.value as MeasurementUnit)}
        className="text-xs border border-slate-200 rounded-md px-1.5 py-1 text-slate-600 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500" title="Display unit">
        {unitOptions.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
      </select>

      <Divider />

      <ToolBtn active={snapEnabled} onClick={onToggleSnap} title="Snap to 45° angles"><Magnet className="h-4 w-4" /></ToolBtn>
      <ToolBtn active={showGrid} onClick={onToggleGrid} title="Toggle grid (G)"><Grid3x3 className="h-4 w-4" /></ToolBtn>
      <ToolBtn active={showCrosshair} onClick={onToggleCrosshair} title="Toggle crosshair"><Crosshair className="h-4 w-4" /></ToolBtn>

      <ToolBtn onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)"><Undo2 className="h-4 w-4" /></ToolBtn>
      <ToolBtn onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)"><Redo2 className="h-4 w-4" /></ToolBtn>

      <div className="flex-1" />

      <ToolBtn onClick={onExport} title="Export image with measurements"><Download className="h-4 w-4" /></ToolBtn>
      <ToolBtn onClick={onUpload} title="Upload new file"><Upload className="h-4 w-4" /></ToolBtn>
    </div>
  );
}
