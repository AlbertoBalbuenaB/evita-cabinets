import { OptimizationResult } from '../../lib/optimizer/types';
import { useOptimizerStore } from '../../hooks/useOptimizerStore';
import { fmtDim, fmtNum, unitLabel } from '../../lib/optimizer/units';
import { generateCutSequence } from '../../lib/optimizer/engine';

interface Props { result: OptimizationResult | null; }

export function CutListView({ result }: Props) {
  const unit = useOptimizerStore(s => s.unit);
  if (!result) return <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">Run an optimization to see the cut list</div>;
  return (
    <div className="flex-1 overflow-auto p-4">
      {result.boards.map((board, boardIdx) => {
        const cuts = generateCutSequence(board, unit);
        return (
          <div key={boardIdx} className="mb-6">
            <div className="bg-slate-50 rounded-t-lg border border-slate-200 px-4 py-2 font-medium text-sm text-slate-700">
              Board {boardIdx + 1} • {board.material} {fmtDim(board.grosor, unit)} • {fmtDim(board.ancho, unit)}×{fmtDim(board.alto, unit)} • Usage: {board.usage.toFixed(1)}%
            </div>
            <table className="w-full border border-t-0 border-slate-200 text-xs">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>{['#','Name',`Width(${unitLabel(unit)})`,`Height(${unitLabel(unit)})`,`X(${unitLabel(unit)})`,`Y(${unitLabel(unit)})`,'Rot','Grain','Edge'].map(h => <th key={h} className="px-3 py-2 text-left font-medium text-slate-500">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {board.placed.map((p, i) => {
                  const edgeBands = [p.piece.cubrecanto.sup?'T':'', p.piece.cubrecanto.inf?'B':'', p.piece.cubrecanto.izq?'L':'', p.piece.cubrecanto.der?'R':''].filter(Boolean).join('/');
                  return (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-3 py-1.5 font-mono text-slate-400">{i + 1}</td>
                      <td className="px-3 py-1.5 text-slate-700">{p.piece.nombre || '—'}</td>
                      <td className="px-3 py-1.5 text-center text-slate-700">{fmtNum(p.piece.ancho, unit)}</td>
                      <td className="px-3 py-1.5 text-center text-slate-700">{fmtNum(p.piece.alto, unit)}</td>
                      <td className="px-3 py-1.5 text-center text-slate-500">{fmtNum(p.x, unit)}</td>
                      <td className="px-3 py-1.5 text-center text-slate-500">{fmtNum(p.y, unit)}</td>
                      <td className="px-3 py-1.5 text-center text-slate-500">{p.rotated ? 'Yes' : '—'}</td>
                      <td className="px-3 py-1.5 text-center"><span className={`px-1.5 py-0.5 rounded text-xs font-medium ${p.piece.vetaHorizontal ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>{p.piece.vetaHorizontal ? 'Fixed' : 'Free'}</span></td>
                      <td className="px-3 py-1.5 text-center text-slate-500">{edgeBands || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {cuts.length > 0 && (
              <div className="mt-2 mb-1 ml-2 space-y-0.5">
                <div className="text-xs font-semibold text-slate-500 mb-1">Sequence ({cuts.length} cuts):</div>
                {cuts.map(cut => (
                  <div key={cut.n} className="flex items-center gap-2 text-xs text-slate-400">
                    <span className={`px-1.5 py-0.5 rounded font-mono font-bold text-xs ${cut.type === 'H' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'}`}>{cut.type}</span>
                    <span>{cut.desc}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
