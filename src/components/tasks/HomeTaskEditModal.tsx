import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { X, Trash2, ExternalLink, Repeat, Inbox, Sun, CalendarDays, CalendarRange } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../Button';
import type {
  EnhancedTask, TeamMember, TaskStatus, TaskPriority,
} from '../../types';
import {
  TASK_PRIORITY_CONFIG, TASK_STATUS_CONFIG,
} from '../../types';

export type TaskBucket = 'inbox' | 'daily' | 'weekly' | 'monthly';
export type TaskRecurrence = 'none' | 'daily' | 'weekly' | 'monthly';

/** Task with the extra personal/recurrence fields that HomePage tracks. */
export interface HomeTask extends EnhancedTask {
  project_name?: string;
  owner_member_id?: string | null;
  bucket?: TaskBucket | null;
  recurrence?: TaskRecurrence;
}

interface Props {
  task: HomeTask;
  teamMembers: TeamMember[];
  /** Called after a successful save. Receives the updated task. */
  onSaved: (task: HomeTask) => void;
  /** Called after a successful delete. Receives the deleted task id. */
  onDeleted: (id: string) => void;
  onClose: () => void;
}

const BUCKET_OPTIONS: Array<{ value: TaskBucket; label: string; Icon: typeof Inbox }> = [
  { value: 'inbox',   label: 'Inbox',   Icon: Inbox },
  { value: 'daily',   label: 'Daily',   Icon: Sun },
  { value: 'weekly',  label: 'Weekly',  Icon: CalendarDays },
  { value: 'monthly', label: 'Monthly', Icon: CalendarRange },
];

const RECURRENCE_OPTIONS: Array<{ value: TaskRecurrence; label: string }> = [
  { value: 'none',    label: 'None' },
  { value: 'daily',   label: 'Every day' },
  { value: 'weekly',  label: 'Every week' },
  { value: 'monthly', label: 'Every month' },
];

/** Format a Date or ISO string to the value expected by <input type="datetime-local">. */
function toDateTimeLocal(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Lightweight task edit modal used from HomePage. Works for both project tasks
 * (project_id is set) and personal tasks (project_id is null). For personal
 * tasks it also exposes the Bullet Journal bucket and recurrence fields.
 *
 * Intentionally simpler than TaskDetailPanel: no subtasks, comments, or
 * deliverables. Users who want those features navigate to the full project
 * task panel via the "Open in project" link (shown for project tasks only).
 */
export function HomeTaskEditModal({ task, teamMembers, onSaved, onDeleted, onClose }: Props) {
  const isPersonal = !task.project_id;

  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? '');
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [dueDate, setDueDate] = useState(toDateTimeLocal(task.due_date));
  const [assigneeIds, setAssigneeIds] = useState<string[]>(task.assignees.map(a => a.id));
  const [bucket, setBucket] = useState<TaskBucket>((task.bucket ?? 'inbox') as TaskBucket);
  const [recurrence, setRecurrence] = useState<TaskRecurrence>((task.recurrence ?? 'none') as TaskRecurrence);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  async function save() {
    if (!title.trim()) return;
    setSaving(true);

    const update = {
      title: title.trim(),
      description: description.trim() || null,
      status,
      priority,
      due_date: dueDate ? new Date(dueDate).toISOString() : null,
      ...(isPersonal ? { bucket, recurrence } : {}),
      updated_at: new Date().toISOString(),
    };

    const { data: updated, error } = await supabase
      .from('project_tasks')
      .update(update)
      .eq('id', task.id)
      .select()
      .single();

    if (error || !updated) {
      setSaving(false);
      return;
    }

    // Sync assignees: delete all then re-insert
    await supabase.from('task_assignees').delete().eq('task_id', task.id);
    if (assigneeIds.length) {
      await supabase.from('task_assignees').insert(
        assigneeIds.map(mid => ({ task_id: task.id, member_id: mid }))
      );
    }

    const membersById = new Map(teamMembers.map(m => [m.id, m]));
    const nextAssignees = assigneeIds
      .map(id => membersById.get(id))
      .filter((m): m is TeamMember => !!m);

    const nextTask: HomeTask = {
      ...task,
      title: updated.title,
      description: updated.description ?? null,
      status: updated.status as TaskStatus,
      priority: updated.priority as TaskPriority,
      due_date: updated.due_date,
      assignees: nextAssignees,
      bucket: (updated.bucket ?? null) as TaskBucket | null,
      recurrence: (updated.recurrence ?? 'none') as TaskRecurrence,
    };

    setSaving(false);
    onSaved(nextTask);
  }

  async function remove() {
    setDeleting(true);
    // Cascade: delete assignees and tag assignments first (no FK cascade in some schemas)
    await supabase.from('task_assignees').delete().eq('task_id', task.id);
    await supabase.from('task_tag_assignments').delete().eq('task_id', task.id);
    const { error } = await supabase.from('project_tasks').delete().eq('id', task.id);
    setDeleting(false);
    if (!error) onDeleted(task.id);
  }

  function toggleAssignee(id: string) {
    setAssigneeIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  const activeMembers = teamMembers.filter(m => m.is_active);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/70 w-full max-w-lg max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/60 bg-gradient-to-r from-indigo-50/40 to-blue-50/20 sticky top-0 z-10 backdrop-blur-xl">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="text-base font-semibold text-slate-900 truncate">
              {isPersonal ? 'Edit Personal Task' : 'Edit Task'}
            </h3>
            {!isPersonal && task.project_id && (
              <Link
                to={`/projects/${task.project_id}?tab=management&task=${task.id}`}
                onClick={onClose}
                className="ml-1 inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 font-medium"
                title="Open full task view in the project"
              >
                Open in project <ExternalLink className="h-3 w-3" />
              </Link>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Project context (for project tasks) */}
          {!isPersonal && task.project_name && (
            <div className="text-[11px] text-slate-500 -mt-1">
              Project: <span className="font-medium text-slate-700">{task.project_name}</span>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Title *</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Task title…"
              autoFocus
              className="w-full text-sm border border-slate-200/60 rounded-lg px-3 py-2 bg-white/60 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save(); }}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Add details or links…"
              rows={3}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Status + Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Status</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as TaskStatus)}
                className="w-full text-xs border border-slate-200/60 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white/60 backdrop-blur-sm"
              >
                {(Object.entries(TASK_STATUS_CONFIG) as [TaskStatus, typeof TASK_STATUS_CONFIG[TaskStatus]][]).map(([val, cfg]) => (
                  <option key={val} value={val}>{cfg.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Priority</label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value as TaskPriority)}
                className="w-full text-xs border border-slate-200/60 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white/60 backdrop-blur-sm"
              >
                {(Object.entries(TASK_PRIORITY_CONFIG) as [TaskPriority, typeof TASK_PRIORITY_CONFIG[TaskPriority]][]).map(([val, cfg]) => (
                  <option key={val} value={val}>{cfg.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Due date */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Due Date & Time</label>
            <div className="flex gap-2">
              <input
                type="datetime-local"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="flex-1 text-xs border border-slate-200 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {dueDate && (
                <button
                  type="button"
                  onClick={() => setDueDate('')}
                  className="text-xs text-slate-400 hover:text-slate-700 px-2"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Personal-only: bucket + recurrence */}
          {isPersonal && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Bucket</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {BUCKET_OPTIONS.map(({ value, label, Icon }) => {
                    const active = bucket === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setBucket(value)}
                        className={`flex flex-col items-center gap-1 py-2 rounded-lg border text-[11px] font-medium transition-all ${
                          active
                            ? 'bg-gradient-to-br from-indigo-500 to-blue-500 text-white border-transparent shadow-sm'
                            : 'bg-white/60 border-slate-200 text-slate-600 hover:border-blue-200 hover:bg-white/80'
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1">
                  <Repeat className="h-3 w-3" />
                  Recurrence
                </label>
                <select
                  value={recurrence}
                  onChange={e => setRecurrence(e.target.value as TaskRecurrence)}
                  className="w-full text-xs border border-slate-200/60 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white/60 backdrop-blur-sm"
                >
                  {RECURRENCE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                {recurrence !== 'none' && (
                  <p className="text-[10px] text-slate-400 mt-1">
                    When you mark this task done, its due date will roll forward automatically.
                  </p>
                )}
              </div>
            </>
          )}

          {/* Assignees */}
          {activeMembers.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Assignees</label>
              <div className="flex flex-wrap gap-1.5">
                {activeMembers.map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggleAssignee(m.id)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-150 ${
                      assigneeIds.includes(m.id)
                        ? 'bg-gradient-to-r from-indigo-500 to-blue-500 text-white shadow-sm'
                        : 'bg-white/60 backdrop-blur-sm border border-slate-200/60 text-slate-600 hover:border-blue-200 hover:bg-white/80'
                    }`}
                  >
                    {m.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-5 py-4 border-t border-white/60 bg-white/30 backdrop-blur-sm sticky bottom-0">
          <div>
            {!confirmDelete ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-1 text-xs text-rose-500 hover:text-rose-700 font-medium"
                disabled={saving || deleting}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-rose-600 font-medium">Delete this task?</span>
                <button
                  type="button"
                  onClick={remove}
                  disabled={deleting}
                  className="text-[11px] font-semibold text-white bg-rose-500 hover:bg-rose-600 px-2 py-1 rounded-md"
                >
                  {deleting ? 'Deleting…' : 'Confirm'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  disabled={deleting}
                  className="text-[11px] text-slate-500 hover:text-slate-700 px-1"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose} disabled={saving || deleting}>Cancel</Button>
            <Button size="sm" onClick={save} disabled={!title.trim() || saving || deleting}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
