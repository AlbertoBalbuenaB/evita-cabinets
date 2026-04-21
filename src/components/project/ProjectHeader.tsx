import {
  AlertTriangle,
  ArrowLeft,
  Box,
  Calendar,
  MapPin,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { formatCurrency } from '../../lib/calculations';
import type { TotalMode } from '../../lib/quotationUiStore';
import { StatusChip, type QuoteStatus } from './StatusChip';
import { CurrencySegmented } from './CurrencySegmented';

export type PricingMethodLabel = 'Optimizer' | 'FT²';

export interface ProjectHeaderProps {
  projectName: string;
  projectId: string;
  variantName: string;
  status: QuoteStatus | null | undefined;
  isStale?: boolean;
  projectType?: string | null;
  address?: string | null;
  quotedAt: string; // ISO 'YYYY-MM-DD'
  total: { usd: number; mxn: number };
  totalMode: TotalMode;
  onTotalModeChange: (mode: TotalMode) => void;
  pricingMethod: 'sqft' | 'optimizer';
  delta?: { value: number; label: PricingMethodLabel };
  onEdit?: () => void;
  onStatusChange?: (next: QuoteStatus) => void;
  onBack?: () => void;
  /**
   * `fixed` (default) — pins the header under the Topbar at `top: 56px`,
   * spanning the viewport minus the sidebar. Requires the page to add a
   * spacer to avoid content hiding behind it. `inline` renders the header
   * as a normal block element; useful for the dev demo route so multiple
   * instances can stack.
   */
  variant?: 'fixed' | 'inline';
}

function formatQuotedDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatMoney(amount: number, currency: 'USD' | 'MXN'): string {
  // formatCurrency → "$217,052.74" style. Strip the currency code; we render
  // it separately in slate-500 so the amount can use tabular-nums cleanly.
  const raw = formatCurrency(amount, currency);
  // Intl returns e.g. "$217,052.74" for USD and "MX$217,052.74" for MXN; drop
  // any non-numeric prefix except the leading dollar sign.
  return raw.replace(/^[^\d$-]*/, '');
}

function formatDeltaPercent(value: number): string {
  const rounded = Math.round(value * 1000) / 10;
  const sign = rounded > 0 ? '+' : '';
  return `${sign}${rounded.toFixed(1)}%`;
}

export function ProjectHeader({
  projectName,
  variantName,
  status,
  isStale,
  projectType,
  address,
  quotedAt,
  total,
  totalMode,
  onTotalModeChange,
  pricingMethod,
  delta,
  onEdit,
  onStatusChange,
  onBack,
  variant = 'fixed',
}: ProjectHeaderProps) {
  const methodLabel: PricingMethodLabel = pricingMethod === 'optimizer' ? 'Optimizer' : 'FT²';
  const deltaIsNegative = delta != null && delta.value < 0;
  const deltaColor = delta == null
    ? ''
    : deltaIsNegative
    ? 'text-emerald-600'
    : 'text-rose-600';

  const outerClass =
    variant === 'fixed'
      ? 'fixed top-14 right-0 left-0 lg:left-[var(--rail-w)] z-20 transition-[left] duration-[250ms] ease-[cubic-bezier(0.16,1,0.3,1)]'
      : 'relative';

  return (
    <div
      className={outerClass}
      style={{
        background: 'rgba(255,255,255,0.65)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(226,232,240,0.7)',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid gap-4 lg:gap-6 py-[14px] lg:py-[18px] grid-cols-1 lg:[grid-template-columns:1fr_auto] items-start lg:items-center">
          {/* Left column — identity */}
          <div className="min-w-0">
            {/* Title row */}
            <div className="flex items-center gap-[10px] mb-[10px] flex-wrap">
              {onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  aria-label="Back to project"
                  className="flex-shrink-0 h-7 w-7 rounded-[7px] bg-white/70 border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-white inline-flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                >
                  <ArrowLeft className="h-[13px] w-[13px]" strokeWidth={1.5} />
                </button>
              )}
              <span className="text-[14px] text-slate-500 font-medium truncate max-w-[180px]">
                {projectName}
              </span>
              <span className="text-slate-300 font-normal text-base select-none" aria-hidden>
                /
              </span>
              <h1 className="text-[20px] font-bold text-slate-900 tracking-[-0.015em] leading-[1.15] truncate">
                {variantName}
              </h1>
            </div>

            {/* Chips row */}
            <div className="flex items-center gap-[6px] mb-[10px] flex-wrap">
              <StatusChip status={status} onChange={onStatusChange} />
              {isStale && (
                <span
                  className="inline-flex items-center gap-1 px-[8px] py-[2px] rounded-full border bg-amber-500/[0.12] text-amber-700 border-amber-500/30 text-[10px] font-bold tracking-[0.04em] uppercase"
                  title="The optimizer run is stale because cabinets changed after it was saved. Re-optimize in the Breakdown tab to refresh these numbers."
                >
                  <AlertTriangle className="h-[10px] w-[10px]" strokeWidth={1.5} />
                  Stale
                </span>
              )}
              {projectType && (
                <span className="inline-flex items-center gap-1 px-[8px] py-[2px] rounded-full border bg-indigo-500/[0.08] text-indigo-700 border-indigo-500/20 text-[11px] font-medium">
                  <Box className="h-[10px] w-[10px]" strokeWidth={1.5} />
                  {projectType}
                </span>
              )}
            </div>

            {/* Meta row */}
            <div className="flex items-center gap-[14px] flex-wrap text-[12px] text-slate-500">
              {address && (
                <span className="inline-flex items-center gap-[6px] min-w-0">
                  <MapPin className="h-[12px] w-[12px] flex-shrink-0" strokeWidth={1.5} />
                  <span className="truncate">{address}</span>
                </span>
              )}
              {quotedAt && (
                <span className="inline-flex items-center gap-[6px]">
                  <Calendar className="h-[12px] w-[12px] flex-shrink-0" strokeWidth={1.5} />
                  <span>
                    Quoted{' '}
                    <span className="text-slate-700 font-medium">
                      {formatQuotedDate(quotedAt)}
                    </span>
                  </span>
                </span>
              )}
              {onEdit && (
                <button
                  type="button"
                  onClick={onEdit}
                  className="text-blue-600 hover:text-blue-700 font-medium transition-colors focus:outline-none focus:underline"
                >
                  Edit
                </button>
              )}
            </div>
          </div>

          {/* Right column — financial card */}
          <div
            className="lg:min-w-[270px] rounded-[12px] px-[18px] py-[12px] border"
            style={{
              background:
                'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(59,130,246,0.06))',
              borderColor: 'rgba(165,180,252,0.55)',
            }}
          >
            <div className="text-[10px] font-semibold tracking-[0.14em] uppercase text-indigo-700 mb-1 flex items-center gap-[6px]">
              <Zap className="h-[11px] w-[11px]" strokeWidth={1.5} />
              Project Total · {methodLabel}
            </div>

            {totalMode === 'Both' ? (
              <div className="leading-tight">
                <div className="text-[22px] font-bold text-slate-900 tabular-nums tracking-[-0.02em]">
                  {formatMoney(total.usd, 'USD')}
                  <span className="text-[12px] text-slate-500 font-medium ml-[5px]">USD</span>
                </div>
                <div className="text-[14px] text-slate-500 font-medium tabular-nums mt-0.5">
                  {formatMoney(total.mxn, 'MXN')}
                  <span className="ml-[4px]">MXN</span>
                </div>
              </div>
            ) : (
              <div className="leading-none">
                <span className="text-[24px] font-bold text-slate-900 tabular-nums tracking-[-0.02em]">
                  {formatMoney(totalMode === 'USD' ? total.usd : total.mxn, totalMode)}
                </span>
                <span className="text-[13px] text-slate-500 font-medium ml-[5px]">
                  {totalMode}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between gap-2 mt-[10px] flex-wrap">
              <CurrencySegmented value={totalMode} onChange={onTotalModeChange} />
              {delta && (
                <span
                  className={`inline-flex items-center gap-[3px] text-[10.5px] font-semibold tabular-nums ${deltaColor}`}
                  title={`Compared to the ${delta.label} total on this quotation.`}
                >
                  {deltaIsNegative ? (
                    <TrendingDown className="h-[11px] w-[11px]" strokeWidth={1.75} />
                  ) : (
                    <TrendingUp className="h-[11px] w-[11px]" strokeWidth={1.75} />
                  )}
                  {formatDeltaPercent(delta.value)} vs {delta.label}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
