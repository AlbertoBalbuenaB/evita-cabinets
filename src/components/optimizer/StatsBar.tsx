import { OptimizationResult } from '../../lib/optimizer/types';

interface Props { result: OptimizationResult | null; }

export function StatsBar({ result }: Props) {
  const effColor = !result ? 'text-slate-300' : result.efficiency > 75 ? 'text-green-600' : result.efficiency > 50 ? 'text-amber-600' : 'text-red-600';
  const wasteM2 = result ? result.boards.reduce((s, b) => s + b.areaWaste, 0).toFixed(2) : '—';

  return (
    <div className="bg-white border-b border-slate-200 overflow-x-auto flex-shrink-0">
      <div className="flex">
        <div className="flex-1 px-4 py-2.5 border-r border-slate-200 min-w-max">
          <div className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Tableros</div>
          <div className="text-xl font-bold text-slate-900">{result ? result.boards.length : '—'}</div>
          <div className="text-xs text-slate-400">${result ? result.totalCost.toFixed(0) : '—'}</div>
        </div>
        <div className="flex-1 px-4 py-2.5 border-r border-slate-200 min-w-max">
          <div className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Piezas</div>
          <div className="text-xl font-bold text-slate-900">{result ? result.totalPieces : '—'}</div>
        </div>
        <div className="flex-1 px-4 py-2.5 border-r border-slate-200 min-w-max">
          <div className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Eficiencia</div>
          <div className={`text-xl font-bold ${effColor}`}>{result ? result.efficiency.toFixed(1) : '—'}%</div>
        </div>
        <div className="flex-1 px-4 py-2.5 border-r border-slate-200 min-w-max">
          <div className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Desperdicio</div>
          <div className="text-xl font-bold text-amber-600">{wasteM2}m²</div>
        </div>
        <div className="flex-1 px-4 py-2.5 border-r border-slate-200 min-w-max">
          <div className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Retazos</div>
          <div className="text-xl font-bold text-slate-900">{result ? result.usefulOffcuts : '—'}</div>
        </div>
        <div className="flex-1 px-4 py-2.5 min-w-max">
          <div className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Tiempo</div>
          <div className="text-xl font-bold text-slate-900">{result ? result.timeMs.toFixed(0) : '—'}ms</div>
          <div className="text-xs text-slate-400 truncate max-w-32">{result ? result.strategy : '—'}</div>
        </div>
      </div>
    </div>
  );
}
