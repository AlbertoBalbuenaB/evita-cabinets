import { Layers, SplitSquareVertical } from 'lucide-react';

type GroupingMode = 'pooled' | 'per-area';

interface Props {
  value: GroupingMode;
  onChange: (next: GroupingMode) => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

/**
 * Segmented control: Pool materials ←→ Split by area.
 *
 * Controls how the parallel optimizer groups pieces into workers:
 *   - 'pooled'   — one worker per (material, thickness), pieces pooled
 *                  across all areas. Default. Best material utilization.
 *   - 'per-area' — one worker per (material, thickness, areaId), so each
 *                  area packs its own boards independently. Trades a bit
 *                  of material efficiency for dramatically smaller pack
 *                  problems, avoiding the per-group timeout on large
 *                  quotations where a single material spans many areas.
 *
 * Purely presentational — the parent store owns the state and the
 * invalidation of any pending result on mode change.
 */
export function GroupingModeToggle({ value, onChange, disabled = false, size = 'sm' }: Props) {
  const btn = size === 'sm'
    ? 'px-2.5 py-1 text-xs'
    : 'px-3 py-1.5 text-sm';

  return (
    <div
      className="inline-flex items-center rounded border border-border-soft overflow-hidden bg-surf-card"
      role="group"
      aria-label="Grouping mode"
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange('pooled')}
        className={`${btn} flex items-center gap-1.5 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
          value === 'pooled'
            ? 'bg-accent-primary text-accent-on'
            : disabled
              ? 'text-fg-300 cursor-not-allowed'
              : 'text-fg-500 hover:bg-surf-hover'
        }`}
        title="One worker per (material, thickness). Pieces pool across all areas for best material utilization."
        aria-pressed={value === 'pooled'}
      >
        <Layers className="h-3.5 w-3.5" />
        Pool materials
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange('per-area')}
        className={`${btn} flex items-center gap-1.5 font-medium transition-colors border-l border-border-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
          value === 'per-area'
            ? 'bg-accent-primary text-accent-on'
            : disabled
              ? 'text-fg-300 cursor-not-allowed'
              : 'text-fg-500 hover:bg-surf-hover'
        }`}
        title="One worker per (material, thickness, area). Each area packs its own boards — avoids timeouts on large quotations at a small utilization cost."
        aria-pressed={value === 'per-area'}
      >
        <SplitSquareVertical className="h-3.5 w-3.5" />
        Split by area
      </button>
    </div>
  );
}
