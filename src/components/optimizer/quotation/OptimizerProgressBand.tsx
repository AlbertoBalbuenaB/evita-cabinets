import { Loader2, X } from 'lucide-react';

export interface OptimizerProgressBandProps {
  /** Progress snapshot owned by the store. When null, the band renders
   *  nothing — kept in the same component so the parent can always mount
   *  it and just pass the slice. */
  progress: { completed: number; total: number; current: string | null } | null;
  /** Invoked when the user clicks "Cancel". Should terminate all active
   *  workers and clear the progress state. */
  onCancel: () => void;
}

/**
 * Progress band shown below the Breakdown header while the parallel
 * optimizer pool is running. Tokenized (glass + accent gradient fill)
 * so both Light and Midnight themes render correctly.
 */
export function OptimizerProgressBand({ progress, onCancel }: OptimizerProgressBandProps) {
  if (!progress) return null;

  const { completed, total, current } = progress;
  const percent = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;

  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-surf-card border-b border-border-soft px-4 py-2.5"
    >
      <div className="flex items-center gap-3">
        <Loader2 className="h-4 w-4 animate-spin text-accent-text shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-xs font-medium text-fg-800 truncate">
              {completed < total
                ? `Optimizing material ${completed + 1} of ${total}${current ? `: ${current}` : '...'}`
                : 'Finalizing...'}
            </span>
            <span className="text-xs text-fg-600 shrink-0 tabular-nums">{percent}%</span>
          </div>
          <div
            className="h-1.5 w-full bg-surf-muted rounded-full overflow-hidden"
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full bg-accent-primary transition-[width] duration-300 ease-out"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-md border border-border-soft text-fg-700 hover:bg-surf-hover transition-colors text-xs font-medium focus-visible:ring-2 focus-visible:ring-focus outline-none"
          title="Cancel the optimizer run"
        >
          <X className="h-3.5 w-3.5" />
          Cancel
        </button>
      </div>
    </div>
  );
}
