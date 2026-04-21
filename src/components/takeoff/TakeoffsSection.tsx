import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderOpen, Plus, Trash2, Loader2, FileText } from 'lucide-react';
import { Button } from '../Button';
import { listTakeoffSessions, deleteTakeoffSession, type TakeoffSessionListItem } from '../../lib/takeoff/supabase';

// Section rendered inside ProjectPage → "Takeoffs" tab. Lists all takeoff sessions
// linked to this project (via takeoff_sessions.project_id) and lets the user open
// one in Evita Takeoff or start a new one pre-linked to the project.
export function TakeoffsSection({ projectId }: { projectId: string }) {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<TakeoffSessionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listTakeoffSessions({ projectId });
      setSessions(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this takeoff session? The PDF and all measurements/comments will be removed.')) return;
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
    <div className="glass-white rounded-2xl p-5 section-enter">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-fg-800">Takeoffs</h2>
          <p className="text-xs text-fg-500 mt-0.5">PDF measurements + threaded comments linked to this project.</p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => navigate(`/tools/takeoff?project=${projectId}`)}
        >
          <Plus className="h-4 w-4 mr-1" />
          New takeoff
        </Button>
      </div>

      {error && <p className="text-xs text-status-red-fg mb-2">{error}</p>}

      {loading ? (
        <div className="py-8 flex items-center justify-center text-fg-400">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="py-10 text-center">
          <FileText className="h-10 w-10 text-fg-300 mx-auto mb-3" />
          <p className="text-sm text-fg-500">No takeoffs for this project yet.</p>
          <p className="text-xs text-fg-400 mt-1">Start one to measure plans and collaborate with the team.</p>
        </div>
      ) : (
        <div className="divide-y divide-border-soft">
          {sessions.map((s) => (
            <div key={s.id} className="py-3 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <span className="font-medium text-fg-800 truncate block">{s.name}</span>
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
                  onClick={() => navigate(`/tools/takeoff?session=${s.id}`)}
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
