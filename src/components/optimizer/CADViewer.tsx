import { useRef, useEffect, useCallback, useState } from 'react';
import { BoardResult, UnitSystem } from '../../lib/optimizer/types';
import { renderBoardCAD, hitTestPiece } from '../../lib/optimizer/engine';
import { ZoomIn, ZoomOut, Maximize2, Ruler, Tag, Layers, Scissors, Wheat, PanelTop } from 'lucide-react';

const MIN_ZOOM = 0.015;
const MAX_ZOOM = 30;

interface Props {
  board: BoardResult | null;
  unit: UnitSystem;
}

export function CADViewer({ board, unit }: Props) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef({ x: 0, y: 0 });

  const [zoom, setZoom]               = useState(1);
  const [offset, setOffset]           = useState({ x: 40, y: 40 });
  const [isDragging, setIsDragging]   = useState(false);
  const [showLabels, setShowLabels]   = useState(true);
  const [showDimensions, setShowDimensions] = useState(true);
  const [showKerf, setShowKerf]       = useState(false);
  const [showOffcuts, setShowOffcuts] = useState(true);
  const [showGrain, setShowGrain]     = useState(true);
  const [showEdgeBand, setShowEdgeBand] = useState(true);
  const [hoverIdx, setHoverIdx]       = useState<number | null>(null);

  const fitToView = useCallback(() => {
    if (!board || !containerRef.current) return;
    const { offsetWidth: cw, offsetHeight: ch } = containerRef.current;
    const margin = 48;
    const availW = cw - margin * 2;
    const availH = ch - margin * 2;
    if (availW <= 0 || availH <= 0) return;
    const newZoom = Math.min(availW / board.ancho, availH / board.alto);
    setZoom(newZoom);
    setOffset({
      x: (availW - board.ancho * newZoom) / 2 + margin,
      y: (availH - board.alto * newZoom) / 2 + margin,
    });
  }, [board]);

  useEffect(() => { fitToView(); }, [board]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !board) return;
    renderBoardCAD(canvas, board, {
      zoom, offsetX: offset.x, offsetY: offset.y,
      showLabels, showDimensions, showKerf, showOffcuts, showGrain, showEdgeBand,
      hoverPieceIdx: hoverIdx, unit,
    });
  }, [board, zoom, offset, showLabels, showDimensions, showKerf, showOffcuts, showGrain, showEdgeBand, hoverIdx, unit]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => fitToView());
    ro.observe(container);
    return () => ro.disconnect();
  }, [fitToView]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      setZoom((prev) => {
        const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev * factor));
        setOffset((prevOff) => ({
          x: mouseX - (mouseX - prevOff.x) * (newZoom / prev),
          y: mouseY - (mouseY - prevOff.y) * (newZoom / prev),
        }));
        return newZoom;
      });
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setOffset({ x: e.clientX - dragStartRef.current.x, y: e.clientY - dragStartRef.current.y });
      return;
    }
    if (!board || !canvasRef.current) { setHoverIdx(null); return; }
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const hit = hitTestPiece(board, zoom, offset.x, offset.y, mx, my);
    setHoverIdx(hit);
  };
  const handleMouseUp = () => setIsDragging(false);
  const handleMouseLeave = () => { setIsDragging(false); setHoverIdx(null); };

  const ToolBtn = ({
    icon: Icon, active, onClick, title, activeColor = 'text-blue-600 bg-blue-50',
  }: { icon: React.ComponentType<{ className?: string }>; active?: boolean; onClick: () => void; title: string; activeColor?: string }) => (
    <button onClick={onClick} title={title}
      className={`p-1.5 rounded transition-colors ${active ? activeColor : 'text-slate-500 hover:bg-slate-100'}`}>
      <Icon className="h-4 w-4" />
    </button>
  );

  if (!board) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-100">
        <div className="text-center select-none">
          <div className="text-5xl mb-3">⬜</div>
          <p className="text-slate-400 text-sm">Run optimization and select a sheet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-100 min-w-0">
      <div className="bg-white border-b border-slate-200 px-2 py-1 flex items-center gap-0.5 shrink-0">
        <ToolBtn icon={ZoomIn}    onClick={() => setZoom(z => Math.min(MAX_ZOOM, z * 1.25))} title="Zoom in" />
        <ToolBtn icon={ZoomOut}   onClick={() => setZoom(z => Math.max(MIN_ZOOM, z / 1.25))} title="Zoom out" />
        <ToolBtn icon={Maximize2} onClick={fitToView} title="Fit to screen" />
        <span className="text-xs text-slate-400 px-1.5 tabular-nums w-10 text-center select-none">
          {Math.round(zoom * 100)}%
        </span>
        <div className="w-px h-4 bg-slate-200 mx-1" />
        <ToolBtn icon={Ruler}    active={showDimensions} onClick={() => setShowDimensions(v => !v)} title="Show dimensions" />
        <ToolBtn icon={Tag}      active={showLabels}     onClick={() => setShowLabels(v => !v)}     title="Show labels" />
        <ToolBtn icon={Wheat}    active={showGrain}      onClick={() => setShowGrain(v => !v)}      title="Show grain"
          activeColor="text-amber-600 bg-amber-50" />
        <ToolBtn icon={PanelTop} active={showEdgeBand}  onClick={() => setShowEdgeBand(v => !v)}  title="Show edge band"
          activeColor="text-slate-800 bg-slate-100" />
        <ToolBtn icon={Layers}   active={showOffcuts}    onClick={() => setShowOffcuts(v => !v)}    title="Show offcuts"
          activeColor="text-green-600 bg-green-50" />
        <ToolBtn icon={Scissors} active={showKerf}       onClick={() => setShowKerf(v => !v)}       title="Show kerf"
          activeColor="text-red-500 bg-red-50" />
      </div>

      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden select-none"
        style={{ cursor: isDragging ? 'grabbing' : hoverIdx !== null ? 'crosshair' : 'grab' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      </div>
    </div>
  );
}
