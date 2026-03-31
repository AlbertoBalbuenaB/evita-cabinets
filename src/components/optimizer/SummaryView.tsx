import { OptimizationResult } from '../../lib/optimizer/types';

interface Props { result: OptimizationResult | null; }

export function SummaryView({ result }: Props) {
  if (!result) return <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">Ejecuta una optimización para ver el resumen</div>;

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
    <div className="flex justify-between py-1.5 border-b border-slate-100 last:border-0 text-sm">
      <span className="text-slate-600">{label}</span>
      <span className="font-semibold text-slate-800">{value}</span>
    </div>
  );

  return (
    <div className="flex-1 overflow-auto p-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Resumen General</h3>
          <Row label="Total tableros" value={`${result.boards.length}`} />
          <Row label="Total piezas" value={`${result.totalPieces}`} />
          <Row label="Eficiencia global" value={`${result.efficiency.toFixed(2)}%`} />
          <Row label="Área total" value={`${totalArea.toFixed(2)} m²`} />
          <Row label="Área utilizada" value={`${usedArea.toFixed(2)} m²`} />
          <Row label="Desperdicio" value={`${wasteArea.toFixed(2)} m²`} />
          <Row label="Retazos útiles" value={`${result.usefulOffcuts}`} />
          <Row label="Costo total" value={`$${result.totalCost.toFixed(2)}`} />
          <Row label="Tiempo" value={`${result.timeMs.toFixed(0)}ms`} />
          <Row label="Estrategia" value={result.strategy} />
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Por Material</h3>
          {Object.entries(groups).map(([k, g]) => (
            <div key={k} className="pb-3 mb-3 border-b border-slate-100 last:border-0 last:mb-0 last:pb-0">
              <div className="font-medium text-sm text-slate-900 mb-2">{k}</div>
              <Row label="Tableros" value={`${g.count}`} />
              <Row label="Piezas" value={`${g.pieces}`} />
              <Row label="Eficiencia prom." value={`${(g.effSum / g.count).toFixed(1)}%`} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
