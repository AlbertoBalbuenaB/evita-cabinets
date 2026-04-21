import { OptimizationResult } from '../../lib/optimizer/types';

interface Props { result: OptimizationResult | null; }

export function SummaryView({ result }: Props) {
  if (!result) return <div className="flex-1 flex items-center justify-center text-fg-400 text-sm">Run an optimization to see the summary</div>;

  const totalArea = result.boards.reduce((s, b) => s + b.areaTotal, 0);
  const usedArea = result.boards.reduce((s, b) => s + b.areaUsed, 0);
  const wasteArea = result.boards.reduce((s, b) => s + b.areaWaste, 0);

  const groups: Record<string, { count: number; pieces: number; effSum: number }> = {};
  result.boards.forEach(b => {
    const k = `${b.material} ${b.grosor}mm`;
    if (!groups[k]) groups[k] = { count: 0, pieces: 0, effSum: 0 };
    groups[k].count++; groups[k].pieces += b.placed.length; groups[k].effSum += b.usage;
  });

  const Row = ({ label, value }: { label: string; value: string }) => (
    <div className="flex justify-between py-1.5 border-b border-border-soft last:border-0 text-sm">
      <span className="text-fg-600">{label}</span>
      <span className="font-semibold text-fg-800">{value}</span>
    </div>
  );

  const unplaced = result.unplacedPieces ?? [];
  const placedCount = result.boards.reduce((s, b) => s + b.placed.length, 0);

  return (
    <div className="flex-1 overflow-auto p-4">
      {unplaced.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-800">
          <span className="font-semibold">Warning: </span>
          {unplaced.reduce((s, u) => s + u.count, 0)} piece(s) could not be placed:{' '}
          {unplaced.map(u => `${u.nombre} ${u.ancho}×${u.alto} (×${u.count})`).join(', ')}.
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-surf-card rounded-lg border border-border-soft p-4">
          <h3 className="text-xs font-semibold text-fg-400 uppercase tracking-wide mb-3">General Summary</h3>
          <Row label="Total boards" value={`${result.boards.length}`} />
          <Row label="Total pieces" value={unplaced.length > 0 ? `${placedCount}/${result.totalPieces}` : `${result.totalPieces}`} />
          <Row label="Global efficiency" value={`${result.efficiency.toFixed(2)}%`} />
          <Row label="Total area" value={`${totalArea.toFixed(2)} m²`} />
          <Row label="Used area" value={`${usedArea.toFixed(2)} m²`} />
          <Row label="Waste" value={`${wasteArea.toFixed(2)} m²`} />
          <Row label="Useful offcuts" value={`${result.usefulOffcuts}`} />
          <Row label="Total cost" value={`$${result.totalCost.toFixed(2)}`} />
          <Row label="Time" value={`${result.timeMs.toFixed(0)}ms`} />
          <Row label="Strategy" value={result.strategy} />
        </div>
        <div className="bg-surf-card rounded-lg border border-border-soft p-4">
          <h3 className="text-xs font-semibold text-fg-400 uppercase tracking-wide mb-3">By Material</h3>
          {Object.entries(groups).map(([k, g]) => (
            <div key={k} className="pb-3 mb-3 border-b border-border-soft last:border-0 last:mb-0 last:pb-0">
              <div className="font-medium text-sm text-fg-900 mb-2">{k}</div>
              <Row label="Boards" value={`${g.count}`} />
              <Row label="Pieces" value={`${g.pieces}`} />
              <Row label="Avg. efficiency" value={`${(g.effSum / g.count).toFixed(1)}%`} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
