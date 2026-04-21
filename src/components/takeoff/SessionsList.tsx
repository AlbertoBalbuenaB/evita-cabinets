import { useEffect, useState } from 'react';
import { FolderOpen, Trash2, Loader2 } from 'lucide-react';
import { Modal } from '../Modal';
import { Button } from '../Button';
import { listTakeoffSessions, deleteTakeoffSession, type TakeoffSessionListItem } from '../../lib/takeoff/supabase';

interface SessionsListProps {
  isOpen: boolean;
  onClose: () => void;
  // When provided, list only sessions linked to this project.
  projectId?: string | null;
  onOpen: (sessionId: string) => void;
}

export function SessionsList({ isOpen, onClose, projectId, onOpen }: SessionsListProps) {
  const [sessions, setSessions] = useState<TakeoffSessionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listTakeoffSessions(projectId === undefined ? {} : { projectId });
      setSessions(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, projectId]);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this takeoff session permanently? The PDF and all measurements will be removed.')) return;
    setPendingDelete(id);
    try {
      await deleteTakeoffSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPendingDelete(null);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={projectId ? 'Project takeoffs' : 'My takeoffs'} size="lg">
      <div>
        {error && <p className="text-xs text-status-red-fg mb-2">{error}</p>}

        {loading ? (
          <div className="py-8 flex items-center justify-center text-fg-400">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : sessions.length === 0 ? (
          <p className="py-8 text-sm text-fg-500 text-center">
            {projectId
              ? 'No takeoffs for this project yet. Create one from the Takeoff tool.'
              : 'No saved takeoffs yet. Save the current session from the panel to see it here.'}
          </p>
        ) : (
          <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
            {sessions.map((s) => (
              <div key={s.id} className="py-3 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-fg-800 truncate">{s.name}</span>
                    {s.projectName && (
                      <span className="text-[10px] bg-accent-tint-soft text-accent-text rounded px-1.5 py-0.5 flex-shrink-0">{s.projectName}</span>
                    )}
                    {!s.projectId && (
                      <span className="text-[10px] bg-surf-muted text-fg-500 rounded px-1.5 py-0.5 flex-shrink-0">standalone</span>
                    )}
                  </div>
                  <p className="text-xs text-fg-500 truncate mt-0.5">{s.pdfFilename}</p>
                  <p className="text-[10px] text-fg-400 mt-0.5">
                    Updated {formatRelativeDate(s.updatedAt)}
                    {s.createdByName && ` · by ${s.createdByName}`}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { onOpen(s.id); onClose(); }}
                  >
                    <FolderOpen className="h-3.5 w-3.5 mr-1" />
                    Open
                  </Button>
                  <button
                    onClick={() => handleDelete(s.id)}
                    disabled={pendingDelete === s.id}
                    className="p-1.5 rounded text-fg-400 hover:text-red-500 hover:bg-status-red-bg disabled:opacity-40"
                    title="Delete session"
                  >
                    {pendingDelete === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.round(diffMs / 60_000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}
