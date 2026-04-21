import { OptimizationResult } from '../../lib/optimizer/types';

interface Props { result: OptimizationResult | null; }

export function StatsBar({ result }: Props) {
  const effColor = !result ? 'text-fg-300' : result.efficiency > 75 ? 'text-status-emerald-fg' : result.efficiency > 50 ? 'text-status-amber-fg' : 'text-status-red-fg';
  const wasteM2 = result ? result.boards.reduce((s, b) => s + b.areaWaste, 0).toFixed(2) : '—';
  const unplaced = result?.unplacedPieces ?? [];
  const placedCount = result ? result.boards.reduce((s, b) => s + b.placed.length, 0) : 0;

  return (
    <div className="bg-surf-card border-b border-border-soft overflow-x-auto flex-shrink-0">
      {unplaced.length > 0 && (
        <div className="bg-status-red-bg border-b border-status-red-brd px-4 py-2 text-sm text-red-800 flex items-start gap-2">
          <span className="font-semibold shrink-0">Warning:</span>
          <span>
            {unplaced.reduce((s, u) => s + u.count, 0)} piece(s) could not be placed:
            {' '}{unplaced.map(u => `${u.nombre} ${u.ancho}×${u.alto} (×${u.count})`).join(', ')}.
            Check that pieces fit the stock dimensions (after trim) and that enough stock sheets are available.
          </span>
        </div>
      )}
      <div className="flex">
        <div className="flex-1 px-4 py-2.5 border-r border-border-soft min-w-max">
          <div className="text-xs text-fg-400 uppercase tracking-wide mb-0.5">Boards</div>
          <div className="text-xl font-bold text-fg-900">{result ? result.boards.length : '—'}</div>
          <div className="text-xs text-fg-400">${result ? result.totalCost.toFixed(0) : '—'}</div>
        </div>
        <div className="flex-1 px-4 py-2.5 border-r border-border-soft min-w-max">
          <div className="text-xs text-fg-400 uppercase tracking-wide mb-0.5">Pieces</div>
          <div className={`text-xl font-bold ${unplaced.length > 0 ? 'text-status-red-fg' : 'text-fg-900'}`}>
            {result ? (unplaced.length > 0 ? `${placedCount}/${result.totalPieces}` : result.totalPieces) : '—'}
          </div>
        </div>
        <div className="flex-1 px-4 py-2.5 border-r border-border-soft min-w-max">
          <div className="text-xs text-fg-400 uppercase tracking-wide mb-0.5">Efficiency</div>
          <div className={`text-xl font-bold ${effColor}`}>{result ? result.efficiency.toFixed(1) : '—'}%</div>
        </div>
        <div className="flex-1 px-4 py-2.5 border-r border-border-soft min-w-max">
          <div className="text-xs text-fg-400 uppercase tracking-wide mb-0.5">Waste</div>
          <div className="text-xl font-bold text-status-amber-fg">{wasteM2}m²</div>
        </div>
        <div className="flex-1 px-4 py-2.5 border-r border-border-soft min-w-max">
          <div className="text-xs text-fg-400 uppercase tracking-wide mb-0.5">Offcuts</div>
          <div className="text-xl font-bold text-fg-900">{result ? result.usefulOffcuts : '—'}</div>
        </div>
        <div className="flex-1 px-4 py-2.5 min-w-max">
          <div className="text-xs text-fg-400 uppercase tracking-wide mb-0.5">Time</div>
          <div className="text-xl font-bold text-fg-900">{result ? result.timeMs.toFixed(0) : '—'}ms</div>
          <div className="text-xs text-fg-400 truncate max-w-32">{result ? result.strategy : '—'}</div>
        </div>
      </div>
    </div>
  );
}
