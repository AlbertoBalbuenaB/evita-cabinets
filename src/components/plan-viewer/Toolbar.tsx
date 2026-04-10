import {
  Hand,
  Ruler,
  Minus,
  Route,
  Square,
  ZoomIn,
  ZoomOut,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  Undo2,
  Redo2,
  Crosshair,
  Upload,
} from 'lucide-react';
import type { ToolMode, MeasurementUnit } from '../../lib/plan-viewer/types';

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
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onUpload: () => void;
  isCalibrated: boolean;
}

const tools: { mode: ToolMode; icon: typeof Hand; label: string; shortcut: string }[] = [
  { mode: 'pan', icon: Hand, label: 'Pan', shortcut: 'V' },
  { mode: 'calibrate', icon: Ruler, label: 'Calibrate', shortcut: 'C' },
  { mode: 'line', icon: Minus, label: 'Line', shortcut: 'L' },
  { mode: 'multiline', icon: Route, label: 'Multi-line', shortcut: 'M' },
  { mode: 'rectangle', icon: Square, label: 'Rectangle', shortcut: 'R' },
];

const unitOptions: { value: MeasurementUnit; label: string }[] = [
  { value: 'in', label: 'in' },
  { value: 'ft', label: 'ft' },
  { value: 'cm', label: 'cm' },
  { value: 'mm', label: 'mm' },
];

function ToolBtn({
  active,
  onClick,
  title,
  disabled,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  title: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-1.5 rounded-md transition-colors ${
        active
          ? 'bg-blue-100 text-blue-700 shadow-sm'
          : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed'
      }`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="w-px h-6 bg-slate-200 mx-1" />;
}

export function Toolbar({
  activeTool,
  onToolChange,
  zoom,
  onZoomIn,
  onZoomOut,
  onFit,
  currentPage,
  pageCount,
  onPageChange,
  unit,
  onUnitChange,
  showCrosshair,
  onToggleCrosshair,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onUpload,
  isCalibrated,
}: ToolbarProps) {
  const measureTools: ToolMode[] = ['line', 'multiline', 'rectangle'];

  return (
    <div className="flex items-center gap-1 px-3 py-1.5 border-b border-slate-200 bg-white/80 backdrop-blur-sm flex-shrink-0">
      {/* Tool buttons */}
      {tools.map((t) => {
        const Icon = t.icon;
        const needsCal = measureTools.includes(t.mode) && !isCalibrated;
        return (
          <ToolBtn
            key={t.mode}
            active={activeTool === t.mode}
            onClick={() => onToolChange(t.mode)}
            title={`${t.label} (${t.shortcut})${needsCal ? ' — calibrate first' : ''}`}
            disabled={needsCal}
          >
            <Icon className="h-4 w-4" />
          </ToolBtn>
        );
      })}

      <Divider />

      {/* Zoom */}
      <ToolBtn onClick={onZoomOut} title="Zoom out">
        <ZoomOut className="h-4 w-4" />
      </ToolBtn>
      <span className="text-xs text-slate-500 font-medium w-12 text-center tabular-nums select-none">
        {Math.round(zoom * 100)}%
      </span>
      <ToolBtn onClick={onZoomIn} title="Zoom in">
        <ZoomIn className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn onClick={onFit} title="Fit to screen (F)">
        <Maximize2 className="h-4 w-4" />
      </ToolBtn>

      <Divider />

      {/* Page nav */}
      {pageCount > 1 && (
        <>
          <ToolBtn
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            title="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </ToolBtn>
          <span className="text-xs text-slate-500 font-medium px-1 select-none tabular-nums">
            {currentPage}/{pageCount}
          </span>
          <ToolBtn
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= pageCount}
            title="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </ToolBtn>
          <Divider />
        </>
      )}

      {/* Unit selector */}
      <select
        value={unit}
        onChange={(e) => onUnitChange(e.target.value as MeasurementUnit)}
        className="text-xs border border-slate-200 rounded-md px-1.5 py-1 text-slate-600 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
        title="Display unit"
      >
        {unitOptions.map((u) => (
          <option key={u.value} value={u.value}>
            {u.label}
          </option>
        ))}
      </select>

      <Divider />

      {/* Crosshair */}
      <ToolBtn
        active={showCrosshair}
        onClick={onToggleCrosshair}
        title="Toggle crosshair"
      >
        <Crosshair className="h-4 w-4" />
      </ToolBtn>

      {/* Undo/Redo */}
      <ToolBtn onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)">
        <Undo2 className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)">
        <Redo2 className="h-4 w-4" />
      </ToolBtn>

      <div className="flex-1" />

      {/* Upload */}
      <ToolBtn onClick={onUpload} title="Upload new PDF">
        <Upload className="h-4 w-4" />
      </ToolBtn>
    </div>
  );
}
