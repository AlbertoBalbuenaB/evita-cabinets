import { useRef } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import type { ThemePreference } from '../lib/theme';

type Variant = 'topbar' | 'menu';

interface ThemeToggleProps {
  variant?: Variant;
  className?: string;
}

const OPTIONS: ReadonlyArray<{
  value: ThemePreference;
  label: string;
  Icon: typeof Sun;
}> = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'midnight', label: 'Midnight', Icon: Moon },
  { value: 'system', label: 'System', Icon: Monitor },
];

export function ThemeToggle({ variant = 'topbar', className = '' }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const btnRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const activeIdx = Math.max(
    0,
    OPTIONS.findIndex((o) => o.value === theme),
  );

  function handleKey(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const delta = e.key === 'ArrowRight' ? 1 : -1;
    const next = (activeIdx + delta + OPTIONS.length) % OPTIONS.length;
    setTheme(OPTIONS[next].value);
    btnRefs.current[next]?.focus();
  }

  const isMenu = variant === 'menu';
  const trackClass = isMenu
    ? 'inline-flex items-center gap-0.5 rounded-lg bg-seg-track p-0.5 border border-border-soft'
    : 'inline-flex items-center gap-0.5 rounded-lg bg-seg-track p-0.5 border border-border-soft';
  const btnBase =
    'inline-flex items-center justify-center rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focus';
  const btnSize = isMenu ? 'h-7 w-7' : 'h-7 w-7 sm:h-7 sm:w-7';

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      onKeyDown={handleKey}
      className={`${trackClass} ${className}`}
    >
      {OPTIONS.map(({ value, label, Icon }, i) => {
        const active = value === theme;
        return (
          <button
            key={value}
            ref={(el) => {
              btnRefs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            tabIndex={active ? 0 : -1}
            onClick={() => setTheme(value)}
            className={`${btnBase} ${btnSize} ${
              active
                ? 'bg-seg-active-bg text-seg-active-fg shadow-seg-active'
                : 'text-fg-500 hover:text-fg-700'
            }`}
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
          </button>
        );
      })}
    </div>
  );
}
