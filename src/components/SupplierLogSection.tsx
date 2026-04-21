import { useEffect, useState } from 'react';
import {
  FileText, AlertTriangle, Eye, MapPin, DollarSign,
  Plus, Pencil as Edit2, Trash2, X, Check
} from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import { useCurrentMember } from '../lib/useCurrentMember';
import type { SupplierLog } from '../types';

// ── Log type definitions ────────────────────────────────────────────────────

type SupplierLogType = 'note' | 'incident' | 'observation' | 'visit' | 'commercial';

interface LogTypeConfig {
  label: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Icon: any;
  color: string;
  bg: string;
  border: string;
  badgeBg: string;
  badgeText: string;
}

const LOG_TYPES: Record<SupplierLogType, LogTypeConfig> = {
  note:        { label: 'Note',        Icon: FileText,      color: 'text-fg-600',  bg: 'bg-surf-app',   border: 'border-l-slate-300',  badgeBg: 'bg-surf-muted',  badgeText: 'text-fg-700'  },
  incident:    { label: 'Incident',    Icon: AlertTriangle, color: 'text-status-red-fg',    bg: 'bg-status-red-bg',     border: 'border-l-red-400',    badgeBg: 'bg-status-red-bg',    badgeText: 'text-status-red-fg'    },
  observation: { label: 'Observation', Icon: Eye,           color: 'text-accent-text',   bg: 'bg-accent-tint-soft',    border: 'border-l-blue-400',   badgeBg: 'bg-accent-tint-soft',   badgeText: 'text-accent-text'   },
  visit:       { label: 'Visit',       Icon: MapPin,        color: 'text-status-emerald-fg',  bg: 'bg-status-emerald-bg',   border: 'border-l-green-400',  badgeBg: 'bg-status-emerald-bg',  badgeText: 'text-status-emerald-fg'  },
  commercial:  { label: 'Commercial',  Icon: DollarSign,    color: 'text-status-amber-fg',  bg: 'bg-status-amber-bg',   border: 'border-l-amber-400',  badgeBg: 'bg-status-amber-bg',  badgeText: 'text-status-amber-fg'  },
};

const LOG_TYPE_ORDER: SupplierLogType[] = ['note', 'incident', 'observation', 'visit', 'commercial'];

// ── Props ────────────────────────────────────────────────────────────────────

interface SupplierLogSectionProps {
  supplierId: string;
}

// ── Component ────────────────────────────────────────────────────────────────

export function SupplierLogSection({ supplierId }: SupplierLogSectionProps) {
  const { member } = useCurrentMember();
  const isAdmin = member?.role === 'admin';

  const [logs, setLogs] = useState<SupplierLog[]>([]);
  const [loading, setLoading] = useState(true);

  // New log form
  const [newType, setNewType] = useState<SupplierLogType>('note');
  const [newComment, setNewComment] = useState('');
  const [saving, setSaving] = useState(false);

  // Editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editType, setEditType] = useState<SupplierLogType>('note');
  const [editComment, setEditComment] = useState('');

  // Delete confirm
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadLogs();
  }, [supplierId]);

  async function loadLogs() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('supplier_logs')
        .select('*')
        .eq('supplier_id', supplierId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setLogs(data ?? []);
    } catch (err) {
      console.error('Error loading supplier logs:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd() {
    if (!newComment.trim() || saving) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('supplier_logs').insert({
        supplier_id: supplierId,
        log_type: newType,
        comment: newComment.trim(),
        author_id: member?.auth_user_id ?? null,
        author_name: member?.name ?? null,
      });
      if (error) throw error;
      setNewComment('');
      setNewType('note');
      loadLogs();
    } catch (err) {
      console.error('Error adding supplier log:', err);
    } finally {
      setSaving(false);
    }
  }

  function startEdit(log: SupplierLog) {
    setEditingId(log.id);
    setEditType((log.log_type as SupplierLogType) ?? 'note');
    setEditComment(log.comment);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditComment('');
  }

  async function handleSaveEdit(logId: string) {
    if (!editComment.trim()) return;
    const prev = [...logs];
    setLogs((l) =>
      l.map((x) =>
        x.id === logId
          ? { ...x, comment: editComment.trim(), log_type: editType, updated_at: new Date().toISOString() }
          : x
      )
    );
    setEditingId(null);
    try {
      const { error } = await supabase
        .from('supplier_logs')
        .update({ comment: editComment.trim(), log_type: editType, updated_at: new Date().toISOString() })
        .eq('id', logId);
      if (error) throw error;
    } catch (err) {
      console.error('Error updating supplier log:', err);
      setLogs(prev);
    }
  }

  async function handleDelete(logId: string) {
    const prev = [...logs];
    setLogs((l) => l.filter((x) => x.id !== logId));
    setDeletingId(null);
    try {
      const { error } = await supabase.from('supplier_logs').delete().eq('id', logId);
      if (error) throw error;
    } catch (err) {
      console.error('Error deleting supplier log:', err);
      setLogs(prev);
    }
  }

  const canEditLog = (log: SupplierLog) =>
    isAdmin || (member?.auth_user_id != null && log.author_id === member.auth_user_id);

  return (
    <div className="space-y-4">
      {/* Add new entry */}
      <div className="bg-surf-card border border-border-soft rounded-xl p-4 shadow-sm">
        <p className="text-xs font-semibold text-fg-500 uppercase tracking-wide mb-3">New Entry</p>

        {/* Type selector */}
        <div className="flex flex-wrap gap-2 mb-3">
          {LOG_TYPE_ORDER.map((t) => {
            const cfg = LOG_TYPES[t];
            const active = newType === t;
            return (
              <button
                key={t}
                onClick={() => setNewType(t)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  active
                    ? `${cfg.badgeBg} ${cfg.badgeText} ring-1 ring-inset ring-current/20`
                    : 'bg-surf-muted text-fg-500 hover:bg-surf-muted'
                }`}
              >
                <cfg.Icon className="h-3 w-3" />
                {cfg.label}
              </button>
            );
          })}
        </div>

        {/* Textarea */}
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Write your entry here..."
          rows={3}
          className="block w-full px-3 py-2 border border-border-solid rounded-lg text-sm focus:outline-none focus:ring-2 focus-visible:ring-focus focus:border-blue-500 resize-none placeholder:text-fg-400"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleAdd();
          }}
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-fg-400">Ctrl+Enter to submit</span>
          <button
            onClick={handleAdd}
            disabled={!newComment.trim() || saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            {saving ? 'Adding...' : 'Add Entry'}
          </button>
        </div>
      </div>

      {/* Log entries */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 skeleton-shimmer rounded-xl" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 bg-surf-app border border-border-soft rounded-xl text-center">
          <FileText className="h-10 w-10 text-fg-400 mb-3" />
          <p className="text-sm font-medium text-fg-400">No activity entries yet</p>
          <p className="text-xs text-fg-300 mt-1">Add notes, incidents, observations, or visits above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => {
            const logType = (log.log_type as SupplierLogType) || 'note';
            const cfg = LOG_TYPES[logType] ?? LOG_TYPES.note;
            const { Icon } = cfg;
            const isEditing = editingId === log.id;
            const isDeleting = deletingId === log.id;
            const canEdit = canEditLog(log);

            return (
              <div
                key={log.id}
                className={`${cfg.bg} border border-border-soft border-l-4 ${cfg.border} rounded-xl p-4 transition-shadow hover:shadow-sm`}
              >
                {isEditing ? (
                  /* Edit mode */
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {LOG_TYPE_ORDER.map((t) => {
                        const tc = LOG_TYPES[t];
                        const active = editType === t;
                        return (
                          <button
                            key={t}
                            onClick={() => setEditType(t)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                              active
                                ? `${tc.badgeBg} ${tc.badgeText}`
                                : 'bg-surf-card text-fg-400 hover:bg-surf-card'
                            }`}
                          >
                            <tc.Icon className="h-3 w-3" />
                            {tc.label}
                          </button>
                        );
                      })}
                    </div>
                    <textarea
                      value={editComment}
                      onChange={(e) => setEditComment(e.target.value)}
                      rows={3}
                      autoFocus
                      className="block w-full px-3 py-2 border border-border-solid rounded-lg text-sm focus:outline-none focus:ring-2 focus-visible:ring-focus resize-none bg-surf-card"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSaveEdit(log.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                      >
                        <Check className="h-3 w-3" />
                        Save
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-fg-500 bg-surf-card hover:bg-surf-app border border-border-soft rounded-lg transition-colors"
                      >
                        <X className="h-3 w-3" />
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  /* View mode */
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.badgeBg} ${cfg.badgeText}`}>
                          <Icon className="h-3 w-3" />
                          {cfg.label}
                        </span>
                      </div>
                      {canEdit && (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {isDeleting ? (
                            <>
                              <span className="text-xs text-fg-500 mr-1">Delete?</span>
                              <button
                                onClick={() => handleDelete(log.id)}
                                className="p-1 rounded text-status-red-fg hover:bg-status-red-bg transition-colors"
                                title="Confirm delete"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => setDeletingId(null)}
                                className="p-1 rounded text-fg-400 hover:bg-surf-muted transition-colors"
                                title="Cancel"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => startEdit(log)}
                                className="p-1.5 rounded-lg text-fg-400 hover:text-accent-text hover:bg-accent-tint-soft transition-colors"
                                title="Edit"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => setDeletingId(log.id)}
                                className="p-1.5 rounded-lg text-fg-400 hover:text-status-red-fg hover:bg-status-red-bg transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    <p className="mt-2 text-sm text-fg-700 whitespace-pre-wrap leading-relaxed">{log.comment}</p>

                    <div className="mt-3 flex items-center gap-3 text-xs text-fg-400">
                      {log.author_name && (
                        <>
                          <span className="font-medium text-fg-500">{log.author_name}</span>
                          <span>·</span>
                        </>
                      )}
                      <span>{log.created_at ? format(new Date(log.created_at), 'd MMM yyyy · h:mm a') : '—'}</span>
                      {log.updated_at && <span className="italic">(edited)</span>}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
