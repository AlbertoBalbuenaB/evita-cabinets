import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { usePlanViewerStore } from '../hooks/usePlanViewerStore';
import { ACCEPTED_FILE_TYPES } from '../lib/plan-viewer/pdfLoader';
import { PdfDropZone } from '../components/plan-viewer/PdfDropZone';
import { PdfCanvas, type PdfCanvasHandle } from '../components/plan-viewer/PdfCanvas';
import { Toolbar } from '../components/plan-viewer/Toolbar';
import { MeasurementsPanel } from '../components/plan-viewer/MeasurementsPanel';
import { CalibrationModal } from '../components/plan-viewer/CalibrationModal';

export function PlanViewerPage() {
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasHandle = useRef<PdfCanvasHandle>(null);

  const store = usePlanViewerStore();
  const {
    viewport,
    activeTool,
    currentPage,
    pageCount,
    calibration,
    showCalibrationModal,
    activePoints,
    unit,
    showCrosshair,
    undoStack,
    redoStack,
  } = store;

  // Reset store when component mounts
  useEffect(() => {
    store.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFile = useCallback(
    (f: File) => {
      store.reset();
      setFile(f);
    },
    [store]
  );

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleZoomIn = useCallback(() => {
    const z = usePlanViewerStore.getState().viewport.zoom;
    store.setViewport({ zoom: Math.min(20, z * 1.25) });
  }, [store]);

  const handleZoomOut = useCallback(() => {
    const z = usePlanViewerStore.getState().viewport.zoom;
    store.setViewport({ zoom: Math.max(0.1, z / 1.25) });
  }, [store]);

  const handleFit = useCallback(() => {
    canvasHandle.current?.fitToScreen();
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        usePlanViewerStore.getState().undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z') && e.shiftKey) {
        e.preventDefault();
        usePlanViewerStore.getState().redo();
        return;
      }
      if (e.key === 'Escape') {
        const s = usePlanViewerStore.getState();
        if (s.activePoints.length > 0) {
          s.clearActivePoints();
        } else {
          s.setActiveTool('pan');
        }
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const s = usePlanViewerStore.getState();
        if (s.selectedMeasurementId) {
          s.deleteMeasurement(s.selectedMeasurementId);
          return;
        }
      }

      const s = usePlanViewerStore.getState();
      const shortcuts: Record<string, () => void> = {
        v: () => s.setActiveTool('pan'),
        c: () => s.setActiveTool('calibrate'),
        l: () => s.calibration && s.setActiveTool('line'),
        m: () => s.calibration && s.setActiveTool('multiline'),
        r: () => s.calibration && s.setActiveTool('rectangle'),
        f: () => canvasHandle.current?.fitToScreen(),
      };
      const fn = shortcuts[e.key.toLowerCase()];
      if (fn) fn();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleCalibrationConfirm = useCallback(
    (cal: Parameters<typeof store.setCalibration>[0]) => {
      store.setCalibration(cal);
    },
    [store]
  );

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col">
      {/* Header bar */}
      <div className="flex items-center gap-3 px-3 py-1.5 border-b border-slate-200 bg-white/80 backdrop-blur-sm flex-shrink-0">
        <Link
          to="/tools"
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Tools
        </Link>
        <span className="text-sm font-semibold text-slate-800">Plan Viewer</span>
        {file && (
          <span className="text-xs text-slate-400 truncate max-w-xs">{file.name}</span>
        )}
      </div>

      {file ? (
        <>
          <Toolbar
            activeTool={activeTool}
            onToolChange={store.setActiveTool}
            zoom={viewport.zoom}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onFit={handleFit}
            currentPage={currentPage}
            pageCount={pageCount}
            onPageChange={store.setCurrentPage}
            unit={unit}
            onUnitChange={store.setUnit}
            showCrosshair={showCrosshair}
            onToggleCrosshair={store.toggleCrosshair}
            canUndo={undoStack.length > 0}
            canRedo={redoStack.length > 0}
            onUndo={store.undo}
            onRedo={store.redo}
            onUpload={handleUploadClick}
            isCalibrated={!!calibration}
          />
          <div className="flex flex-1 overflow-hidden">
            <PdfCanvas ref={canvasHandle} file={file} />
            <MeasurementsPanel />
          </div>
        </>
      ) : (
        <PdfDropZone onFile={handleFile} />
      )}

      {/* Hidden file input for re-upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_FILE_TYPES}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = '';
        }}
      />

      {/* Calibration modal */}
      {showCalibrationModal && activePoints.length >= 2 && (
        <CalibrationModal
          isOpen={true}
          onClose={() => {
            store.setShowCalibrationModal(false);
            store.clearActivePoints();
          }}
          pointA={activePoints[0]}
          pointB={activePoints[1]}
          onConfirm={handleCalibrationConfirm}
        />
      )}
    </div>
  );
}
