import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { Loader2, Check } from 'lucide-react';
import { Modal } from '../Modal';
import { Button } from '../Button';
import { loadPdf } from '../../lib/takeoff/pdfLoader';
import { buildTrimmedPdf, buildPageRemap } from '../../lib/takeoff/trimPages';

interface TrimPagesModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: File | null;
  onApply: (params: { newFile: File; remap: Map<number, number>; keepIndices: number[] }) => void | Promise<void>;
}

const THUMB_TARGET_WIDTH = 180;

export function TrimPagesModal({ isOpen, onClose, file, onApply }: TrimPagesModalProps) {
  const [pageCount, setPageCount] = useState(0);
  const [keep, setKeep] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [renderedPages, setRenderedPages] = useState<Set<number>>(new Set());
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const docRef = useRef<PDFDocumentProxy | null>(null);

  // Step 1: load the PDF and record page count.
  useEffect(() => {
    if (!isOpen || !file) return;
    let cancelled = false;
    setKeep(new Set());
    setRenderedPages(new Set());
    setError(null);
    setLoading(true);
    setPageCount(0);
    canvasRefs.current.clear();
    (async () => {
      try {
        const doc = await loadPdf(file);
        if (cancelled) { doc.destroy?.(); return; }
        docRef.current = doc;
        setPageCount(doc.numPages);
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      docRef.current?.destroy?.();
      docRef.current = null;
    };
  }, [isOpen, file]);

  // Step 2: render thumbnails sequentially once the grid exists in the DOM. This
  // effect runs after the first render that places the canvas elements, so the
  // ref callbacks have already populated canvasRefs.current.
  useEffect(() => {
    if (pageCount === 0 || !docRef.current) return;
    const doc = docRef.current;
    let cancelled = false;
    (async () => {
      for (let p = 1; p <= pageCount; p++) {
        if (cancelled) return;
        const canvas = canvasRefs.current.get(p);
        if (!canvas) continue;
        try {
          const page = await doc.getPage(p);
          const vp1 = page.getViewport({ scale: 1 });
          const scale = THUMB_TARGET_WIDTH / vp1.width;
          const vp = page.getViewport({ scale });
          canvas.width = vp.width;
          canvas.height = vp.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) continue;
          await page.render({ canvasContext: ctx, viewport: vp }).promise;
          if (!cancelled) setRenderedPages((prev) => {
            const next = new Set(prev);
            next.add(p);
            return next;
          });
        } catch (err) {
          if (!cancelled) console.warn(`Thumbnail render failed on page ${p}`, err);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [pageCount]);

  const toggle = (n: number) => {
    setKeep((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n); else next.add(n);
      return next;
    });
  };

  const markAll = () => setKeep(new Set(Array.from({ length: pageCount }, (_, i) => i + 1)));
  const clear = () => setKeep(new Set());

  const keepIndices = Array.from(keep).sort((a, b) => a - b);
  const wouldDelete = pageCount - keep.size;

  const handleApply = async () => {
    if (!file || keep.size === 0 || wouldDelete === 0) return;
    setApplying(true);
    setError(null);
    try {
      const newFile = await buildTrimmedPdf(file, keepIndices);
      const remap = buildPageRemap(keepIndices);
      await onApply({ newFile, remap, keepIndices });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setApplying(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Trim pages" size="xl">
      <div className="space-y-3">
        <p className="text-xs text-slate-500">
          Mark the pages you want to keep. Everything unmarked will be removed when you click the red button.
        </p>

        <div className="flex items-center gap-2 text-xs">
          <span className="font-medium text-slate-700">
            {keep.size} of {pageCount} kept
          </span>
          {keep.size > 0 && wouldDelete > 0 && (
            <span className="text-red-600">· {wouldDelete} will be deleted</span>
          )}
          <div className="flex-1" />
          <Button variant="ghost" size="sm" onClick={markAll} disabled={applying || pageCount === 0}>Keep all</Button>
          <Button variant="ghost" size="sm" onClick={clear} disabled={applying || keep.size === 0}>Clear</Button>
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}

        {loading ? (
          <div className="py-16 flex items-center justify-center text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => {
                const isKept = keep.has(p);
                const isRendered = renderedPages.has(p);
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => toggle(p)}
                    disabled={applying}
                    className={`relative group border-2 rounded-lg overflow-hidden transition-all bg-white ${
                      isKept
                        ? 'border-blue-500 ring-2 ring-blue-500/30'
                        : 'border-slate-200 hover:border-slate-300 opacity-70 hover:opacity-95'
                    } ${applying ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <div className="bg-slate-50 flex items-center justify-center aspect-[3/4]">
                      <canvas
                        ref={(el) => {
                          if (el) canvasRefs.current.set(p, el);
                          else canvasRefs.current.delete(p);
                        }}
                        className="max-w-full max-h-full"
                        style={{ display: isRendered ? 'block' : 'none' }}
                      />
                      {!isRendered && <Loader2 className="h-4 w-4 text-slate-300 animate-spin" />}
                    </div>
                    <div className={`absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center shadow-sm ${
                      isKept ? 'bg-blue-600 text-white' : 'bg-white border border-slate-300'
                    }`}>
                      {isKept && <Check className="h-3 w-3" />}
                    </div>
                    <div className={`absolute bottom-0 inset-x-0 text-[10px] text-center py-0.5 font-medium ${
                      isKept ? 'bg-blue-600/90 text-white' : 'bg-slate-800/70 text-white'
                    }`}>
                      Page {p}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1 border-t border-slate-200/60">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={applying}>Cancel</Button>
          <Button
            variant="danger"
            size="sm"
            onClick={handleApply}
            disabled={applying || keep.size === 0 || wouldDelete === 0}
          >
            {applying
              ? 'Applying…'
              : keep.size === 0
                ? 'Mark pages to keep'
                : wouldDelete === 0
                  ? 'Nothing to delete'
                  : `Delete ${wouldDelete} page${wouldDelete === 1 ? '' : 's'}`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
