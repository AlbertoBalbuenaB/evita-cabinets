import { useRef, useEffect } from 'react';
import { BoardResult } from '../../lib/optimizer/types';
import { useOptimizerStore } from '../../hooks/useOptimizerStore';
import { fmtDim, fmtNum } from '../../lib/optimizer/units';
import { renderBoardThumbnail, PIECE_COLORS } from '../../lib/optimizer/engine';
import { Modal } from '../Modal';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

interface Props { board: BoardResult | null; boardIndex: number; isOpen: boolean; onClose: () => void; }

export function BoardDetailModal({ board, boardIndex, isOpen, onClose }: Props) {
  const unit = useOptimizerStore(s => s.unit);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (isOpen && board && canvasRef.current) {
      renderBoardThumbnail(canvasRef.current, board, { maxW: 800, maxH: 480, unit });
    }
  }, [isOpen, board, unit]);

  if (!board) return null;

  // TODO: Replace with full interactive CADViewer (Phase 2 — when optimizer HTML is finalized)

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Board ${boardIndex + 1} — ${board.material} ${board.grosor}mm`} size="xl">
      <div className="flex gap-4 h-full min-h-0">
        {/* Canvas */}
        <div className="flex-1 bg-slate-900 rounded-lg flex items-center justify-center overflow-hidden min-h-64">
          <canvas ref={canvasRef} className="max-w-full max-h-full" />
        </div>
        {/* Info */}
        <div className="w-52 shrink-0 space-y-4">
          <div>
            <h4 className="text-xs font-semibold text-fg-400 uppercase tracking-wide mb-2">Board</h4>
            <div className="space-y-1 text-sm">
              {[['Material', board.material], ['Thickness', fmtDim(board.grosor, unit)], ['Dimensions', `${fmtDim(board.ancho, unit)}×${fmtDim(board.alto, unit)}`], ['Usage', `${board.usage.toFixed(1)}%`], ['Total area', `${board.areaTotal.toFixed(3)} m²`], ['Waste', `${board.areaWaste.toFixed(3)} m²`], ['Cost', `$${board.stockInfo.costo}`]].map(([l, v]) => (
                <div key={l} className="flex justify-between">
                  <span className="text-fg-500">{l}</span>
                  <span className="font-medium text-fg-800">{v}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-fg-400 uppercase tracking-wide mb-2">Pieces ({board.placed.length})</h4>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {board.placed.map((p, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <div className="w-3 h-3 rounded shrink-0" style={{ backgroundColor: PIECE_COLORS[p.idx % PIECE_COLORS.length] }} />
                  <span className="text-fg-600 flex-1 truncate">{p.piece.nombre || `Piece ${i + 1}`}</span>
                  <span className="text-fg-400">{fmtNum(p.piece.ancho, unit)}×{fmtNum(p.piece.alto, unit)}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Layer / zoom toggles — functional in Phase 2 */}
          <div className="pt-2 border-t border-border-soft">
            <div className="flex flex-wrap gap-1 mb-2">
              {['Kerf', 'Grain', 'Edge Band'].map(l => (
                <button key={l} className="px-2 py-0.5 text-xs rounded border border-border-soft text-fg-500 hover:bg-surf-app">{l}</button>
              ))}
            </div>
            <div className="flex gap-1">
              {[ZoomOut, Maximize2, ZoomIn].map((Icon, i) => (
                <button key={i} className="p-1 text-fg-400 hover:bg-surf-muted rounded transition-colors">
                  <Icon className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
