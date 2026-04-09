import { Calculator, Layers } from 'lucide-react';
import type { PricingMethod } from '../../../types';

interface Props {
  value: PricingMethod;
  onChange: (next: PricingMethod) => void;
  /** Disables the "breakdown" option when there's no active run yet. */
  canSelectOptimizer: boolean;
  size?: 'sm' | 'md';
}

/**
 * Segmented control: ft² ←→ Breakdown.
 *
 * Writes to quotations.pricing_method via the onChange callback. The
 * "Breakdown" segment is disabled until the quotation has at least one
 * active optimizer run (otherwise there's nothing to flip to).
 *
 * The actual DB write (and the updateProjectTotal re-run) is owned by
 * the parent — this component is purely presentational.
 */
export function PricingMethodToggle({ value, onChange, canSelectOptimizer, size = 'sm' }: Props) {
  const btn = size === 'sm'
    ? 'px-2.5 py-1 text-xs'
    : 'px-3 py-1.5 text-sm';

  return (
    <div className="inline-flex items-center rounded border border-slate-200 overflow-hidden bg-white">
      <button
        type="button"
        onClick={() => onChange('sqft')}
        className={`${btn} flex items-center gap-1.5 font-medium transition-colors ${
          value === 'sqft'
            ? 'bg-blue-600 text-white'
            : 'text-slate-500 hover:bg-slate-50'
        }`}
      >
        <Calculator className="h-3.5 w-3.5" />
        ft²
      </button>
      <button
        type="button"
        disabled={!canSelectOptimizer}
        onClick={() => onChange('optimizer')}
        className={`${btn} flex items-center gap-1.5 font-medium transition-colors border-l border-slate-200 ${
          value === 'optimizer'
            ? 'bg-blue-600 text-white'
            : canSelectOptimizer
              ? 'text-slate-500 hover:bg-slate-50'
              : 'text-slate-300 cursor-not-allowed'
        }`}
        title={canSelectOptimizer ? undefined : 'Save and activate a run first to enable breakdown pricing.'}
      >
        <Layers className="h-3.5 w-3.5" />
        Optimizer
      </button>
    </div>
  );
}
