import { useState, useRef, useEffect } from 'react';
import { History, Check, Pencil, Trash2, Loader2, GitCompareArrows, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '../../../lib/calculations';
import type { QuotationOptimizerRun } from '../../../types';

interface Props {
  runs: QuotationOptimizerRun[];
  activeRunId: string | null;
  onSetActive: (runId: string) => Promise<void>;
  onLoad: (runId: string) => Promise<void>;
  onRename: (runId: string, name: string) => Promise<void>;
  onDelete: (runId: string) => Promise<void>;
  onOpenCompare: () => void;
}

/**
 * Dropdown popover showing the saved optimizer runs for the current
 * quotation. Opens from a button in the Breakdown tab header.
 *
 * Each row supports:
 *  - click name: load the run into the viewer (without setting active)
 *  - "Set active" button: flip the active run, triggers DB write
 *  - pencil: inline rename (enter to save, esc to cancel)
 *  - trash: delete (with confirm)
 *
 * The list is capped visually at 15 rows (matches user decision H4);
 * older runs still exist in the DB if the user creates more than 15.
 */
export function OptimizerVersionsList({
  runs,
  activeRunId,
  onSetActive,
  onLoad,
  onRename,
  onDelete,
  onOpenCompare,
}: Props) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  async function handleSetActive(runId: string) {
    if (runId === activeRunId) return;
    setPendingId(runId);
    try { await onSetActive(runId); } finally { setPendingId(null); }
  }

  async function handleLoad(runId: string) {
    if (editingId) return;
    setPendingId(runId);
    try { await onLoad(runId); setOpen(false); } finally { setPendingId(null); }
  }

  async function handleRenameSubmit(runId: string) {
    if (!editName.trim()) { setEditingId(null); return; }
    setPendingId(runId);
    try {
      await onRename(runId, editName.trim());
      setEditingId(null);
      setEditName('');
    } finally {
      setPendingId(null);
    }
  }

  async function handleDelete(runId: string, runName: string) {
    if (!confirm(`Delete run "${runName}"? This cannot be undone.`)) return;
    setPendingId(runId);
    try { await onDelete(runId); } finally { setPendingId(null); }
  }

  const displayRuns = runs.slice(0, 15);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border border-border-soft bg-surf-card text-fg-700 hover:bg-surf-app"
      >
        <History className="h-3.5 w-3.5" />
        Versions ({runs.length})
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-96 bg-surf-card rounded-lg shadow-lg border border-border-soft overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border-soft">
            <span className="text-xs font-semibold text-fg-800 uppercase tracking-wide">Saved Runs</span>
            {runs.length >= 2 && (
              <button
                type="button"
                onClick={() => { setOpen(false); onOpenCompare(); }}
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                <GitCompareArrows className="h-3 w-3" />
                Compare
              </button>
            )}
          </div>

          {displayRuns.length === 0 ? (
            <div className="p-4 text-center text-xs text-fg-400">
              No saved runs yet. Build, run, and save to create the first one.
            </div>
          ) : (
            <ul className="max-h-96 overflow-y-auto">
              {displayRuns.map((run) => {
                const isActive = run.id === activeRunId;
                const isEditing = editingId === run.id;
                const isPending = pendingId === run.id;
                return (
                  <li
                    key={run.id}
                    className={`border-b border-border-soft last:border-b-0 px-3 py-2 ${isActive ? 'bg-blue-50/50' : ''}`}
                  >
                    <div className="flex items-center gap-2">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRenameSubmit(run.id);
                            if (e.key === 'Escape') { setEditingId(null); setEditName(''); }
                          }}
                          onBlur={() => handleRenameSubmit(run.id)}
                          autoFocus
                          className="flex-1 px-1.5 py-0.5 text-xs border border-blue-300 rounded focus:ring-1 focus-visible:ring-focus focus:outline-none"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleLoad(run.id)}
                          className="flex-1 text-left text-xs font-medium text-fg-800 hover:text-blue-600 truncate"
                        >
                          {run.name}
                        </button>
                      )}

                      {run.is_stale && (
                        <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" aria-label="Stale" />
                      )}

                      {isActive && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded">
                          <Check className="h-2.5 w-2.5" /> ACTIVE
                        </span>
                      )}

                      {!isActive && !isEditing && (
                        <button
                          type="button"
                          onClick={() => handleSetActive(run.id)}
                          disabled={isPending}
                          className="text-[10px] text-blue-600 hover:text-blue-800 font-medium disabled:opacity-40"
                        >
                          Set active
                        </button>
                      )}

                      {!isEditing && (
                        <>
                          <button
                            type="button"
                            onClick={() => { setEditingId(run.id); setEditName(run.name); }}
                            disabled={isPending}
                            className="p-0.5 text-fg-400 hover:text-fg-700 disabled:opacity-40"
                            title="Rename"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(run.id, run.name)}
                            disabled={isPending}
                            className="p-0.5 text-fg-400 hover:text-red-600 disabled:opacity-40"
                            title="Delete"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </>
                      )}

                      {isPending && <Loader2 className="h-3 w-3 animate-spin text-fg-400" />}
                    </div>

                    <div className="mt-1 grid grid-cols-4 gap-2 text-[10px] text-fg-500 font-mono tabular-nums">
                      <div>
                        <div className="text-fg-400">Cost</div>
                        <div className="text-fg-700 font-semibold">{formatCurrency(run.total_cost)}</div>
                      </div>
                      <div>
                        <div className="text-fg-400">Waste</div>
                        <div className="text-fg-700 font-semibold">{run.waste_pct.toFixed(1)}%</div>
                      </div>
                      <div>
                        <div className="text-fg-400">Boards</div>
                        <div className="text-fg-700 font-semibold">{run.board_count}</div>
                      </div>
                      <div>
                        <div className="text-fg-400">$/m²</div>
                        <div className="text-fg-700 font-semibold">{formatCurrency(run.cost_per_m2)}</div>
                      </div>
                    </div>
                    <div className="mt-0.5 text-[10px] text-fg-400">
                      {new Date(run.created_at).toLocaleString()}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {runs.length > 15 && (
            <div className="px-3 py-1.5 border-t border-border-soft text-[10px] text-fg-400 bg-surf-app">
              Showing 15 of {runs.length} runs. Delete old ones to see more.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
