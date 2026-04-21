import { Layers } from 'lucide-react';
import { formatCurrency } from '../../../lib/calculations';

interface AreaRow {
  areaId: string;
  areaName: string;
  m2: number;
  cost: number;
  boards: number;
}

interface Props {
  rows: AreaRow[];
}

/**
 * Table showing per-area attribution of optimizer boards.
 *
 * Driven by `snapshot.areaAttribution` (from `attributeBoardsToAreas`)
 * and the matching ProjectArea names. Fractional board counts are
 * shown rounded to 1 decimal to reflect that a single board may be
 * shared between two areas.
 *
 * Parent is responsible for joining areaId → areaName and sorting.
 */
export function PerAreaBoardsBreakdown({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-border-soft bg-surf-card p-4">
        <div className="flex items-center gap-1.5 mb-2">
          <Layers className="h-3.5 w-3.5 text-blue-600" />
          <h3 className="text-xs font-semibold text-fg-800 uppercase tracking-wide">Cost by Area</h3>
        </div>
        <p className="text-xs text-fg-400 italic">No areas to display. Build and run the optimizer first.</p>
      </div>
    );
  }

  const totals = rows.reduce(
    (acc, r) => ({
      m2:     acc.m2     + r.m2,
      cost:   acc.cost   + r.cost,
      boards: acc.boards + r.boards,
    }),
    { m2: 0, cost: 0, boards: 0 },
  );

  return (
    <div className="rounded-lg border border-border-soft bg-surf-card">
      <div
        className="flex items-center gap-1.5 px-3 py-2 border-b border-border-soft"
        title="Per-area material cost allocated from the optimizer run. Used by the MXN and USD quotation PDFs when pricing method = Optimizer."
      >
        <Layers className="h-3.5 w-3.5 text-blue-600" />
        <h3 className="text-xs font-semibold text-fg-800 uppercase tracking-wide">Cost by Area</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-fg-500 border-b border-border-soft">
              <th className="text-left  px-3 py-1.5 font-medium">Area</th>
              <th className="text-right px-3 py-1.5 font-medium">Pieces m²</th>
              <th className="text-right px-3 py-1.5 font-medium">Boards</th>
              <th className="text-right px-3 py-1.5 font-medium">Cost</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.areaId} className="border-b border-slate-50 last:border-b-0">
                <td className="px-3 py-1.5 text-fg-800 font-medium">{r.areaName}</td>
                <td className="px-3 py-1.5 text-right tabular-nums text-fg-600">{r.m2.toFixed(2)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums text-fg-600">{r.boards.toFixed(1)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums text-fg-800">{formatCurrency(r.cost)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-surf-app font-semibold">
              <td className="px-3 py-1.5 text-fg-800">Total</td>
              <td className="px-3 py-1.5 text-right tabular-nums text-fg-800">{totals.m2.toFixed(2)}</td>
              <td className="px-3 py-1.5 text-right tabular-nums text-fg-800">{totals.boards.toFixed(1)}</td>
              <td className="px-3 py-1.5 text-right tabular-nums text-fg-800">{formatCurrency(totals.cost)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
