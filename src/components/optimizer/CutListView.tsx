import { OptimizationResult } from '../../lib/optimizer/types';
import { useOptimizerStore } from '../../hooks/useOptimizerStore';
import { fmtDim, fmtNum, unitLabel } from '../../lib/optimizer/units';
import { generateCutSequence } from '../../lib/optimizer/engine';

interface Props { result: OptimizationResult | null; }

export function CutListView({ result }: Props) {
  const unit = useOptimizerStore(s => s.unit);
  if (!result) return <div className="flex-1 flex items-center justify-center text-fg-400 text-sm">Run an optimization to see the cut list</div>;
  return (
    <div className="flex-1 overflow-auto p-4">
      {result.boards.map((board, boardIdx) => {
        const cuts = generateCutSequence(board, unit);
        return (
          <div key={boardIdx} className="mb-6">
            <div className="bg-surf-app rounded-t-lg border border-border-soft px-4 py-2 font-medium text-sm text-fg-700">
              Board {boardIdx + 1} • {board.material} {fmtDim(board.grosor, unit)} • {fmtDim(board.ancho, unit)}×{fmtDim(board.alto, unit)} • Usage: {board.usage.toFixed(1)}%
            </div>
            <table className="w-full border border-t-0 border-border-soft text-xs">
              <thead className="bg-surf-app border-b border-border-soft">
                <tr>{['#','Name',`Width(${unitLabel(unit)})`,`Height(${unitLabel(unit)})`,`X(${unitLabel(unit)})`,`Y(${unitLabel(unit)})`,'Rot','Grain','Edge'].map(h => <th key={h} className="px-3 py-2 text-left font-medium text-fg-500">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {board.placed.map((p, i) => {
                  const edgeBands = [p.piece.cubrecanto.sup?'T':'', p.piece.cubrecanto.inf?'B':'', p.piece.cubrecanto.izq?'L':'', p.piece.cubrecanto.der?'R':''].filter(Boolean).join('/');
                  return (
                    <tr key={i} className="hover:bg-surf-app">
                      <td className="px-3 py-1.5 font-mono text-fg-400">{i + 1}</td>
                      <td className="px-3 py-1.5 text-fg-700">{p.piece.nombre || '—'}</td>
                      <td className="px-3 py-1.5 text-center text-fg-700">{fmtNum(p.piece.ancho, unit)}</td>
                      <td className="px-3 py-1.5 text-center text-fg-700">{fmtNum(p.piece.alto, unit)}</td>
                      <td className="px-3 py-1.5 text-center text-fg-500">{fmtNum(p.x, unit)}</td>
                      <td className="px-3 py-1.5 text-center text-fg-500">{fmtNum(p.y, unit)}</td>
                      <td className="px-3 py-1.5 text-center text-fg-500">{p.rotated ? 'Yes' : '—'}</td>
                      <td className="px-3 py-1.5 text-center"><span className={`px-1.5 py-0.5 rounded text-xs font-medium ${p.piece.veta !== 'none' ? 'bg-status-amber-bg text-status-amber-fg' : 'bg-surf-muted text-fg-500'}`}>{p.piece.veta === 'none' ? '—' : p.piece.veta === 'horizontal' ? '↔' : '↕'}</span></td>
                      <td className="px-3 py-1.5 text-center text-fg-500">{edgeBands || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {cuts.length > 0 && (
              <div className="mt-2 mb-1 ml-2 space-y-0.5">
                <div className="text-xs font-semibold text-fg-500 mb-1">Sequence ({cuts.length} cuts):</div>
                {cuts.map(cut => (
                  <div key={cut.n} className="flex items-center gap-2 text-xs text-fg-400">
                    <span className={`px-1.5 py-0.5 rounded font-mono font-bold text-xs ${cut.type === 'H' ? 'bg-accent-tint-soft text-accent-text' : 'bg-accent-tint-soft text-accent-text'}`}>{cut.type}</span>
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
