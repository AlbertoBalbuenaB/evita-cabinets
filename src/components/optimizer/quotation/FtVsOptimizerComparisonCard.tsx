import { TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { formatCurrency } from '../../../lib/calculations';

interface Props {
  sqftTotal: number;
  optimizerTotal: number | null;
  /** What the quotation will actually show (depends on pricing_method). */
  activeMethod: 'sqft' | 'optimizer';
}

/**
 * Side-by-side comparison of the two quotation totals. Always visible
 * inside the Breakdown tab so the user can see the delta at a
 * glance when switching pricing methods.
 *
 * When optimizerTotal is null (no active run yet), the right side shows
 * a placeholder and the delta is hidden.
 */
export function FtVsOptimizerComparisonCard({ sqftTotal, optimizerTotal, activeMethod }: Props) {
  const hasOptimizer = optimizerTotal != null && Number.isFinite(optimizerTotal);
  const delta        = hasOptimizer ? (optimizerTotal as number) - sqftTotal : 0;
  const deltaPct     = hasOptimizer && sqftTotal > 0
    ? ((delta / sqftTotal) * 100)
    : 0;

  const deltaTone =
    !hasOptimizer ? 'slate' :
    delta < 0     ? 'green' :
    delta > 0     ? 'red'   : 'slate';

  const deltaIcon =
    !hasOptimizer ? Minus :
    delta < 0     ? TrendingDown :
    delta > 0     ? TrendingUp   : Minus;

  return (
    <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 items-stretch">
      {/* ft² side */}
      <div className={`rounded-lg border p-3 ${
        activeMethod === 'sqft' ? 'border-accent-tint-border bg-accent-tint-soft' : 'border-border-soft bg-surf-card'
      }`}>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-fg-500 uppercase tracking-wide">ft² Pricing</span>
          {activeMethod === 'sqft' && (
            <span className="text-[10px] font-semibold text-accent-text bg-accent-tint-soft px-1.5 py-0.5 rounded">ACTIVE</span>
          )}
        </div>
        <div className="text-2xl font-bold text-fg-900 tabular-nums">
          {formatCurrency(sqftTotal)}
        </div>
        <div className="text-xs text-fg-400 mt-0.5">Current traditional rollup</div>
      </div>

      {/* Delta */}
      <div className="flex flex-col items-center justify-center px-2 md:px-3">
        {hasOptimizer ? (
          <>
            <div className={`flex items-center gap-1 text-base font-bold tabular-nums ${
              deltaTone === 'green' ? 'text-status-emerald-fg' :
              deltaTone === 'red'   ? 'text-status-red-fg'   : 'text-fg-500'
            }`}>
              {(() => { const Icon = deltaIcon; return <Icon className="h-4 w-4" />; })()}
              {delta >= 0 ? '+' : ''}{formatCurrency(delta)}
            </div>
            <div className={`text-xs tabular-nums ${
              deltaTone === 'green' ? 'text-status-emerald-fg' :
              deltaTone === 'red'   ? 'text-status-red-fg'   : 'text-fg-500'
            }`}>
              {delta >= 0 ? '+' : ''}{deltaPct.toFixed(1)}%
            </div>
          </>
        ) : (
          <div className="text-xs text-fg-400">vs</div>
        )}
      </div>

      {/* Breakdown side */}
      <div className={`rounded-lg border p-3 ${
        activeMethod === 'optimizer' ? 'border-accent-tint-border bg-accent-tint-soft' : 'border-border-soft bg-surf-card'
      }`}>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-fg-500 uppercase tracking-wide">Optimizer</span>
          {activeMethod === 'optimizer' && (
            <span className="text-[10px] font-semibold text-accent-text bg-accent-tint-soft px-1.5 py-0.5 rounded">ACTIVE</span>
          )}
        </div>
        <div className="text-2xl font-bold text-fg-900 tabular-nums">
          {hasOptimizer ? formatCurrency(optimizerTotal as number) : '—'}
        </div>
        <div className="text-xs text-fg-400 mt-0.5">
          {hasOptimizer ? 'From active optimizer run' : 'No active run yet'}
        </div>
      </div>
    </div>
  );
}
