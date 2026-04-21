import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X, FileText, RefreshCw, CheckCircle, AlertTriangle, XCircle, Trophy, Radio, FolderKanban,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button } from './Button';
import { AutocompleteSelect } from './AutocompleteSelect';

type LogType = 'note' | 'change' | 'decision' | 'risk' | 'issue' | 'milestone' | 'update';

const LOG_TYPE_OPTIONS: Array<{ value: LogType; label: string; Icon: typeof FileText; color: string; activeBg: string; activeBorder: string }> = [
  { value: 'note',      label: 'Note',      Icon: FileText,       color: 'text-fg-600',  activeBg: 'bg-surf-muted',  activeBorder: 'border-slate-400' },
  { value: 'change',    label: 'Change',    Icon: RefreshCw,      color: 'text-amber-600',  activeBg: 'bg-amber-100',  activeBorder: 'border-amber-400' },
  { value: 'decision',  label: 'Decision',  Icon: CheckCircle,    color: 'text-blue-600',   activeBg: 'bg-blue-100',   activeBorder: 'border-blue-400' },
  { value: 'risk',      label: 'Risk',      Icon: AlertTriangle,  color: 'text-orange-600', activeBg: 'bg-orange-100', activeBorder: 'border-orange-400' },
  { value: 'issue',     label: 'Issue',     Icon: XCircle,        color: 'text-red-600',    activeBg: 'bg-red-100',    activeBorder: 'border-red-400' },
  { value: 'milestone', label: 'Milestone', Icon: Trophy,         color: 'text-green-600',  activeBg: 'bg-green-100',  activeBorder: 'border-green-400' },
  { value: 'update',    label: 'Update',    Icon: Radio,          color: 'text-purple-600', activeBg: 'bg-purple-100', activeBorder: 'border-purple-400' },
];

/** Convert a plain string to the TipTap JSON doc format used by BitacoraSection. */
function plainToTipTapJSON(text: string): string {
  const paragraphs = text.split('\n').map(line => ({
    type: 'paragraph' as const,
    ...(line.trim()
      ? { content: [{ type: 'text' as const, text: line }] }
      : {}),
  }));
  return JSON.stringify({ type: 'doc', content: paragraphs });
}

export interface CreatedLog {
  id: string;
  project_id: string;
  project_name: string;
  log_type: string;
  comment: string;
  author_id: string | null;
  author_name: string | null;
  created_at: string;
}

interface Props {
  projects: Array<{ id: string; name: string }>;
  currentMemberId: string | null;
  currentMemberName: string | null;
  onCreated: (log: CreatedLog) => void;
  onClose: () => void;
}

export function HomeLogCreateModal({
  projects, currentMemberId, currentMemberName, onCreated, onClose,
}: Props) {
  const [projectId, setProjectId] = useState('');
  const [logType, setLogType] = useState<LogType>('note');
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const projectsOptions = projects.map(p => ({ value: p.id, label: p.name }));
  const canSave = !!projectId && !!comment.trim();

  async function create() {
    if (!canSave) return;
    setSaving(true);

    const tiptapContent = plainToTipTapJSON(comment.trim());

    const { data, error } = await supabase
      .from('project_logs')
      .insert({
        project_id: projectId,
        comment: tiptapContent,
        log_type: logType,
        author_id: currentMemberId,
        author_name: currentMemberName,
      })
      .select()
      .single();

    setSaving(false);
    if (error || !data) return;

    const projectName = projects.find(p => p.id === projectId)?.name ?? '';

    onCreated({
      id: data.id,
      project_id: data.project_id ?? '',
      project_name: projectName,
      log_type: data.log_type,
      comment: data.comment,
      author_id: data.author_id ?? null,
      author_name: data.author_name,
      created_at: data.created_at ?? new Date().toISOString(),
    });
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div className="bg-surf-card backdrop-blur-xl rounded-2xl shadow-2xl border border-white/70 w-full max-w-lg max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-rail bg-accent-tint-card sticky top-0 z-10 backdrop-blur-xl">
          <h3 className="text-base font-semibold text-fg-900">New Log Entry</h3>
          <button onClick={onClose} className="text-fg-400 hover:text-fg-600 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Project selector */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-fg-500 mb-1">
              <FolderKanban className="h-3 w-3" />
              Project <span className="text-red-500">*</span>
            </label>
            <AutocompleteSelect
              options={projectsOptions}
              value={projectId}
              onChange={setProjectId}
              placeholder="Search and select a project…"
              required
            />
          </div>

          {/* Log type buttons */}
          <div>
            <label className="block text-xs font-semibold text-fg-500 mb-1.5">Type</label>
            <div className="flex flex-wrap gap-1.5">
              {LOG_TYPE_OPTIONS.map(({ value, label, Icon, color, activeBg, activeBorder }) => {
                const isActive = logType === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setLogType(value)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all border ${
                      isActive
                        ? `${activeBg} ${color} ${activeBorder} shadow-sm`
                        : 'bg-surf-card border-border-soft text-fg-500 hover:border-border-solid hover:bg-surf-card'
                    }`}
                  >
                    <Icon className="h-3 w-3" />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Comment */}
          <div>
            <label className="block text-xs font-semibold text-fg-500 mb-1">
              Comment <span className="text-red-500">*</span>
            </label>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Write your log entry…"
              rows={5}
              autoFocus
              className="w-full text-sm border border-border-soft rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500"
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) create(); }}
            />
            <p className="text-[10px] text-fg-400 mt-1">Tip: Cmd+Enter to save quickly</p>
          </div>

          {/* Author preview */}
          {currentMemberName && (
            <div className="text-[11px] text-fg-400">
              Author: <span className="font-medium text-fg-600">{currentMemberName}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border-rail bg-surf-card backdrop-blur-sm sticky bottom-0">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button size="sm" onClick={create} disabled={!canSave || saving}>
            {saving ? 'Creating…' : 'Add Entry'}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
