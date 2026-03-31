import { OptimizationResult } from '../../lib/optimizer/types';
import { useOptimizerStore } from '../../hooks/useOptimizerStore';
import { fmtDim } from '../../lib/optimizer/units';
import { BoardCanvas } from './BoardCanvas';
import { Scissors } from 'lucide-react';

interface Props { result: OptimizationResult | null; onSelectBoard: (idx: number) => void; }

export function BoardGrid({ result, onSelectBoard }: Props) {
  const unit = useOptimizerStore(s => s.unit);
  if (!result) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <Scissors className="h-16 w-16 text-slate-200 mb-4" />
        <p className="text-slate-500 font-medium mb-1">Agrega piezas y presiona Optimizar</p>
        <p className="text-slate-400 text-xs">Motor: Maximal Rectangles + GRASP Multi-Estrategia</p>
      </div>
    );
  }
  return (
    <div className="flex-1 overflow-auto p-4">
      <div className="flex flex-wrap gap-4">
        {result.boards.map((board, idx) => {
          const usageColor = board.usage > 75 ? 'bg-green-100 text-green-700' : board.usage > 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700';
          return (
            <div key={idx} onClick={() => onSelectBoard(idx)} className="bg-white rounded-lg border border-slate-200 overflow-hidden cursor-pointer hover:border-blue-400 hover:shadow-md transition-all">
              <div className="flex justify-between items-center px-3 py-2 bg-slate-50 border-b border-slate-200">
                <div>
                  <div className="font-medium text-sm text-slate-900">Tablero {idx + 1}</div>
                  <div className="text-xs text-slate-400">{board.material} • {board.grosor}mm</div>
                </div>
                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${usageColor}`}>{board.usage.toFixed(1)}%</span>
              </div>
              <div className="p-2 bg-slate-800">
                <BoardCanvas board={board} maxW={280} maxH={160} unit={unit} />
              </div>
              <div className="flex justify-between px-3 py-1.5 text-xs text-slate-400 bg-slate-50">
                <span>{fmtDim(board.ancho, unit)}×{fmtDim(board.alto, unit)}</span>
                <span>{board.placed.length} piezas</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
