import { useRef } from 'react';
import type { TotalMode } from '../../lib/quotationUiStore';

interface CurrencySegmentedProps {
  value: TotalMode;
  onChange: (next: TotalMode) => void;
}

const OPTIONS: readonly TotalMode[] = ['USD', 'MXN', 'Both'] as const;

export function CurrencySegmented({ value, onChange }: CurrencySegmentedProps) {
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const currentIndex = OPTIONS.indexOf(value);
    const delta = e.key === 'ArrowLeft' ? -1 : 1;
    const nextIndex = (currentIndex + delta + OPTIONS.length) % OPTIONS.length;
    const next = OPTIONS[nextIndex];
    onChange(next);
    buttonRefs.current[nextIndex]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label="Currency display"
      onKeyDown={handleKeyDown}
      className="inline-flex gap-[2px] p-[2px] bg-white/75 rounded-[7px] border border-slate-200/60"
    >
      {OPTIONS.map((mode, i) => {
        const active = mode === value;
        return (
          <button
            key={mode}
            ref={(el) => {
              buttonRefs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(mode)}
            className={`px-[10px] py-[3px] rounded-[5px] text-[10.5px] font-semibold transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500/40 ${
              active
                ? 'bg-white text-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.06)]'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {mode}
          </button>
        );
      })}
    </div>
  );
}
