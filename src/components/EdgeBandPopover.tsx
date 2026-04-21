import { useState, useRef, useEffect } from 'react';
import type { Cubrecanto } from '../types';

const EB_VALUES = [0, 1, 2, 3] as const;
const EB_LABELS: Record<number, string> = { 0: '—', 1: 'A', 2: 'B', 3: 'C' };
const EB_CLS_ACTIVE: Record<number, string> = {
  0: 'bg-surf-muted text-fg-400',
  1: 'bg-fg-800 text-fg-inverse',
  2: 'bg-fg-600 text-fg-inverse',
  3: 'bg-fg-400 text-fg-inverse',
};

const SIDES: [keyof Cubrecanto, string][] = [['sup', 'T'], ['inf', 'B'], ['izq', 'L'], ['der', 'R']];

/** Compact popover — used in optimizer sidebar where space is tight */
export function EdgeBandPopover({
  cubrecanto,
  onUpdate,
}: {
  cubrecanto: Cubrecanto;
  onUpdate: (cb: Cubrecanto) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const count = [cubrecanto.sup, cubrecanto.inf, cubrecanto.izq, cubrecanto.der].filter(v => v > 0).length;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const fullLabels: Record<string, string> = { T: 'Top', B: 'Bottom', L: 'Left', R: 'Right' };

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(v => !v)} title="Edge banding"
        className={`text-xs px-1 py-0.5 rounded ${count > 0 ? 'bg-fg-700 text-fg-inverse font-semibold' : 'text-fg-400 hover:bg-surf-hover'}`}>
        {count > 0 ? count : '—'}
      </button>
      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 bg-surf-card border border-border-soft rounded-lg shadow-card p-2.5 w-40">
          <div className="text-xs font-semibold text-fg-600 mb-2">Edge Banding</div>
          <div className="text-[10px] text-fg-400 mb-2 flex gap-2"><span>A=━━</span><span>B=╌╌</span><span>C=····</span></div>
          {SIDES.map(([k, shortLabel]) => {
            const val = cubrecanto[k];
            return (
              <div key={k} className="flex items-center justify-between py-1">
                <span className="text-xs text-fg-600 w-12">{fullLabels[shortLabel]}</span>
                <div className="flex gap-1">
                  {EB_VALUES.map(v => (
                    <button key={v} type="button" onClick={() => onUpdate({ ...cubrecanto, [k]: v })}
                      className={`w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center transition-all
                        ${val === v ? EB_CLS_ACTIVE[v] + ' ring-1 ring-focus' : 'bg-surf-muted text-fg-400 hover:bg-surf-hover'}`}>
                      {EB_LABELS[v]}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Single-side EB toggle — renders ONE button that cycles —→A→B→C→—.
 *  Used as individual cells in a table (one per side: T, B, L, R). */
export function EdgeBandCell({
  value,
  onChange,
  side,
}: {
  value: number;
  onChange: (v: number) => void;
  side: string;
}) {
  const cycle = () => onChange((value + 1) % 4);
  return (
    <button
      type="button"
      onClick={cycle}
      title={`${side}: ${EB_LABELS[value]} — click to cycle`}
      className={`w-7 h-6 rounded text-[10px] font-bold flex items-center justify-center transition-all
        ${value > 0 ? EB_CLS_ACTIVE[value] + ' ring-1 ring-offset-1 ring-focus' : 'bg-surf-muted text-fg-300 hover:bg-surf-hover hover:text-fg-500'}`}
    >
      {EB_LABELS[value]}
    </button>
  );
}

/** Legacy inline row — kept for backward compatibility */
export function EdgeBandInline({
  cubrecanto,
  onUpdate,
}: {
  cubrecanto: Cubrecanto;
  onUpdate: (cb: Cubrecanto) => void;
}) {
  return (
    <div className="flex gap-0.5 justify-center">
      {SIDES.map(([k, label]) => (
        <EdgeBandCell
          key={k}
          value={cubrecanto[k]}
          onChange={v => onUpdate({ ...cubrecanto, [k]: v })}
          side={label}
        />
      ))}
    </div>
  );
}
