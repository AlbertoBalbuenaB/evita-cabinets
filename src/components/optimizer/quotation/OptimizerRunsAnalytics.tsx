import { useEffect, useMemo, useState } from 'react';
import {
  DollarSign,
  Percent,
  Layers as LayersIcon,
  Ruler,
  GitCompareArrows,
  LayoutDashboard,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';
import { formatCurrency } from '../../../lib/calculations';
import { listRuns } from '../../../lib/optimizer/quotation/quotationOptimizerRepo';
import { OptimizerComparisonPanel } from './OptimizerComparisonPanel';
import type { QuotationOptimizerRun } from '../../../types';

interface Props {
  quotationId: string;
}

type KpiKey = 'total_cost' | 'waste_pct' | 'board_count' | 'cost_per_m2';

/**
 * Analytics panel for the optimizer-pricing path. Rendered inside the
 * existing Analytics tab of ProjectDetails, BELOW ProjectCharts and
 * MaterialBreakdown. Only renders a useful view when at least one
 * optimizer run exists for the quotation; otherwise shows a compact
 * "nothing to show yet" hint.
 *
 * Renders:
 *  - 4 KPI cards for the active run (or the most recent one if none is
 *    active) with a delta vs the immediately preceding run.
 *  - A 4-panel trend "chart" (pure CSS bars) plotting every run
 *    chronologically for each KPI.
 *  - A versions table with columns: name, created, total cost, waste %,
 *    boards, $/m², active badge. The whole table is scrollable.
 *  - A "Compare" button that opens the same OptimizerComparisonPanel
 *    used by the Cut-list tab.
 */
export function OptimizerRunsAnalytics({ quotationId }: Props) {
  const [runs, setRuns] = useState<QuotationOptimizerRun[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [compareOpen, setCompareOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listRuns(quotationId)
      .then((rows) => { if (!cancelled) setRuns(rows); })
      .catch(() => { if (!cancelled) setRuns([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [quotationId]);

  // listRuns returns newest-first. Reverse for chronological display.
  const chronological = useMemo(
    () => (runs ? [...runs].reverse() : []),
    [runs],
  );

  const activeRun = runs?.find((r) => r.is_active) ?? runs?.[0] ?? null;
  const activeIdx = activeRun && chronological.length > 0
    ? chronological.findIndex((r) => r.id === activeRun.id)
    : -1;
  const prevRun = activeIdx > 0 ? chronological[activeIdx - 1] : null;

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
          Loading optimizer analytics…
        </div>
      </div>
    );
  }

  if (!runs || runs.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-1">
          <LayoutDashboard className="h-4 w-4 text-blue-600" />
          Cut-list Pricing Analytics
        </div>
        <p className="text-xs text-slate-400">
          Save at least one optimizer run from the Cut-list Pricing tab to see KPIs here.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="h-4 w-4 text-blue-600" />
          <h2 className="text-sm font-semibold text-slate-800">Cut-list Pricing Analytics</h2>
          <span className="text-xs text-slate-400">
            {runs.length} run{runs.length !== 1 ? 's' : ''}
            {activeRun && <> · active: <span className="font-medium text-slate-600">{activeRun.name}</span></>}
          </span>
        </div>
        {runs.length >= 2 && (
          <button
            type="button"
            onClick={() => setCompareOpen(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          >
            <GitCompareArrows className="h-3.5 w-3.5" />
            Compare runs
          </button>
        )}
      </div>

      {/* ── KPI cards (active run) ────────────────────────── */}
      {activeRun && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <AnalyticsKpiCard
            label="Total cost"
            value={formatCurrency(activeRun.total_cost)}
            delta={prevRun ? activeRun.total_cost - prevRun.total_cost : null}
            deltaFmt={(d) => formatCurrency(d)}
            lowerIsBetter
            icon={<DollarSign className="h-4 w-4" />}
          />
          <AnalyticsKpiCard
            label="Waste"
            value={`${activeRun.waste_pct.toFixed(1)}%`}
            delta={prevRun ? activeRun.waste_pct - prevRun.waste_pct : null}
            deltaFmt={(d) => `${d.toFixed(1)}pp`}
            lowerIsBetter
            icon={<Percent className="h-4 w-4" />}
          />
          <AnalyticsKpiCard
            label="Boards"
            value={String(activeRun.board_count)}
            delta={prevRun ? activeRun.board_count - prevRun.board_count : null}
            deltaFmt={(d) => String(d)}
            lowerIsBetter
            icon={<LayersIcon className="h-4 w-4" />}
          />
          <AnalyticsKpiCard
            label="Cost per m²"
            value={formatCurrency(activeRun.cost_per_m2)}
            delta={prevRun ? activeRun.cost_per_m2 - prevRun.cost_per_m2 : null}
            deltaFmt={(d) => formatCurrency(d)}
            lowerIsBetter
            icon={<Ruler className="h-4 w-4" />}
          />
        </div>
      )}

      {/* ── Trend chart (4 panels, chronological) ─────────── */}
      {chronological.length >= 2 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <TrendPanel
            title="Total cost"
            runs={chronological}
            kpi="total_cost"
            format={(v) => formatCurrency(v)}
          />
          <TrendPanel
            title="Waste %"
            runs={chronological}
            kpi="waste_pct"
            format={(v) => `${v.toFixed(1)}%`}
          />
          <TrendPanel
            title="Boards"
            runs={chronological}
            kpi="board_count"
            format={(v) => String(v)}
          />
          <TrendPanel
            title="Cost per m²"
            runs={chronological}
            kpi="cost_per_m2"
            format={(v) => formatCurrency(v)}
          />
        </div>
      )}

      {/* ── Versions table ─────────────────────────────────── */}
      <div className="border border-slate-200 rounded overflow-hidden">
        <div className="max-h-80 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 sticky top-0">
              <tr className="text-slate-500 border-b border-slate-200">
                <th className="text-left  px-3 py-2 font-medium">Name</th>
                <th className="text-left  px-3 py-2 font-medium">Created</th>
                <th className="text-right px-3 py-2 font-medium">Total Cost</th>
                <th className="text-right px-3 py-2 font-medium">Waste</th>
                <th className="text-right px-3 py-2 font-medium">Boards</th>
                <th className="text-right px-3 py-2 font-medium">$/m²</th>
                <th className="text-center px-3 py-2 font-medium">Active</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} className={`border-b border-slate-100 last:border-b-0 ${r.is_active ? 'bg-blue-50/40' : ''}`}>
                  <td className="px-3 py-1.5 font-medium text-slate-800 truncate max-w-[12rem]">{r.name}</td>
                  <td className="px-3 py-1.5 text-slate-500 whitespace-nowrap">{new Date(r.created_at).toLocaleDateString()}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-slate-800">{formatCurrency(r.total_cost)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-slate-600">{r.waste_pct.toFixed(1)}%</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-slate-600">{r.board_count}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-slate-600">{formatCurrency(r.cost_per_m2)}</td>
                  <td className="px-3 py-1.5 text-center">
                    {r.is_active && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded">
                        ACTIVE
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <OptimizerComparisonPanel
        isOpen={compareOpen}
        onClose={() => setCompareOpen(false)}
        runs={runs}
        activeRunId={activeRun?.id ?? null}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function AnalyticsKpiCard({
  label,
  value,
  delta,
  deltaFmt,
  lowerIsBetter,
  icon,
}: {
  label: string;
  value: string;
  delta: number | null;
  deltaFmt: (d: number) => string;
  lowerIsBetter: boolean;
  icon: React.ReactNode;
}) {
  const hasDelta = delta != null && Number.isFinite(delta) && delta !== 0;
  const improved = hasDelta && ((delta as number) < 0) === lowerIsBetter;
  const worsened = hasDelta && ((delta as number) > 0) === lowerIsBetter;

  const tone =
    !hasDelta ? 'slate' :
    improved  ? 'green' :
    worsened  ? 'red'   : 'slate';

  const DeltaIcon =
    !hasDelta ? Minus :
    (delta as number) < 0 ? TrendingDown :
    (delta as number) > 0 ? TrendingUp   : Minus;

  return (
    <div className="border border-slate-200 rounded-lg p-3 flex flex-col gap-2 bg-white">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</span>
        <span className="text-slate-300">{icon}</span>
      </div>
      <div className="text-2xl font-bold leading-none text-slate-900 tabular-nums">{value}</div>
      <div className={`flex items-center gap-1 text-xs tabular-nums ${
        tone === 'green' ? 'text-green-600' :
        tone === 'red'   ? 'text-red-600'   : 'text-slate-400'
      }`}>
        <DeltaIcon className="h-3 w-3" />
        <span>
          {hasDelta
            ? `${(delta as number) > 0 ? '+' : ''}${deltaFmt(delta as number)} vs prev`
            : 'no prior run'}
        </span>
      </div>
    </div>
  );
}

function TrendPanel({
  title,
  runs,
  kpi,
  format,
}: {
  title: string;
  runs: QuotationOptimizerRun[];
  kpi: KpiKey;
  format: (v: number) => string;
}) {
  const values = runs.map((r) => Number(r[kpi] ?? 0));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  return (
    <div className="border border-slate-200 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-slate-700">{title}</span>
        <span className="text-[10px] text-slate-400 font-mono">lower is better</span>
      </div>
      <div className="flex items-end gap-1 h-24">
        {runs.map((r, i) => {
          const v = values[i];
          const heightPct = range > 0 ? Math.max(5, ((v - min) / range) * 100) : 50;
          const tone =
            v === min ? 'bg-green-500' :
            v === max ? 'bg-red-400'   : 'bg-slate-300';
          return (
            <div
              key={r.id}
              className="flex-1 flex flex-col items-center justify-end min-w-[8px]"
              title={`${r.name}: ${format(v)}`}
            >
              <div
                className={`w-full rounded-t ${tone} ${r.is_active ? 'ring-2 ring-blue-400 ring-offset-1' : ''}`}
                style={{ height: `${heightPct}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between mt-1 text-[10px] text-slate-400 font-mono">
        <span>min {format(min)}</span>
        <span>max {format(max)}</span>
      </div>
    </div>
  );
}
