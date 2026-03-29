import { useMemo } from 'react';
import { BarChart3, DollarSign, TrendingUp, Layers, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { formatCurrency } from '../lib/calculations';
import type { Quotation } from '../types';

interface CrossQuotationAnalyticsProps {
  quotations: Quotation[];
  exchangeRate: number;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function KpiCard({ label, value, sub, icon }: { label: string; value: React.ReactNode; sub?: string; icon: React.ReactNode }) {
  return (
    <div className="glass-blue p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</span>
        <div className="text-blue-500">{icon}</div>
      </div>
      <div className="text-xl font-bold text-slate-900 tabular-nums">{value}</div>
      {sub && <span className="text-xs text-slate-500">{sub}</span>}
    </div>
  );
}

const STATUS_GRADIENTS: Record<string, string> = {
  Awarded: 'bg-gradient-to-r from-green-400 to-green-500',
  Estimating: 'bg-gradient-to-r from-amber-300 to-amber-400',
  Sent: 'bg-gradient-to-r from-cyan-400 to-cyan-500',
  Pending: 'bg-gradient-to-r from-blue-300 to-blue-400',
  Lost: 'bg-gradient-to-r from-red-300 to-red-400',
  Disqualified: 'bg-gradient-to-r from-slate-300 to-slate-400',
  Cancelled: 'bg-gradient-to-r from-slate-300 to-slate-400',
};

const STATUS_COLORS: Record<string, string> = {
  Awarded: 'bg-green-50 text-green-700 border-green-200/50',
  Pending: 'bg-blue-50 text-blue-700 border-blue-200/50',
  Estimating: 'bg-amber-50 text-amber-700 border-amber-200/50',
  Sent: 'bg-cyan-50 text-cyan-700 border-cyan-200/50',
  Lost: 'bg-red-50 text-red-700 border-red-200/50',
  Disqualified: 'bg-slate-100 text-slate-600 border-slate-200/50',
  Cancelled: 'bg-slate-100 text-slate-500 border-slate-200/50',
};

export function CrossQuotationAnalytics({ quotations, exchangeRate }: CrossQuotationAnalyticsProps) {
  const fx = exchangeRate || 1;

  const analytics = useMemo(() => {
    const sorted = [...quotations].sort((a, b) => (a.version_number ?? 0) - (b.version_number ?? 0));
    const amounts = sorted.map(q => q.total_amount ?? 0);
    const amountsUsd = amounts.map(a => a / fx);

    const latest = sorted[sorted.length - 1] ?? null;
    const min = amounts.length > 0 ? Math.min(...amountsUsd) : 0;
    const max = amounts.length > 0 ? Math.max(...amountsUsd) : 0;
    const avg = amountsUsd.length > 0 ? amountsUsd.reduce((s, v) => s + v, 0) / amountsUsd.length : 0;
    const maxAmount = Math.max(...amounts, 1);

    const withDeltas = sorted.map((q, i) => {
      const curr = q.total_amount ?? 0;
      const prev = i > 0 ? (sorted[i - 1].total_amount ?? 0) : null;
      const deltaAbs = prev !== null ? curr - prev : null;
      const deltaPct = prev !== null && prev !== 0 ? ((curr - prev) / prev) * 100 : null;
      return { ...q, deltaAbs, deltaPct };
    });

    return { sorted, latest, min, max, avg, maxAmount, withDeltas };
  }, [quotations, fx]);

  if (quotations.length === 0) {
    return (
      <div className="glass-white p-12 text-center">
        <BarChart3 className="h-12 w-12 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-500">No quotation data available for analytics.</p>
      </div>
    );
  }

  const multiVersion = quotations.length > 1;

  return (
    <div className="space-y-5">
      {/* Section 1: KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard
          label="Versions"
          value={quotations.length}
          sub={multiVersion ? `v1 — v${analytics.sorted[analytics.sorted.length - 1]?.version_number ?? quotations.length}` : 'Single version'}
          icon={<Layers className="h-5 w-5" />}
        />
        <KpiCard
          label="Latest Total"
          value={formatCurrency((analytics.latest?.total_amount ?? 0) / fx, 'USD')}
          sub={analytics.latest?.version_label || analytics.latest?.name || ''}
          icon={<DollarSign className="h-5 w-5" />}
        />
        <KpiCard
          label="Cost Range"
          value={
            multiVersion
              ? <span className="text-base">{formatCurrency(analytics.min, 'USD')} — {formatCurrency(analytics.max, 'USD')}</span>
              : formatCurrency(analytics.max, 'USD')
          }
          sub={multiVersion ? `Δ ${formatCurrency(analytics.max - analytics.min, 'USD')}` : undefined}
          icon={<TrendingUp className="h-5 w-5" />}
        />
        <KpiCard
          label="Average Total"
          value={formatCurrency(analytics.avg, 'USD')}
          sub={`${formatCurrency(analytics.avg * fx)} MXN`}
          icon={<BarChart3 className="h-5 w-5" />}
        />
      </div>

      {/* Section 2: Version Comparison Table */}
      <div className="glass-white p-5">
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">Version Comparison</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200/60">
                <th className="py-2 px-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Ver</th>
                <th className="py-2 px-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Label</th>
                <th className="py-2 px-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wide hidden sm:table-cell">Date</th>
                <th className="py-2 px-2 text-right text-xs font-medium text-slate-500 uppercase tracking-wide">Total MXN</th>
                <th className="py-2 px-2 text-right text-xs font-medium text-slate-500 uppercase tracking-wide">Total USD</th>
                <th className="py-2 px-2 text-center text-xs font-medium text-slate-500 uppercase tracking-wide hidden md:table-cell">Status</th>
                {multiVersion && (
                  <th className="py-2 px-2 text-right text-xs font-medium text-slate-500 uppercase tracking-wide">Δ vs Prev</th>
                )}
              </tr>
            </thead>
            <tbody>
              {analytics.withDeltas.map((q) => (
                <tr key={q.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-3 px-2">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-blue-50 text-blue-600 text-xs font-bold">
                      {q.version_number ?? '?'}
                    </span>
                  </td>
                  <td className="py-3 px-2 font-medium text-slate-800 truncate max-w-[150px]">{q.version_label || q.name}</td>
                  <td className="py-3 px-2 text-slate-500 hidden sm:table-cell">{formatDate(q.quote_date)}</td>
                  <td className="py-3 px-2 text-right tabular-nums text-slate-800">{formatCurrency(q.total_amount ?? 0)}</td>
                  <td className="py-3 px-2 text-right tabular-nums text-slate-800">{formatCurrency((q.total_amount ?? 0) / fx, 'USD')}</td>
                  <td className="py-3 px-2 text-center hidden md:table-cell">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[q.status] || 'bg-slate-100 text-slate-600 border-slate-200/50'}`}>
                      {q.status}
                    </span>
                  </td>
                  {multiVersion && (
                    <td className="py-3 px-2 text-right tabular-nums">
                      {q.deltaAbs === null ? (
                        <span className="text-slate-300">—</span>
                      ) : (
                        <div className={`flex items-center justify-end gap-1 ${q.deltaAbs > 0 ? 'text-red-600' : q.deltaAbs < 0 ? 'text-green-600' : 'text-slate-400'}`}>
                          {q.deltaAbs !== 0 && (q.deltaAbs > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />)}
                          <span className="text-xs">
                            {q.deltaAbs > 0 ? '+' : ''}{formatCurrency(q.deltaAbs / fx, 'USD')}
                            {q.deltaPct !== null && <span className="text-slate-400 ml-1">({q.deltaPct > 0 ? '+' : ''}{q.deltaPct.toFixed(1)}%)</span>}
                          </span>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!multiVersion && (
          <p className="text-xs text-slate-400 mt-3 text-center">Add more quotation versions to see comparisons.</p>
        )}
      </div>

      {/* Section 3: Cost Evolution Chart */}
      <div className="glass-white p-5">
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">Cost Evolution</h3>
        <div className="space-y-3">
          {analytics.sorted.map((q) => {
            const amount = q.total_amount ?? 0;
            const pct = (amount / analytics.maxAmount) * 100;
            const gradient = STATUS_GRADIENTS[q.status] || 'bg-gradient-to-r from-slate-300 to-slate-400';
            return (
              <div key={q.id}>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-sm text-slate-700">
                    <span className="font-medium">v{q.version_number}</span>
                    <span className="text-slate-400 ml-1.5">{q.version_label || ''}</span>
                  </span>
                  <div className="flex items-center gap-3 text-sm tabular-nums">
                    <span className="text-slate-500">{formatCurrency(amount)}</span>
                    <span className="font-semibold text-slate-800">{formatCurrency(amount / fx, 'USD')}</span>
                  </div>
                </div>
                <div className="h-7 bg-slate-100 rounded-lg overflow-hidden">
                  <div
                    className={`h-full ${gradient} rounded-lg transition-all duration-500`}
                    style={{ width: `${Math.max(pct, 2)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 mt-4 text-xs text-slate-500">
          {['Awarded', 'Estimating', 'Sent', 'Pending', 'Lost'].map(s => (
            <span key={s} className="flex items-center gap-1.5">
              <span className={`inline-block w-3 h-3 rounded-sm ${STATUS_GRADIENTS[s]}`} />
              {s}
            </span>
          ))}
        </div>
      </div>

      {/* Section 4: Financial Settings Comparison */}
      {multiVersion && (
        <div className="glass-white p-5">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">Financial Settings</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200/60">
                  <th className="py-2 px-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Ver</th>
                  <th className="py-2 px-2 text-right text-xs font-medium text-slate-500 uppercase tracking-wide">Profit</th>
                  <th className="py-2 px-2 text-right text-xs font-medium text-slate-500 uppercase tracking-wide">Tax %</th>
                  <th className="py-2 px-2 text-right text-xs font-medium text-slate-500 uppercase tracking-wide">Tariff</th>
                  <th className="py-2 px-2 text-right text-xs font-medium text-slate-500 uppercase tracking-wide hidden sm:table-cell">Install</th>
                  <th className="py-2 px-2 text-right text-xs font-medium text-slate-500 uppercase tracking-wide hidden sm:table-cell">Other</th>
                </tr>
              </thead>
              <tbody>
                {analytics.sorted.map((q, i) => {
                  const prev = i > 0 ? analytics.sorted[i - 1] : null;
                  const ch = (curr: number | null, prv: number | null) =>
                    prev && curr !== prv ? 'bg-amber-50 text-amber-700 font-semibold' : 'text-slate-700';
                  return (
                    <tr key={q.id} className="border-b border-slate-100 last:border-0">
                      <td className="py-2.5 px-2 font-medium text-slate-600">v{q.version_number}</td>
                      <td className={`py-2.5 px-2 text-right tabular-nums ${ch(q.profit_multiplier, prev?.profit_multiplier)}`}>
                        {((q.profit_multiplier ?? 0) * 100).toFixed(0)}%
                      </td>
                      <td className={`py-2.5 px-2 text-right tabular-nums ${ch(q.tax_percentage, prev?.tax_percentage)}`}>
                        {q.tax_percentage ?? 0}%
                      </td>
                      <td className={`py-2.5 px-2 text-right tabular-nums ${ch(q.tariff_multiplier, prev?.tariff_multiplier)}`}>
                        {((q.tariff_multiplier ?? 0) * 100).toFixed(0)}%
                      </td>
                      <td className={`py-2.5 px-2 text-right tabular-nums hidden sm:table-cell ${ch(q.install_delivery, prev?.install_delivery)}`}>
                        {formatCurrency(q.install_delivery ?? 0)}
                      </td>
                      <td className={`py-2.5 px-2 text-right tabular-nums hidden sm:table-cell ${ch(q.other_expenses, prev?.other_expenses)}`}>
                        {formatCurrency(q.other_expenses ?? 0)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
