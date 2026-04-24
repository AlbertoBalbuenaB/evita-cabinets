import { Layers, SplitSquareVertical, Wand2 } from 'lucide-react';

type GroupingMode = 'pooled' | 'auto' | 'per-area';

interface Props {
  value: GroupingMode;
  onChange: (next: GroupingMode) => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

/**
 * Segmented control: Pool materials ←→ Auto ←→ Split by area.
 *
 * Controls how the parallel optimizer groups pieces into workers:
 *   - 'pooled'   — one worker per (material, thickness), pieces pooled
 *                  across all areas. Best material utilization.
 *   - 'auto'     — pooled for normal materials, but any material with >=
 *                  15 piece-types auto-splits per-area. Strictly safe —
 *                  output identical to 'pooled' when nothing is
 *                  pathological. Default for new quotations.
 *   - 'per-area' — every material splits per-area regardless of size.
 *                  Most resilient, worst utilization.
 *
 * Purely presentational — the parent store owns the state and the
 * invalidation of any pending result on mode change.
 */
export function GroupingModeToggle({ value, onChange, disabled = false, size = 'sm' }: Props) {
  const btn = size === 'sm'
    ? 'px-2.5 py-1 text-xs'
    : 'px-3 py-1.5 text-sm';

  const segClass = (active: boolean, withLeftBorder = false): string => {
    const base = `${btn} flex items-center gap-1.5 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus`;
    const border = withLeftBorder ? ' border-l border-border-soft' : '';
    const state = active
      ? ' bg-accent-primary text-accent-on'
      : disabled
        ? ' text-fg-300 cursor-not-allowed'
        : ' text-fg-500 hover:bg-surf-hover';
    return base + border + state;
  };

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
        className={segClass(value === 'pooled')}
        title="One worker per (material, thickness). Pieces pool across all areas for best material utilization."
        aria-pressed={value === 'pooled'}
      >
        <Layers className="h-3.5 w-3.5" />
        Pool
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange('auto')}
        className={segClass(value === 'auto', true)}
        title="Pool by default, but automatically split per-area any material with ≥15 piece-types. Identical to Pool when no material is pathological — recommended default."
        aria-pressed={value === 'auto'}
      >
        <Wand2 className="h-3.5 w-3.5" />
        Auto
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange('per-area')}
        className={segClass(value === 'per-area', true)}
        title="One worker per (material, thickness, area). Every area packs its own boards — most resilient, but highest material waste. Use when Auto still times out."
        aria-pressed={value === 'per-area'}
      >
        <SplitSquareVertical className="h-3.5 w-3.5" />
        Split
      </button>
    </div>
  );
}
