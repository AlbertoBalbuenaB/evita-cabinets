import { useMemo, useState } from 'react';
import { X, GitCompareArrows } from 'lucide-react';
import { Modal } from '../../Modal';
import { formatCurrency } from '../../../lib/calculations';
import type { QuotationOptimizerRun } from '../../../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  runs: QuotationOptimizerRun[];
  activeRunId: string | null;
}

/**
 * Compares 2-5 optimizer runs on the 4 headline KPIs:
 *   total_cost, waste_pct, board_count, cost_per_m2
 *
 * Uses pure CSS bars — no chart library. The best value for each KPI
 * is highlighted so the "winner" is obvious at a glance. For waste_pct,
 * board_count, total_cost, cost_per_m2 lower is better; best is painted
 * green and worst is painted red. Middle values stay neutral.
 */
export function OptimizerComparisonPanel({ isOpen, onClose, runs, activeRunId }: Props) {
  // Pre-select the active run + the most recent non-active one.
  const initial = useMemo(() => {
    if (runs.length < 2) return new Set(runs.map((r) => r.id));
    const out = new Set<string>();
    if (activeRunId) out.add(activeRunId);
    for (const r of runs) {
      if (out.size >= 2) break;
      if (!out.has(r.id)) out.add(r.id);
    }
    return out;
  }, [runs, activeRunId]);

  const [selected, setSelected] = useState<Set<string>>(initial);

  const selectedRuns = runs.filter((r) => selected.has(r.id));

  const toggle = (runId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(runId)) {
        next.delete(runId);
      } else if (next.size < 5) {
        next.add(runId);
      }
      return next;
    });
  };

  // KPI metadata: key, label, lowerIsBetter, formatter.
  const kpis = [
    { key: 'total_cost'   as const, label: 'Total Cost',    fmt: (v: number) => formatCurrency(v) },
    { key: 'waste_pct'    as const, label: 'Waste %',       fmt: (v: number) => `${v.toFixed(1)}%` },
    { key: 'board_count'  as const, label: 'Boards',        fmt: (v: number) => String(v) },
    { key: 'cost_per_m2'  as const, label: 'Cost per m²',   fmt: (v: number) => formatCurrency(v) },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="" size="xl">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <GitCompareArrows className="h-5 w-5 text-accent-text" />
            <h2 className="text-lg font-semibold text-fg-900">Compare Breakdown Runs</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-fg-400 hover:text-fg-700 hover:bg-surf-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {runs.length < 2 ? (
          <div className="text-sm text-fg-500 py-8 text-center">
            You need at least 2 saved runs to compare. Save another run from the Breakdown tab.
          </div>
        ) : (
          <>
            {/* ── Run selector ───────────────────────────────────── */}
            <div className="mb-4">
              <div className="text-xs font-medium text-fg-500 uppercase tracking-wide mb-2">
                Select 2-5 runs to compare ({selected.size} selected)
              </div>
              <div className="flex flex-wrap gap-1.5">
                {runs.map((r) => {
                  const isSelected = selected.has(r.id);
                  const atLimit = selected.size >= 5 && !isSelected;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => toggle(r.id)}
                      disabled={atLimit}
                      className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-600'
                          : atLimit
                            ? 'bg-surf-app text-fg-300 border-border-soft cursor-not-allowed'
                            : 'bg-surf-card text-fg-700 border-border-soft hover:bg-surf-app'
                      }`}
                    >
                      {r.name}
                      {r.id === activeRunId && (
                        <span className="ml-1 text-[9px] font-semibold opacity-75">(active)</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── KPI table with bars ────────────────────────────── */}
            {selectedRuns.length >= 2 && (
              <div className="space-y-4">
                {kpis.map((kpi) => {
                  const values = selectedRuns.map((r) => Number(r[kpi.key] ?? 0));
                  const min = Math.min(...values);
                  const max = Math.max(...values);
                  const range = max - min || 1;
                  // All KPIs here: lower is better.
                  return (
                    <div key={kpi.key}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-fg-700">{kpi.label}</span>
                        <span className="text-[10px] text-fg-400 font-mono">lower is better</span>
                      </div>
                      <div className="space-y-1">
                        {selectedRuns.map((r, i) => {
                          const v = values[i];
                          const pct = ((max - v) / range) * 100; // 100% = best, 0% = worst
                          const tone =
                            selectedRuns.length < 2 ? 'slate' :
                            v === min ? 'green' :
                            v === max ? 'red'   : 'slate';
                          const barColor =
                            tone === 'green' ? 'bg-green-500' :
                            tone === 'red'   ? 'bg-red-400'   : 'bg-slate-400';
                          return (
                            <div key={r.id} className="flex items-center gap-2 text-xs">
                              <span className="w-32 truncate text-fg-700 shrink-0" title={r.name}>{r.name}</span>
                              <div className="flex-1 relative h-5 bg-surf-muted rounded overflow-hidden">
                                <div
                                  className={`absolute inset-y-0 left-0 ${barColor} transition-all`}
                                  style={{ width: `${Math.max(3, pct)}%` }}
                                />
                              </div>
                              <span className={`w-24 text-right font-mono tabular-nums shrink-0 ${
                                tone === 'green' ? 'text-status-emerald-fg font-semibold' :
                                tone === 'red'   ? 'text-status-red-fg'   : 'text-fg-700'
                              }`}>
                                {kpi.fmt(v)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {selectedRuns.length < 2 && (
              <div className="text-sm text-fg-500 py-4 text-center">
                Select at least 2 runs to see the comparison.
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
