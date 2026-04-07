import { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, AlertCircle, Info } from 'lucide-react';

interface Props {
  warnings: string[];
  cabinetsSkipped: Array<{ id: string; reason: string }>;
  cabinetsCoveredCount: number;
  totalCabinetsCount: number;
}

/**
 * Collapsible alert panel shown under the Cut-list Pricing tab header.
 * Lists:
 *  - Coverage summary (e.g. "12 of 30 cabinets covered by optimizer")
 *  - Warnings from the builder (missing tech info, missing materials, etc.)
 *  - Cabinets skipped and why (D2 mixed mode)
 */
export function OptimizerWarningsPanel({
  warnings,
  cabinetsSkipped,
  cabinetsCoveredCount,
  totalCabinetsCount,
}: Props) {
  const [open, setOpen] = useState(false);

  const hasAnything = warnings.length > 0 || cabinetsSkipped.length > 0;
  const coverage = totalCabinetsCount > 0
    ? Math.round((cabinetsCoveredCount / totalCabinetsCount) * 100)
    : 0;

  // Compute tone: red if nothing is covered, amber if partial, green if full.
  const tone = cabinetsCoveredCount === 0
    ? 'red'
    : cabinetsCoveredCount < totalCabinetsCount
      ? 'amber'
      : 'green';

  const toneClasses = {
    red:   { bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-900',    icon: 'text-red-600'    },
    amber: { bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-900',  icon: 'text-amber-600'  },
    green: { bg: 'bg-green-50',  border: 'border-green-200',  text: 'text-green-900',  icon: 'text-green-600'  },
  }[tone];

  if (totalCabinetsCount === 0 && !hasAnything) return null;

  return (
    <div className={`border rounded-lg ${toneClasses.bg} ${toneClasses.border}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left"
      >
        {tone === 'green'
          ? <Info className={`h-4 w-4 ${toneClasses.icon}`} />
          : <AlertTriangle className={`h-4 w-4 ${toneClasses.icon}`} />}
        <span className={`text-sm font-medium ${toneClasses.text}`}>
          {cabinetsCoveredCount}/{totalCabinetsCount} cabinets covered ({coverage}%)
          {warnings.length > 0 && ` — ${warnings.length} warning${warnings.length > 1 ? 's' : ''}`}
        </span>
        <div className="flex-1" />
        {hasAnything && (open
          ? <ChevronDown className={`h-4 w-4 ${toneClasses.icon}`} />
          : <ChevronRight className={`h-4 w-4 ${toneClasses.icon}`} />)}
      </button>

      {open && hasAnything && (
        <div className={`px-3 pb-3 border-t ${toneClasses.border}`}>
          {cabinetsSkipped.length > 0 && (
            <div className="mt-2">
              <div className={`text-xs font-semibold uppercase tracking-wide mb-1 ${toneClasses.text}`}>
                Cabinets falling back to ft² ({cabinetsSkipped.length})
              </div>
              <ul className="text-xs space-y-0.5 list-disc list-inside text-slate-700">
                {cabinetsSkipped.map((s) => (
                  <li key={s.id}>
                    <span className="font-mono text-slate-500">{s.id.slice(0, 8)}…</span>
                    {' — '}{s.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {warnings.length > 0 && (
            <div className="mt-2">
              <div className={`text-xs font-semibold uppercase tracking-wide mb-1 ${toneClasses.text}`}>
                Warnings ({warnings.length})
              </div>
              <ul className="text-xs space-y-0.5 text-slate-700">
                {warnings.map((w, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <AlertCircle className="h-3 w-3 text-amber-500 shrink-0 mt-0.5" />
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
