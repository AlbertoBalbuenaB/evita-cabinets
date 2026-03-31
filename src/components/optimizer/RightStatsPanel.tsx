import { useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import { useOptimizerStore } from '../../hooks/useOptimizerStore';
import { OptimizationResult } from '../../lib/optimizer/types';
import { fmtDim, fmtNum } from '../../lib/optimizer/units';
import { generateCutSequence } from '../../lib/optimizer/engine';

interface Props {
  result: OptimizationResult | null;
  selectedIdx: number;
  onSelectBoard: (idx: number) => void;
}

export function RightStatsPanel({ result, selectedIdx, onSelectBoard }: Props) {
  const unit         = useOptimizerStore((s) => s.unit);
  const globalSierra = useOptimizerStore((s) => s.globalSierra);
  const boardTrim    = useOptimizerStore((s) => s.boardTrim);

  const [globalOpen, setGlobalOpen] = useState(true);
  const [sheetOpen,  setSheetOpen]  = useState(true);
  const [cutsOpen,   setCutsOpen]   = useState(true);

  // ── Empty state ───────────────────────────────────────────
  if (!result) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white">
        <p className="text-xs text-slate-400 text-center px-4 leading-relaxed">
          Run optimization<br />to view statistics
        </p>
      </div>
    );
  }

  const boardCount = result.boards.length;
  const safeIdx    = Math.min(selectedIdx, boardCount - 1);
  const board      = result.boards[safeIdx];
  const cuts       = generateCutSequence(board, unit);

  // Global totals
  const totalUsed  = result.boards.reduce((s, b) => s + b.areaUsed,  0);
  const totalWaste = result.boards.reduce((s, b) => s + b.areaWaste, 0);
  const totalCuts  = result.boards.reduce((s, b) => s + generateCutSequence(b, unit).length, 0);
  const totalCutLen = result.boards.reduce((s, b) => {
    return s + generateCutSequence(b, unit).reduce((ss, c) => ss + (c.type === 'H' ? b.ancho : b.alto), 0);
  }, 0);

  // Stock sheets grouped by dimension
  const stockGroups: Record<string, number> = {};
  result.boards.forEach((b) => {
    const key = `${fmtNum(b.ancho, unit)}×${fmtNum(b.alto, unit)}`;
    stockGroups[key] = (stockGroups[key] || 0) + 1;
  });
  const stockStr = Object.entries(stockGroups)
    .map(([k, n]) => (n > 1 ? `${k} ×${n}` : k))
    .join(', ');

  // Board-level metrics
  const boardAreaUsed  = board.placed.reduce((s, p) => s + p.w * p.h, 0);
  const boardAreaTotal = board.ancho * board.alto;
  const boardAreaWaste = boardAreaTotal - boardAreaUsed;
  const boardCutLen    = cuts.reduce((s, c) => s + (c.type === 'H' ? board.ancho : board.alto), 0);

  // ── Helpers ───────────────────────────────────────────────
  const Section = ({
    title, open, onToggle, children,
  }: { title: string; open: boolean; onToggle: () => void; children: React.ReactNode }) => (
    <div className="border-b border-slate-100">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 hover:bg-slate-100 transition-colors"
      >
        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{title}</span>
        {open
          ? <ChevronUp   className="h-3.5 w-3.5 text-slate-400" />
          : <ChevronDown className="h-3.5 w-3.5 text-slate-400" />}
      </button>
      {open && <div className="px-4 py-2 space-y-0.5">{children}</div>}
    </div>
  );

  const StatRow = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
    <div className="flex items-baseline justify-between py-1 text-xs border-b border-slate-50 last:border-0">
      <span className="text-slate-500 shrink-0">{label}</span>
      <span className="text-right ml-2 min-w-0">
        <span className="font-medium text-slate-800">{value}</span>
        {sub && <span className="text-slate-400 ml-1.5">{sub}</span>}
      </span>
    </div>
  );

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="flex-1 bg-white flex flex-col overflow-y-auto overflow-x-hidden text-sm">

      <Section title="Global statistics" open={globalOpen} onToggle={() => setGlobalOpen((v) => !v)}>
        <StatRow label="Used stock sheets" value={stockStr} />
        <StatRow
          label="Total used area"
          value={`${totalUsed.toFixed(4)} m²`}
          sub={`${result.efficiency.toFixed(0)}%`}
        />
        <StatRow
          label="Total wasted area"
          value={`${totalWaste.toFixed(4)} m²`}
          sub={`${(100 - result.efficiency).toFixed(0)}%`}
        />
        <StatRow label="Total cuts"       value={String(totalCuts)} />
        <StatRow label="Total cut length" value={fmtDim(totalCutLen, unit)} />
        <StatRow label="Kerf thickness"   value={`${globalSierra}mm`} />
        <StatRow label="Edgeband" value={(() => {
          let total = 0;
          result.boards.forEach(b => b.placed.forEach(p => {
            const cb = p.piece.cubrecanto;
            if (cb.sup > 0) total += (p.piece.ancho + 30);
            if (cb.inf > 0) total += (p.piece.ancho + 30);
            if (cb.izq > 0) total += (p.piece.alto + 30);
            if (cb.der > 0) total += (p.piece.alto + 30);
          }));
          return `${(total / 1000).toFixed(2)} m`;
        })()} />
        <StatRow label="Strategy"         value={result.strategy} />
        <StatRow label="Cost"             value={`$${result.totalCost.toFixed(2)}`} />
        <StatRow label="Time"             value={`${result.timeMs.toFixed(0)}ms`} />
      </Section>

      <Section title="Sheet statistics" open={sheetOpen} onToggle={() => setSheetOpen((v) => !v)}>
        {/* Board navigation */}
        <div className="flex items-center justify-between mb-2 -mx-1">
          <button
            onClick={() => onSelectBoard(Math.max(0, safeIdx - 1))}
            disabled={safeIdx === 0}
            className="p-1 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="h-4 w-4 text-slate-500" />
          </button>
          <span className="text-xs font-semibold text-slate-700 select-none">
            {safeIdx + 1} / {boardCount}
          </span>
          <button
            onClick={() => onSelectBoard(Math.min(boardCount - 1, safeIdx + 1))}
            disabled={safeIdx === boardCount - 1}
            className="p-1 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="h-4 w-4 text-slate-500" />
          </button>
        </div>
        <StatRow label="Stock sheet" value={`${fmtNum(board.ancho, unit)}×${fmtNum(board.alto, unit)}`} />
        <StatRow label="Material"    value={board.material} />
        <StatRow label="Thickness"   value={fmtDim(board.grosor, unit)} />
        <StatRow label="Board trim"  value={`${boardTrim}mm`} />
        <StatRow label="Usable area" value={`${((board.ancho - 2*boardTrim) * (board.alto - 2*boardTrim) / 1e6).toFixed(4)} m²`} />
        <StatRow
          label="Used area"
          value={`${(boardAreaUsed / 1e6).toFixed(4)} m²`}
          sub={`${board.usage.toFixed(0)}%`}
        />
        <StatRow
          label="Wasted area"
          value={`${(boardAreaWaste / 1e6).toFixed(4)} m²`}
          sub={`${(100 - board.usage).toFixed(0)}%`}
        />
        <StatRow label="Panels placed" value={String(board.placed.length)} />
        <StatRow label="Offcuts"        value={String(board.offcuts.length)} />
        <StatRow label="Cuts"           value={String(cuts.length)} />
        <StatRow label="Cut length"     value={fmtDim(boardCutLen, unit)} />
        <StatRow label="Cost"           value={`$${board.stockInfo.costo.toFixed(2)}`} />
      </Section>

      <Section title="Cuts" open={cutsOpen} onToggle={() => setCutsOpen((v) => !v)}>
        <div className="-mx-4">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left py-1 px-4 font-medium text-slate-400 w-7">#</th>
                <th className="text-left py-1 font-medium text-slate-400">Panel</th>
                <th className="text-center py-1 font-medium text-slate-400 w-8">Tipo</th>
                <th className="text-right py-1 px-4 font-medium text-slate-400">Pos.</th>
              </tr>
            </thead>
            <tbody>
              {cuts.map((cut) => (
                <tr key={cut.n} className={`border-t border-slate-50 ${cut.isTrim ? 'bg-amber-50' : 'hover:bg-slate-50'}`}>
                  <td className="py-1 px-4 font-mono text-slate-400">{cut.n}</td>
                  <td className="py-1 text-slate-600 text-xs">
                    {cut.isTrim ? '— orillado —' : `${fmtNum(board.ancho, unit)}×${fmtNum(board.alto, unit)}`}
                  </td>
                  <td className="py-1 text-center">
                    <span className={`inline-block px-1 py-0.5 rounded text-xs font-bold ${
                      cut.isTrim
                        ? 'bg-amber-100 text-amber-700'
                        : cut.type === 'H'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-purple-100 text-purple-700'
                    }`}>
                      {cut.type}
                    </span>
                  </td>
                  <td className="py-1 px-4 text-right font-mono text-slate-600">
                    {fmtNum(cut.pos, unit)}
                  </td>
                </tr>
              ))}
              {cuts.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-slate-400 px-4">
                    No cuts recorded
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
