import { OptimizationResult } from '../../lib/optimizer/types';
import { useOptimizerStore } from '../../hooks/useOptimizerStore';
import { fmtDim } from '../../lib/optimizer/units';
import { BoardCanvas } from './BoardCanvas';
import { LayoutDashboard } from 'lucide-react';

interface Props { result: OptimizationResult | null; onSelectBoard: (idx: number) => void; }

export function BoardGrid({ result, onSelectBoard }: Props) {
  const unit = useOptimizerStore(s => s.unit);
  if (!result) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <LayoutDashboard className="h-16 w-16 text-fg-400 mb-4" />
        <p className="text-fg-500 font-medium mb-1">Add pieces and press Optimize</p>
        <p className="text-fg-400 text-xs">Engine: Maximal Rectangles + GRASP Multi-Strategy</p>
      </div>
    );
  }
  return (
    <div className="flex-1 overflow-auto p-4">
      <div className="flex flex-wrap gap-4">
        {result.boards.map((board, idx) => {
          const usageColor = board.usage > 75 ? 'bg-status-emerald-bg text-status-emerald-fg' : board.usage > 50 ? 'bg-status-amber-bg text-status-amber-fg' : 'bg-status-red-bg text-status-red-fg';
          return (
            <div key={idx} onClick={() => onSelectBoard(idx)} className="bg-surf-card rounded-lg border border-border-soft overflow-hidden cursor-pointer hover:border-accent-tint-border hover:shadow-md transition-all">
              <div className="flex justify-between items-center px-3 py-2 bg-surf-app border-b border-border-soft">
                <div>
                  <div className="font-medium text-sm text-fg-900">Board {idx + 1}</div>
                  <div className="text-xs text-fg-400">{board.material} • {board.grosor}mm</div>
                </div>
                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${usageColor}`}>{board.usage.toFixed(1)}%</span>
              </div>
              <div className="p-2 bg-slate-800">
                <BoardCanvas board={board} maxW={280} maxH={160} unit={unit} />
              </div>
              <div className="flex justify-between px-3 py-1.5 text-xs text-fg-400 bg-surf-app">
                <span>{fmtDim(board.ancho, unit)}×{fmtDim(board.alto, unit)}</span>
                <span>{board.placed.length} pieces</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
