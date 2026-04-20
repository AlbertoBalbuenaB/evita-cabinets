import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Link2, UploadCloud, FolderOpen } from 'lucide-react';
import { useTakeoffStore } from '../hooks/useTakeoffStore';
import { ACCEPTED_FILE_TYPES } from '../lib/takeoff/pdfLoader';
import { loadSessionFromSupabase, listCommentsForSession, fetchSingleComment } from '../lib/takeoff/supabase';
import { supabase } from '../lib/supabase';
import { PdfDropZone } from '../components/takeoff/PdfDropZone';
import { PdfCanvas, type PdfCanvasHandle } from '../components/takeoff/PdfCanvas';
import { Toolbar } from '../components/takeoff/Toolbar';
import { MeasurementsPanel } from '../components/takeoff/MeasurementsPanel';
import { CalibrationModal } from '../components/takeoff/CalibrationModal';
import { SaveSessionModal } from '../components/takeoff/SaveSessionModal';
import { SessionsList } from '../components/takeoff/SessionsList';
import { CommentInputModal } from '../components/takeoff/CommentInputModal';
import { CommentThread } from '../components/takeoff/CommentThread';
import { Modal } from '../components/Modal';
import { Input } from '../components/Input';
import { Button } from '../components/Button';

export function TakeoffPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const querySessionId = searchParams.get('session');
  const queryProjectId = searchParams.get('project');

  const [file, setFile] = useState<File | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const [showUrlModal, setShowUrlModal] = useState(false);
  const [annotationText, setAnnotationText] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showSessionsList, setShowSessionsList] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasHandle = useRef<PdfCanvasHandle>(null);

  const store = useTakeoffStore();
  const {
    viewport, activeTool, currentPage, pageCount, calibrations,
    showCalibrationModal, activePoints, unit, showCrosshair,
    snapEnabled, showGrid, undoStack, redoStack,
    showAnnotationInput, pendingAnnotationPos,
    sessionName, sessionProjectId, currentSessionId,
  } = store;

  const calibration = calibrations[currentPage] ?? null;

  useEffect(() => { store.reset(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFile = useCallback((f: File) => { store.reset(); setFile(f); }, [store]);

  // Load a Supabase session: fetches row + PDF, hydrates the store, and replaces the file.
  const handleOpenSession = useCallback(async (sessionId: string) => {
    setLoadError(null);
    try {
      const result = await loadSessionFromSupabase(sessionId);
      if (!result) { setLoadError('Session not found.'); return; }
      store.reset();
      store.hydrateSessionData(result.session.session_data);
      store.setCurrentSession({
        id: result.session.id,
        name: result.session.name,
        projectId: result.session.project_id,
      });
      setFile(result.file);
      // Kick off comment hydration in the background — no await so the PDF can start
      // rendering immediately; pins will pop in once the fetch resolves.
      listCommentsForSession(sessionId)
        .then((rows) => store.setComments(rows))
        .catch((err) => console.warn('Failed to load comments', err));
      // URL sync so refresh keeps the same session loaded.
      setSearchParams((sp) => {
        const next = new URLSearchParams(sp);
        next.set('session', sessionId);
        next.delete('project');
        return next;
      }, { replace: true });
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    }
  }, [store, setSearchParams]);

  // If the URL has ?session=<id>, load it once on mount.
  const hasLoadedQuerySession = useRef(false);
  useEffect(() => {
    if (hasLoadedQuerySession.current) return;
    if (!querySessionId) return;
    hasLoadedQuerySession.current = true;
    handleOpenSession(querySessionId);
  }, [querySessionId, handleOpenSession]);

  // Realtime subscription for threaded comments. Re-subscribes whenever the session
  // identity changes (open a different session, or reset to standalone). Follows the
  // same pattern as src/lib/useNotifications.ts — channel scoped by the session id,
  // supabase.removeChannel() in the cleanup.
  useEffect(() => {
    if (!currentSessionId) return;
    const sessionId = currentSessionId;
    const channel = supabase
      .channel(`takeoff_comments:${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'takeoff_comments',
          filter: `session_id=eq.${sessionId}`,
        },
        async (payload) => {
          if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as { id?: string } | null)?.id;
            if (oldId) store.removeCommentLocal(oldId);
            return;
          }
          // INSERT or UPDATE — payload.new carries raw columns only, so fetch the row
          // again with the author join to keep the local cache consistent with what
          // listCommentsForSession would return.
          const newId = (payload.new as { id?: string } | null)?.id;
          if (!newId) return;
          try {
            const full = await fetchSingleComment(newId);
            if (full) store.upsertCommentLocal(full);
          } catch (err) {
            console.warn('Failed to hydrate realtime comment', err);
          }
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentSessionId, store]);

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
        if (s.showCommentInput) { s.setShowCommentInput(false); s.setPendingCommentPos(null); return; }
        if (s.openCommentId) { s.setOpenComment(null); return; }
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
        o: () => s.setActiveTool('comment'),
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
        {file && (
          <>
            <span className="text-xs text-slate-600 font-medium truncate max-w-xs">
              {sessionName ?? file.name}
            </span>
            {currentSessionId && (
              <span className="text-[10px] bg-emerald-50 text-emerald-700 rounded px-1.5 py-0.5 flex-shrink-0">
                {sessionProjectId ? 'project' : 'saved'}
              </span>
            )}
          </>
        )}
        <div className="ml-auto flex items-center gap-2">
          {loadError && <span className="text-xs text-red-600 truncate max-w-xs">{loadError}</span>}
          <button
            onClick={() => setShowSessionsList(true)}
            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
            title="Open a saved session"
          >
            <FolderOpen className="h-3.5 w-3.5" /> Open
          </button>
          {file && (
            <button
              onClick={() => setShowSaveModal(true)}
              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
              title={currentSessionId ? 'Update this saved session' : 'Save to Supabase'}
            >
              <UploadCloud className="h-3.5 w-3.5" />
              {currentSessionId ? 'Update' : 'Save to cloud'}
            </button>
          )}
          {!file && (
            <button onClick={() => setShowUrlModal(true)} className="inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700">
              <Link2 className="h-3.5 w-3.5" /> Import from URL
            </button>
          )}
        </div>
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

      {/* Save to Supabase modal */}
      <SaveSessionModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        file={file}
        defaultProjectId={queryProjectId ?? null}
        lockProject={!!queryProjectId && !currentSessionId}
        onSaved={(sessionId) => {
          // Keep the URL in sync so a refresh preserves the session identity.
          setSearchParams((sp) => {
            const next = new URLSearchParams(sp);
            next.set('session', sessionId);
            next.delete('project');
            return next;
          }, { replace: true });
        }}
      />

      {/* Sessions list modal */}
      <SessionsList
        isOpen={showSessionsList}
        onClose={() => setShowSessionsList(false)}
        onOpen={handleOpenSession}
      />

      {/* Comment modals (render unconditionally — they return null when not active) */}
      <CommentInputModal />
      <CommentThread />
    </div>
  );
}
