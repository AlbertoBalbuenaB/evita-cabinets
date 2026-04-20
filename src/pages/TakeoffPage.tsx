import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Link2 } from 'lucide-react';
import { useTakeoffStore } from '../hooks/useTakeoffStore';
import { ACCEPTED_FILE_TYPES } from '../lib/takeoff/pdfLoader';
import { PdfDropZone } from '../components/takeoff/PdfDropZone';
import { PdfCanvas, type PdfCanvasHandle } from '../components/takeoff/PdfCanvas';
import { Toolbar } from '../components/takeoff/Toolbar';
import { MeasurementsPanel } from '../components/takeoff/MeasurementsPanel';
import { CalibrationModal } from '../components/takeoff/CalibrationModal';
import { Modal } from '../components/Modal';
import { Input } from '../components/Input';
import { Button } from '../components/Button';

export function TakeoffPage() {
  const [file, setFile] = useState<File | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const [showUrlModal, setShowUrlModal] = useState(false);
  const [annotationText, setAnnotationText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasHandle = useRef<PdfCanvasHandle>(null);

  const store = useTakeoffStore();
  const {
    viewport, activeTool, currentPage, pageCount, calibrations,
    showCalibrationModal, activePoints, unit, showCrosshair,
    snapEnabled, showGrid, undoStack, redoStack,
    showAnnotationInput, pendingAnnotationPos,
  } = store;

  const calibration = calibrations[currentPage] ?? null;

  useEffect(() => { store.reset(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFile = useCallback((f: File) => { store.reset(); setFile(f); }, [store]);

  const handleUploadClick = useCallback(() => { fileInputRef.current?.click(); }, []);

  const handleZoomIn = useCallback(() => {
    const z = useTakeoffStore.getState().viewport.zoom;
    store.setViewport({ zoom: Math.min(20, z * 1.25) });
  }, [store]);

  const handleZoomOut = useCallback(() => {
    const z = useTakeoffStore.getState().viewport.zoom;
    store.setViewport({ zoom: Math.max(0.1, z / 1.25) });
  }, [store]);

  const handleFit = useCallback(() => { canvasHandle.current?.fitToScreen(); }, []);

  // ── Export image with measurements ────────────────────
  const handleExportImage = useCallback(() => {
    const canvas = canvasHandle.current?.getCanvasElement();
    const svg = canvasHandle.current?.getSvgElement();
    const container = canvasHandle.current?.getContainerElement();
    if (!canvas || !svg || !container) return;

    const rect = container.getBoundingClientRect();
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = rect.width * 2;
    exportCanvas.height = rect.height * 2;
    const ctx = exportCanvas.getContext('2d')!;
    ctx.scale(2, 2);

    // Draw white background
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(0, 0, rect.width, rect.height);

    // Draw PDF canvas with its transform
    ctx.save();
    const vp = useTakeoffStore.getState().viewport;
    ctx.translate(vp.offsetX, vp.offsetY);
    ctx.scale(vp.zoom, vp.zoom);
    ctx.drawImage(canvas, 0, 0);
    ctx.restore();

    // Draw SVG overlay
    const svgData = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, rect.width, rect.height);
      URL.revokeObjectURL(url);
      exportCanvas.toBlob((blob) => {
        if (!blob) return;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'takeoff.png';
        a.click();
      });
    };
    img.src = url;
  }, []);

  // ── Import from URL ────────────────────────────────────
  const handleUrlImport = useCallback(async () => {
    if (!urlInput.trim()) return;
    try {
      const resp = await fetch(urlInput.trim());
      const blob = await resp.blob();
      const ext = urlInput.split('.').pop()?.toLowerCase() || 'pdf';
      const f = new File([blob], `imported.${ext}`, { type: blob.type });
      handleFile(f);
      setShowUrlModal(false);
      setUrlInput('');
    } catch {
      // Silently fail — CORS or network error
    }
  }, [urlInput, handleFile]);

  // ── Annotation submit ──────────────────────────────────
  const handleAnnotationSubmit = () => {
    if (!annotationText.trim() || !pendingAnnotationPos) return;
    store.addAnnotation({
      id: crypto.randomUUID(),
      text: annotationText.trim(),
      position: pendingAnnotationPos,
      color: store.nextColor(),
      page: currentPage,
    });
    setAnnotationText('');
  };

  // ── Keyboard shortcuts ─────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); useTakeoffStore.getState().undo(); return; }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z') && e.shiftKey) { e.preventDefault(); useTakeoffStore.getState().redo(); return; }
      if (e.key === 'Escape') {
        const s = useTakeoffStore.getState();
        if (s.showAnnotationInput) { s.setShowAnnotationInput(false); s.setPendingAnnotationPos(null); return; }
        if (s.activePoints.length > 0) { s.clearActivePoints(); return; }
        if (s.selectedMeasurementId) { s.selectMeasurement(null); return; }
        s.setActiveTool('pan');
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const s = useTakeoffStore.getState();
        if (s.selectedMeasurementId) { s.deleteMeasurement(s.selectedMeasurementId); return; }
      }

      const s = useTakeoffStore.getState();
      const cal = s.calibrations[s.currentPage];
      const shortcuts: Record<string, () => void> = {
        v: () => s.setActiveTool('pan'),
        s: () => s.setActiveTool('select'),
        c: () => s.setActiveTool('calibrate'),
        l: () => cal && s.setActiveTool('line'),
        m: () => cal && s.setActiveTool('multiline'),
        r: () => cal && s.setActiveTool('rectangle'),
        a: () => s.setActiveTool('angle'),
        p: () => cal && s.setActiveTool('polygon'),
        n: () => s.setActiveTool('count'),
        x: () => cal && s.setActiveTool('cutout'),
        t: () => s.setActiveTool('annotate'),
        f: () => canvasHandle.current?.fitToScreen(),
        g: () => s.toggleGrid(),
      };
      const fn = shortcuts[e.key.toLowerCase()];
      if (fn) fn();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleCalibrationConfirm = useCallback(
    (cal: Parameters<typeof store.setCalibration>[0]) => { store.setCalibration(cal); },
    [store]
  );

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-3 py-1.5 border-b border-slate-200 bg-white/80 backdrop-blur-sm flex-shrink-0">
        <Link to="/tools" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Tools
        </Link>
        <span className="text-sm font-semibold text-slate-800">Evita Takeoff</span>
        {file && <span className="text-xs text-slate-400 truncate max-w-xs">{file.name}</span>}
        {!file && (
          <button onClick={() => setShowUrlModal(true)} className="ml-auto inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700">
            <Link2 className="h-3.5 w-3.5" /> Import from URL
          </button>
        )}
      </div>

      {file ? (
        <>
          <Toolbar
            activeTool={activeTool} onToolChange={store.setActiveTool}
            zoom={viewport.zoom} onZoomIn={handleZoomIn} onZoomOut={handleZoomOut} onFit={handleFit}
            currentPage={currentPage} pageCount={pageCount} onPageChange={store.setCurrentPage}
            unit={unit} onUnitChange={store.setUnit}
            showCrosshair={showCrosshair} onToggleCrosshair={store.toggleCrosshair}
            snapEnabled={snapEnabled} onToggleSnap={store.toggleSnap}
            showGrid={showGrid} onToggleGrid={store.toggleGrid}
            canUndo={undoStack.length > 0} canRedo={redoStack.length > 0}
            onUndo={store.undo} onRedo={store.redo}
            onUpload={handleUploadClick} onExport={handleExportImage}
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

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept={ACCEPTED_FILE_TYPES} className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
      />

      {/* Calibration modal */}
      {showCalibrationModal && activePoints.length >= 2 && (
        <CalibrationModal isOpen onClose={() => { store.setShowCalibrationModal(false); store.clearActivePoints(); }}
          pointA={activePoints[0]} pointB={activePoints[1]} onConfirm={handleCalibrationConfirm}
        />
      )}

      {/* Annotation input modal */}
      {showAnnotationInput && pendingAnnotationPos && (
        <Modal isOpen onClose={() => { store.setShowAnnotationInput(false); store.setPendingAnnotationPos(null); setAnnotationText(''); }} title="Add Annotation" size="sm">
          <div className="space-y-3">
            <Input label="Label text" value={annotationText} onChange={(e) => setAnnotationText(e.target.value)} autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleAnnotationSubmit(); }}
              placeholder="e.g. ISLAND, PANTRY, SINK..."
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => { store.setShowAnnotationInput(false); setAnnotationText(''); }}>Cancel</Button>
              <Button variant="primary" size="sm" onClick={handleAnnotationSubmit} disabled={!annotationText.trim()}>Add</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* URL import modal */}
      {showUrlModal && (
        <Modal isOpen onClose={() => setShowUrlModal(false)} title="Import from URL" size="sm">
          <div className="space-y-3">
            <Input label="File URL" value={urlInput} onChange={(e) => setUrlInput(e.target.value)} autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleUrlImport(); }}
              placeholder="https://example.com/plan.pdf"
            />
            <p className="text-xs text-slate-400">Paste a direct link to a PDF or image file</p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowUrlModal(false)}>Cancel</Button>
              <Button variant="primary" size="sm" onClick={handleUrlImport} disabled={!urlInput.trim()}>Import</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
