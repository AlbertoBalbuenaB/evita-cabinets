import { useState, useRef, useEffect } from 'react';
import type { Cubrecanto } from '../types';

const EB_TYPES = [
  { value: 0, label: '—', cls: 'bg-slate-100 text-slate-400' },
  { value: 1, label: 'A', cls: 'bg-slate-800 text-white' },
  { value: 2, label: 'B', cls: 'bg-slate-600 text-white' },
  { value: 3, label: 'C', cls: 'bg-slate-400 text-white' },
];

const SIDES: [keyof Cubrecanto, string][] = [['sup', 'Top'], ['inf', 'Bottom'], ['izq', 'Left'], ['der', 'Right']];

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
          {SIDES.map(([k, label]) => {
            const val = cubrecanto[k];
            return (
              <div key={k} className="flex items-center justify-between py-1">
                <span className="text-xs text-slate-600 w-12">{label}</span>
                <div className="flex gap-1">
                  {EB_TYPES.map(et => (
                    <button key={et.value} type="button" onClick={() => onUpdate({ ...cubrecanto, [k]: et.value })}
                      className={`w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center transition-all
                        ${val === et.value ? et.cls + ' ring-1 ring-blue-400' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>
                      {et.label}
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
