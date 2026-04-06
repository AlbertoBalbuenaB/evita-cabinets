import { useState, useRef, useEffect } from 'react';
import type { Cubrecanto } from '../types';

const EB_VALUES = [0, 1, 2, 3] as const;
const EB_LABELS: Record<number, string> = { 0: '—', 1: 'A', 2: 'B', 3: 'C' };
const EB_CLS_ACTIVE: Record<number, string> = {
  0: 'bg-slate-100 text-slate-400',
  1: 'bg-slate-800 text-white',
  2: 'bg-slate-600 text-white',
  3: 'bg-slate-400 text-white',
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
        className={`text-xs px-1 py-0.5 rounded ${count > 0 ? 'bg-slate-700 text-white font-semibold' : 'text-slate-400 hover:bg-slate-100'}`}>
        {count > 0 ? count : '—'}
      </button>
      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg p-2.5 w-40">
          <div className="text-xs font-semibold text-slate-600 mb-2">Edge Banding</div>
          <div className="text-[10px] text-slate-400 mb-2 flex gap-2"><span>A=━━</span><span>B=╌╌</span><span>C=····</span></div>
          {SIDES.map(([k, shortLabel]) => {
            const val = cubrecanto[k];
            return (
              <div key={k} className="flex items-center justify-between py-1">
                <span className="text-xs text-slate-600 w-12">{fullLabels[shortLabel]}</span>
                <div className="flex gap-1">
                  {EB_VALUES.map(v => (
                    <button key={v} type="button" onClick={() => onUpdate({ ...cubrecanto, [k]: v })}
                      className={`w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center transition-all
                        ${val === v ? EB_CLS_ACTIVE[v] + ' ring-1 ring-blue-400' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>
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

/** Inline 4-button row — used in product cut list table where there's more room.
 *  Each button shows the side label (T/B/L/R) and clicking cycles through —→A→B→C→— */
export function EdgeBandInline({
  cubrecanto,
  onUpdate,
}: {
  cubrecanto: Cubrecanto;
  onUpdate: (cb: Cubrecanto) => void;
}) {
  const cycle = (k: keyof Cubrecanto) => {
    const next = ((cubrecanto[k] + 1) % 4) as 0 | 1 | 2 | 3;
    onUpdate({ ...cubrecanto, [k]: next });
  };

  return (
    <div className="flex gap-0.5 justify-center">
      {SIDES.map(([k, label]) => {
        const val = cubrecanto[k];
        const active = val > 0;
        return (
          <button
            key={k}
            type="button"
            onClick={() => cycle(k)}
            title={`${label}: ${EB_LABELS[val]} — click to cycle`}
            className={`w-6 h-5 rounded text-[10px] font-bold flex items-center justify-center transition-all
              ${active ? EB_CLS_ACTIVE[val] : 'bg-slate-50 text-slate-300 hover:bg-slate-100 hover:text-slate-500'}`}
          >
            {active ? label : label}
          </button>
        );
      })}
    </div>
  );
}
