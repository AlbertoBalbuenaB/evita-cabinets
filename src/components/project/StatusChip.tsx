import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

export type QuoteStatus =
  | 'Estimating'
  | 'Pending'
  | 'Sent'
  | 'Awarded'
  | 'Lost'
  | 'Discarded'
  | 'Cancelled';

export const QUOTE_STATUSES: readonly QuoteStatus[] = [
  'Pending',
  'Estimating',
  'Sent',
  'Awarded',
  'Lost',
  'Discarded',
  'Cancelled',
] as const;

interface StatusStyle {
  pill: string;
  dot: string;
}

const STATUS_STYLES: Record<QuoteStatus, StatusStyle> = {
  Estimating: {
    pill: 'bg-orange-600/10 text-orange-600 border-orange-600/25',
    dot: 'bg-orange-500',
  },
  Pending: {
    pill: 'bg-blue-600/10 text-blue-600 border-blue-600/25',
    dot: 'bg-blue-500',
  },
  Sent: {
    pill: 'bg-cyan-600/10 text-cyan-600 border-cyan-600/25',
    dot: 'bg-cyan-500',
  },
  Awarded: {
    pill: 'bg-emerald-600/10 text-emerald-600 border-emerald-600/25',
    dot: 'bg-emerald-500',
  },
  Lost: {
    pill: 'bg-rose-600/10 text-rose-600 border-rose-600/25',
    dot: 'bg-rose-500',
  },
  Discarded: {
    pill: 'bg-slate-500/10 text-slate-600 border-slate-500/25',
    dot: 'bg-slate-400',
  },
  Cancelled: {
    pill: 'bg-gray-500/10 text-gray-600 border-gray-500/25',
    dot: 'bg-gray-400',
  },
};

interface StatusChipProps {
  status: QuoteStatus | null | undefined;
  onChange?: (next: QuoteStatus) => void;
  disabled?: boolean;
}

export function StatusChip({ status, onChange, disabled }: StatusChipProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  const effectiveStatus = status ?? 'Pending';
  const style = STATUS_STYLES[effectiveStatus];
  const canOpen = !disabled && !!onChange;

  return (
    <div ref={wrapRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => canOpen && setOpen((v) => !v)}
        disabled={!canOpen}
        aria-haspopup={canOpen ? 'menu' : undefined}
        aria-expanded={canOpen ? open : undefined}
        className={`inline-flex items-center gap-1 px-[10px] py-[2px] rounded-full text-[11px] font-semibold border transition-opacity ${
          style.pill
        } ${canOpen ? 'cursor-pointer hover:opacity-80' : 'cursor-default'} focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:ring-offset-1`}
      >
        <span className="uppercase tracking-[0.02em]">{status ?? 'No status'}</span>
        {canOpen && <ChevronDown className="h-[11px] w-[11px] opacity-70" strokeWidth={1.5} />}
      </button>

      {open && canOpen && (
        <div
          role="menu"
          className="absolute left-0 top-full mt-1 z-30 glass-white rounded-lg py-1 min-w-[160px] shadow-[0_4px_20px_rgba(99,102,241,0.12)]"
        >
          {QUOTE_STATUSES.map((s) => {
            const sStyle = STATUS_STYLES[s];
            const isActive = s === status;
            return (
              <button
                key={s}
                type="button"
                role="menuitem"
                onClick={() => {
                  onChange?.(s);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors ${
                  isActive
                    ? 'bg-slate-100/70 text-slate-900 font-semibold'
                    : 'text-slate-700 hover:bg-slate-100/70'
                }`}
              >
                <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${sStyle.dot}`} />
                {s}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
