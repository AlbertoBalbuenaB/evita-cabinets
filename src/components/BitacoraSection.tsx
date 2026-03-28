import { useState, useEffect } from 'react';
import { ScrollText, Trash2, Pencil, X, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button } from './Button';
import { format } from 'date-fns';
import type { ProjectLog } from '../types';

interface Props {
  projectId: string;
}

export function BitacoraSection({ projectId }: Props) {
  const [logs, setLogs] = useState<ProjectLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  useEffect(() => {
    loadLogs();
  }, [projectId]);

  async function loadLogs() {
    try {
      const { data, error } = await supabase
        .from('project_logs')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error('Error loading logs:', error);
    } finally {
      setLoading(false);
    }
  }

  async function addLog() {
    if (!newComment.trim() || saving) return;

    setSaving(true);
    const optimistic: ProjectLog = {
      id: crypto.randomUUID(),
      project_id: projectId,
      comment: newComment,
      created_at: new Date().toISOString(),
    };

    setLogs((prev) => [optimistic, ...prev]);
    setNewComment('');

    try {
      const { error } = await supabase.from('project_logs').insert({
        project_id: projectId,
        comment: optimistic.comment,
      });
      if (error) throw error;
      loadLogs();
    } catch (error) {
      console.error('Error adding log entry:', error);
      setLogs((prev) => prev.filter((l) => l.id !== optimistic.id));
      setNewComment(optimistic.comment);
    } finally {
      setSaving(false);
    }
  }

  function startEdit(log: ProjectLog) {
    setEditingId(log.id);
    setEditText(log.comment);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditText('');
  }

  async function saveEdit(logId: string) {
    if (!editText.trim()) return;

    const prev = [...logs];
    setLogs((l) =>
      l.map((x) => (x.id === logId ? { ...x, comment: editText } : x))
    );
    setEditingId(null);
    setEditText('');

    try {
      const { error } = await supabase
        .from('project_logs')
        .update({ comment: editText })
        .eq('id', logId);
      if (error) throw error;
    } catch (error) {
      console.error('Error updating log entry:', error);
      setLogs(prev);
    }
  }

  async function deleteLog(id: string) {
    const prev = [...logs];
    setLogs((l) => l.filter((x) => x.id !== id));

    try {
      const { error } = await supabase.from('project_logs').delete().eq('id', id);
      if (error) throw error;
    } catch (error) {
      console.error('Error deleting log entry:', error);
      setLogs(prev);
    }
  }

  function formatTimestamp(ts: string): string {
    try {
      return format(new Date(ts), "MMM d, yyyy '\u00b7' h:mm a");
    } catch {
      return ts;
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="animate-pulse h-6 bg-slate-100 rounded w-28" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <div className="flex items-center mb-4">
        <ScrollText className="h-5 w-5 text-amber-600 mr-2" />
        <h3 className="text-lg font-semibold text-slate-900">Project Notes</h3>
      </div>

      <div className="mb-4">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Add an observation, change, or note..."
          rows={3}
          className="block w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && newComment.trim()) addLog();
          }}
        />
        <div className="flex justify-end mt-2">
          <Button size="sm" onClick={addLog} disabled={!newComment.trim() || saving}>
            {saving ? 'Saving...' : 'Add Note'}
          </Button>
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="py-8 text-center text-slate-400">
          <ScrollText className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No notes yet</p>
        </div>
      ) : (
        <div className="space-y-3 border-t border-slate-200 pt-4">
          {logs.map((log) =>
            editingId === log.id ? (
              <div key={log.id} className="space-y-2">
                <p className="text-xs text-slate-400">{formatTimestamp(log.created_at)}</p>
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  rows={3}
                  className="block w-full px-3 py-2 text-sm border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  autoFocus
                />
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={() => saveEdit(log.id)} disabled={!editText.trim()}>
                    <Check className="h-3.5 w-3.5 mr-1" />
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={cancelEdit}>
                    <X className="h-3.5 w-3.5 mr-1" />
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div key={log.id} className="group flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-400 mb-0.5">{formatTimestamp(log.created_at)}</p>
                  <p className="text-sm text-slate-700" style={{ whiteSpace: 'pre-wrap' }}>
                    {log.comment}
                  </p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-1">
                  <button
                    onClick={() => startEdit(log)}
                    className="text-slate-400 hover:text-blue-600 p-0.5"
                    title="Edit note"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => deleteLog(log.id)}
                    className="text-slate-400 hover:text-red-500 p-0.5"
                    title="Delete note"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
