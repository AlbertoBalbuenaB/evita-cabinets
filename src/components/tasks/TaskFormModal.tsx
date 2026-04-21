import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { createNotifications } from '../../lib/notifications';
import { Button } from '../Button';
import type { TeamMember, TaskTag, TaskStatus, TaskPriority } from '../../types';
import { TASK_PRIORITY_CONFIG } from '../../types';

interface Props {
  projectId: string;
  teamMembers: TeamMember[];
  tags: TaskTag[];
  displayOrder: number;
  parentTaskId?: string;
  currentMemberId?: string;
  onCreated: () => void;
  onClose: () => void;
}

export function TaskFormModal({
  projectId, teamMembers, tags, displayOrder, parentTaskId, currentMemberId, onCreated, onClose,
}: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status] = useState<TaskStatus>('pending');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueDate, setDueDate] = useState('');
  const [assigneeIds, setAssigneeIds] = useState<string[]>(currentMemberId ? [currentMemberId] : []);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  async function create() {
    if (!title.trim()) return;
    setSaving(true);

    const { data } = await supabase
      .from('project_tasks')
      .insert({
        project_id: projectId,
        title: title.trim(),
        description: description || null,
        due_date: dueDate || null,
        status,
        priority,
        parent_task_id: parentTaskId ?? null,
        display_order: displayOrder,
      })
      .select()
      .single();

    if (data) {
      // Insert assignees
      if (assigneeIds.length) {
        await supabase.from('task_assignees').insert(
          assigneeIds.map((mid) => ({ task_id: data.id, member_id: mid }))
        );
      }
      // Insert tags
      if (tagIds.length) {
        await supabase.from('task_tag_assignments').insert(
          tagIds.map((tid) => ({ task_id: data.id, tag_id: tid }))
        );
      }
    }

    setSaving(false);
    if (data) {
      // Notify assigned users
      if (assigneeIds.length) {
        const priorityLabel = TASK_PRIORITY_CONFIG[priority]?.label || priority;
        createNotifications({
          recipientIds: assigneeIds,
          actorId: currentMemberId ?? null,
          actorName: null,
          type: 'task_assigned',
          title: `Assigned to: ${title.trim()}`,
          body: `Pending · ${priorityLabel}${dueDate ? ` · Due: ${new Date(dueDate).toLocaleDateString()}` : ''}`,
          projectId,
          referenceType: 'project_task',
          referenceId: data.id,
        }).catch(console.error);
      }
      onCreated();
    }
  }

  function toggleAssignee(id: string) {
    setAssigneeIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  function toggleTag(id: string) {
    setTagIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  const activeMembers = teamMembers.filter((m) => m.is_active);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div className="bg-surf-card backdrop-blur-xl rounded-2xl shadow-2xl border border-white/70 w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/60 bg-gradient-to-r from-indigo-50/40 to-blue-50/20">
          <h3 className="text-base font-semibold text-fg-900">New Task</h3>
          <button onClick={onClose} className="text-fg-400 hover:text-fg-600 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-fg-500 mb-1">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title…"
              autoFocus
              className="w-full text-sm border border-border-soft rounded-lg px-3 py-2 bg-surf-card backdrop-blur-sm focus:outline-none focus:ring-2 focus-visible:ring-focus"
              onKeyDown={(e) => { if (e.key === 'Enter' && e.metaKey) create(); }}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-fg-500 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add details or links…"
              rows={2}
              className="w-full text-sm border border-border-soft rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus-visible:ring-focus"
            />
          </div>

          {/* Priority + Due date row */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-fg-500 mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full text-xs border border-border-soft rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus-visible:ring-focus bg-surf-card backdrop-blur-sm"
              >
                {(Object.entries(TASK_PRIORITY_CONFIG) as [TaskPriority, typeof TASK_PRIORITY_CONFIG[TaskPriority]][]).map(([val, cfg]) => (
                  <option key={val} value={val}>{cfg.label}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-fg-500 mb-1">Due Date & Time</label>
              <input
                type="datetime-local"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full text-xs border border-border-soft rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus-visible:ring-focus"
              />
            </div>
          </div>

          {/* Assignees */}
          {activeMembers.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-fg-500 mb-1.5">Assignees</label>
              <div className="flex flex-wrap gap-1.5">
                {activeMembers.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => toggleAssignee(m.id)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-150 ${
                      assigneeIds.includes(m.id)
                        ? 'bg-accent-primary text-accent-on shadow-sm'
                        : 'bg-surf-card backdrop-blur-sm border border-border-soft text-fg-600 hover:border-blue-200 hover:bg-surf-card'
                    }`}
                  >
                    {m.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {tags.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-fg-500 mb-1.5">Tags</label>
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => {
                  const active = tagIds.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      onClick={() => toggleTag(tag.id)}
                      className={`px-2 py-0.5 rounded text-xs font-medium transition-all border ${
                        active ? 'text-white border-transparent' : 'bg-surf-card border-border-soft text-fg-600'
                      }`}
                      style={active ? { backgroundColor: tag.color, borderColor: tag.color } : undefined}
                    >
                      {tag.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-white/60 bg-surf-card backdrop-blur-sm">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={create} disabled={!title.trim() || saving}>
            {saving ? 'Creating…' : 'Create Task'}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
