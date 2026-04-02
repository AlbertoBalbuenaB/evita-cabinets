import { Pieza } from '../../lib/optimizer/types';
import { useOptimizerStore } from '../../hooks/useOptimizerStore';
import { fmtNum, unitLabel } from '../../lib/optimizer/units';
import { X } from 'lucide-react';

interface Props { pieces: Pieza[]; onRemove: (id: string) => void; }

export function PieceList({ pieces, onRemove }: Props) {
  const unit = useOptimizerStore(s => s.unit);
  const totalArea = pieces.reduce((s, p) => s + p.ancho * p.alto * p.cantidad, 0) / 1e6;
  return (
    <div className="bg-white border-t border-slate-200 flex flex-col flex-shrink-0">
      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-700">Piece List</span>
          <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">{pieces.length}</span>
        </div>
        <div className="text-xs text-slate-500">Area: <span className="font-semibold">{totalArea.toFixed(2)}</span> m²</div>
      </div>
      {pieces.length === 0 ? (
        <div className="flex items-center justify-center py-6">
          <p className="text-xs text-slate-400">No pieces added</p>
        </div>
      ) : (
        <div className="overflow-y-auto max-h-44">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
              <tr>
                {['#','Material',`Width(${unitLabel(unit)})`,`Height(${unitLabel(unit)})`,`Thk.(${unitLabel(unit)})`,'Qty','Grain','Name',''].map((h, i) => (
                  <th key={i} className="px-2 py-1.5 text-left font-medium text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pieces.map((p, idx) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-2 py-1.5 font-mono text-slate-500">{idx + 1}</td>
                  <td className="px-2 py-1.5 text-slate-700">{p.material}</td>
                  <td className="px-2 py-1.5 text-center text-slate-700">{fmtNum(p.ancho, unit)}</td>
                  <td className="px-2 py-1.5 text-center text-slate-700">{fmtNum(p.alto, unit)}</td>
                  <td className="px-2 py-1.5 text-center text-slate-700">{fmtNum(p.grosor, unit)}</td>
                  <td className="px-2 py-1.5 text-center font-semibold text-slate-700">{p.cantidad}</td>
                  <td className="px-2 py-1.5 text-center">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${p.vetaHorizontal ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                      {p.vetaHorizontal ? 'Fixed' : 'Free'}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-slate-600 max-w-24 truncate">{p.nombre || '—'}</td>
                  <td className="px-2 py-1.5">
                    <button onClick={() => onRemove(p.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
