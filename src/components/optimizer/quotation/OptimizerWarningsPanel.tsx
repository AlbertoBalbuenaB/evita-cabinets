import { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, AlertCircle, Info } from 'lucide-react';

interface UnplacedPiece {
  nombre: string;
  ancho: number;
  alto: number;
  count: number;
}

interface Props {
  warnings: string[];
  cabinetsSkipped: Array<{ id: string; reason: string }>;
  cabinetsCoveredCount: number;
  totalCabinetsCount: number;
  /** Individual cut-pieces the optimizer could not place on any board.
   *  Distinct from `cabinetsSkipped` (whole-cabinet fallback to ft²): these
   *  are pieces within packed cabinets that exceeded all stock sizes or
   *  got stranded by the recursion safeguard. */
  unplacedPieces?: UnplacedPiece[];
  /** Number of times guillotinePack hit its recursion call-count cap.
   *  Non-zero means some groups were sub-optimally packed; a +5-10% safety
   *  margin on material estimates is advised for those groups. */
  capFires?: number;
}

/**
 * Collapsible alert panel shown under the Breakdown tab header.
 * Lists:
 *  - Coverage summary (e.g. "12 of 30 cabinets covered by optimizer")
 *  - Warnings from the builder (missing tech info, missing materials, etc.)
 *  - Cabinets skipped and why (D2 mixed mode)
 *  - Individual pieces that could not be placed (post-Y.g refactor)
 *  - Guillotine recursion safeguard fires (post-Y.g refactor)
 */
export function OptimizerWarningsPanel({
  warnings,
  cabinetsSkipped,
  cabinetsCoveredCount,
  totalCabinetsCount,
  unplacedPieces = [],
  capFires = 0,
}: Props) {
  const [open, setOpen] = useState(false);

  const unplacedTotal = unplacedPieces.reduce((s, u) => s + u.count, 0);
  const hasAnything =
    warnings.length > 0 ||
    cabinetsSkipped.length > 0 ||
    unplacedPieces.length > 0 ||
    capFires > 0;

  const coverage = totalCabinetsCount > 0
    ? Math.round((cabinetsCoveredCount / totalCabinetsCount) * 100)
    : 0;

  // Compute tone: red if nothing is covered or pieces unplaced, amber if
  // partial / capFires fired, green if fully covered and no warnings.
  const tone = cabinetsCoveredCount === 0 || unplacedTotal > 0
    ? 'red'
    : cabinetsCoveredCount < totalCabinetsCount || capFires > 0
      ? 'amber'
      : 'green';

  const toneClasses = {
    red:   { bg: 'bg-status-red-bg',    border: 'border-status-red-brd',    text: 'text-status-red-fg',    icon: 'text-status-red-fg'    },
    amber: { bg: 'bg-status-amber-bg',  border: 'border-status-amber-brd',  text: 'text-status-amber-fg',  icon: 'text-status-amber-fg'  },
    green: { bg: 'bg-status-emerald-bg',  border: 'border-status-emerald-brd',  text: 'text-status-emerald-fg',  icon: 'text-status-emerald-fg'  },
  }[tone];

  if (totalCabinetsCount === 0 && !hasAnything) return null;

  // Summary suffix: compact list of the extra signals.
  const summarySuffix: string[] = [];
  if (warnings.length > 0) summarySuffix.push(`${warnings.length} warning${warnings.length > 1 ? 's' : ''}`);
  if (unplacedTotal > 0) summarySuffix.push(`${unplacedTotal} piece${unplacedTotal > 1 ? 's' : ''} unplaced`);
  if (capFires > 0) summarySuffix.push(`${capFires} sub-optimal pack${capFires > 1 ? 's' : ''}`);

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
          {summarySuffix.length > 0 && ` — ${summarySuffix.join(', ')}`}
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
              <ul className="text-xs space-y-0.5 list-disc list-inside text-fg-700">
                {cabinetsSkipped.map((s) => (
                  <li key={s.id}>
                    <span className="font-mono text-fg-500">{s.id.slice(0, 8)}…</span>
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
              <ul className="text-xs space-y-0.5 text-fg-700">
                {warnings.map((w, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <AlertCircle className="h-3 w-3 text-amber-500 shrink-0 mt-0.5" />
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {unplacedPieces.length > 0 && (
            <div className="mt-2">
              <div className={`text-xs font-semibold uppercase tracking-wide mb-1 ${toneClasses.text}`}>
                Unplaced pieces ({unplacedTotal})
              </div>
              <ul className="text-xs space-y-0.5 list-disc list-inside text-fg-700">
                {unplacedPieces.map((u, i) => (
                  <li key={`${u.nombre}-${u.ancho}x${u.alto}-${i}`}>
                    {u.nombre} {u.ancho}×{u.alto}mm{' '}
                    <span className="font-mono text-fg-500">×{u.count}</span>
                  </li>
                ))}
              </ul>
              <div className="text-xs text-fg-600 mt-1">
                These pieces did not fit on any available stock or got stranded by
                the recursion safeguard. Review dimensions and grain (veta) settings,
                or add a board size that can host them.
              </div>
            </div>
          )}

          {capFires > 0 && (
            <div className="mt-2">
              <div className={`text-xs font-semibold uppercase tracking-wide mb-1 ${toneClasses.text}`}>
                Sub-optimal packing ({capFires} group{capFires > 1 ? 's' : ''})
              </div>
              <div className="text-xs text-fg-700 flex items-start gap-1.5">
                <AlertCircle className="h-3 w-3 text-amber-500 shrink-0 mt-0.5" />
                <span>
                  The guillotine recursion safeguard fired {capFires} time
                  {capFires > 1 ? 's' : ''}. Some groups may use more boards
                  than the theoretical optimum. Consider adding a{' '}
                  <strong>+5-10% safety margin</strong> to material estimates
                  for this quotation.
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
