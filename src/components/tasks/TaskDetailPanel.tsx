import { useState, useEffect, useRef } from 'react';
import {
  X, Trash2, Plus,
  CheckSquare, Flag, Clock, Users, Tag, Paperclip, MessageSquare,
} from 'lucide-react';
import { createNotifications } from '../../lib/notifications';
import { useCurrentMember } from '../../lib/useCurrentMember';
import { supabase } from '../../lib/supabase';
import { Button } from '../Button';
import type {
  EnhancedTask, TeamMember, TaskTag, TaskStatus, TaskPriority,
  TaskComment, TaskDeliverable,
} from '../../types';
import { TASK_STATUS_CONFIG, TASK_PRIORITY_CONFIG } from '../../types';
import { TaskComments } from './TaskComments';
import { TaskDeliverables } from './TaskDeliverables';

interface Props {
  task: EnhancedTask;
  teamMembers: TeamMember[];
  tags: TaskTag[];
  projectId: string;
  onClose: () => void;
  onUpdate: (task: EnhancedTask) => void;
  onDelete: (id: string) => void;
  onReload: () => void;
  onTagCreated?: (tag: TaskTag) => void;
}

const STATUS_OPTIONS = Object.entries(TASK_STATUS_CONFIG) as [TaskStatus, typeof TASK_STATUS_CONFIG[TaskStatus]][];
const PRIORITY_OPTIONS = Object.entries(TASK_PRIORITY_CONFIG) as [TaskPriority, typeof TASK_PRIORITY_CONFIG[TaskPriority]][];

const PRESET_COLORS = [
  '#6366f1','#3b82f6','#10b981','#f59e0b','#ef4444',
  '#8b5cf6','#06b6d4','#84cc16','#f97316','#ec4899',
];

export function TaskDetailPanel({ task, teamMembers, tags, projectId, onClose, onUpdate, onDelete, onTagCreated }: Props) {
  const { member: currentMember } = useCurrentMember();
  const initialAssigneeIds = useRef(task.assignees.map((a) => a.id));
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || task.details || '');
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [dueDate, setDueDate] = useState(task.due_date ? task.due_date.slice(0, 16) : '');
  const [assigneeIds, setAssigneeIds] = useState<string[]>(task.assignees.map((a) => a.id));
  const [tagIds, setTagIds] = useState<string[]>(task.tags.map((t) => t.id));
  const [comments, setComments] = useState<TaskComment[]>(task.comments);
  const [deliverables, setDeliverables] = useState<TaskDeliverable[]>(task.deliverables);
  const [subtasks, setSubtasks] = useState<EnhancedTask[]>(task.subtasks);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [showNewTag, setShowNewTag] = useState(false);
  const [newTagLabel, setNewTagLabel] = useState('');
  const [newTagColor, setNewTagColor] = useState('#6366f1');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [allTags, setAllTags] = useState<TaskTag[]>(tags);
  const [freshMembers, setFreshMembers] = useState<TeamMember[]>(teamMembers);

  // Sync state and reload detail data whenever the selected task changes
  useEffect(() => {
    setTitle(task.title);
    setDescription(task.description || task.details || '');
    setStatus(task.status);
    setPriority(task.priority);
    setDueDate(task.due_date ? task.due_date.slice(0, 16) : '');
    setAssigneeIds(task.assignees.map((a) => a.id));
    setTagIds(task.tags.map((t) => t.id));
    setSubtasks(task.subtasks);
    setDirty(false);

    async function init() {
      // Fetch team members fresh to avoid race condition with parent prop
      const { data: membersData } = await supabase
        .from('team_members')
        .select('*')
        .eq('is_active', true)
        .order('display_order');
      const members = membersData || teamMembers;
      setFreshMembers(members);
      await Promise.all([loadComments(members), loadDeliverables(), loadSubtasks()]);
    }
    init();
  }, [task.id]);

  async function loadComments(members?: TeamMember[]) {
    const { data } = await supabase
      .from('task_comments')
      .select('*')
      .eq('task_id', task.id)
      .order('created_at');
    if (!data) return;
    // Load replies for each comment
    const commentIds = data.map((c) => c.id);
    const { data: replies } = await supabase
      .from('task_comment_replies')
      .select('*')
      .in('comment_id', commentIds.length ? commentIds : ['none'])
      .order('created_at');
    const membersMap = new Map((members ?? freshMembers).map((m) => [m.id, m]));
    const enriched: TaskComment[] = data.map((c) => ({
      ...c,
      author_name: (c.author_id ? membersMap.get(c.author_id)?.name : undefined) ?? null,
      replies: (replies || [])
        .filter((r) => r.comment_id === c.id)
        .map((r) => ({ ...r, author_name: (r.author_id ? membersMap.get(r.author_id)?.name : undefined) ?? null })),
    })) as unknown as TaskComment[];
    setComments(enriched);
  }

  async function loadDeliverables() {
    const { data } = await supabase
      .from('task_deliverables')
      .select('*')
      .eq('task_id', task.id)
      .order('display_order');
    setDeliverables(data || []);
  }

  async function loadSubtasks() {
    const { data } = await supabase
      .from('project_tasks')
      .select('*')
      .eq('parent_task_id', task.id)
      .order('display_order');
    if (data) {
      const subs = data.map((s) => ({
        ...s,
        description: (s as any).description ?? null,
        priority: ((s as any).priority ?? 'medium') as TaskPriority,
        parent_task_id: s.parent_task_id ?? null,
        assignees: [],
        tags: [],
        subtasks: [],
        comments: [],
        deliverables: [],
      })) as unknown as EnhancedTask[];
      setSubtasks(subs);
    }
  }

  function markDirty() { setDirty(true); }

  async function save() {
    if (!title.trim()) return;
    setSaving(true);

    // Update task core fields
    await supabase.from('project_tasks').update({
      title: title.trim(),
      description,
      due_date: dueDate || null,
      status,
      priority,
      updated_at: new Date().toISOString(),
    }).eq('id', task.id);

    // Sync assignees
    await supabase.from('task_assignees').delete().eq('task_id', task.id);
    if (assigneeIds.length) {
      await supabase.from('task_assignees').insert(
        assigneeIds.map((mid) => ({ task_id: task.id, member_id: mid }))
      );
    }

    // Sync tags
    await supabase.from('task_tag_assignments').delete().eq('task_id', task.id);
    if (tagIds.length) {
      await supabase.from('task_tag_assignments').insert(
        tagIds.map((tid) => ({ task_id: task.id, tag_id: tid }))
      );
    }

    setSaving(false);
    setDirty(false);

    // Notify newly assigned users
    const newAssignees = assigneeIds.filter((id) => !initialAssigneeIds.current.includes(id));
    if (newAssignees.length) {
      const statusLabel = TASK_STATUS_CONFIG[status]?.label || status;
      const priorityLabel = TASK_PRIORITY_CONFIG[priority]?.label || priority;
      createNotifications({
        recipientIds: newAssignees,
        actorId: currentMember?.id ?? null,
        actorName: currentMember?.name ?? null,
        type: 'task_assigned',
        title: `Assigned to: ${title.trim()}`,
        body: `${statusLabel} · ${priorityLabel}${dueDate ? ` · Due: ${new Date(dueDate).toLocaleDateString()}` : ''}`,
        projectId,
        referenceType: 'project_task',
        referenceId: task.id,
      }).catch(console.error);
    }
    initialAssigneeIds.current = assigneeIds;

    const updatedTask: EnhancedTask = {
      ...task,
      title: title.trim(),
      description,
      due_date: dueDate || null,
      status,
      priority,
      assignees: freshMembers.filter((m) => assigneeIds.includes(m.id)),
      tags: allTags.filter((t) => tagIds.includes(t.id)),
    };
    onUpdate(updatedTask);
  }

  async function addSubtask() {
    if (!newSubtaskTitle.trim()) return;
    const { data } = await supabase.from('project_tasks').insert({
      project_id: projectId,
      title: newSubtaskTitle.trim(),
      parent_task_id: task.id,
      status: 'pending',
      priority: 'medium',
      display_order: subtasks.length,
    }).select().single();
    if (data) {
      const sub = {
        ...data,
        description: null,
        priority: 'medium',
        parent_task_id: task.id,
        assignees: [],
        tags: [],
        subtasks: [],
        comments: [],
        deliverables: [],
      } as unknown as EnhancedTask;
      setSubtasks((prev) => [...prev, sub]);
      setNewSubtaskTitle('');
    }
  }

  async function toggleSubtaskStatus(sub: EnhancedTask) {
    const next: TaskStatus = sub.status === 'done' ? 'pending' : 'done';
    await supabase.from('project_tasks').update({ status: next }).eq('id', sub.id);
    setSubtasks((prev) => prev.map((s) => s.id === sub.id ? { ...s, status: next } : s));
  }

  async function deleteSubtask(id: string) {
    await supabase.from('project_tasks').delete().eq('id', id);
    setSubtasks((prev) => prev.filter((s) => s.id !== id));
  }

  async function createTag() {
    if (!newTagLabel.trim()) return;
    const { data } = await supabase.from('task_tags').insert({
      project_id: projectId,
      label: newTagLabel.trim(),
      color: newTagColor,
    }).select().single();
    if (data) {
      setAllTags((prev) => [...prev, data]);
      setTagIds((prev) => [...prev, data.id]);
      setNewTagLabel('');
      setShowNewTag(false);
      markDirty();
      onTagCreated?.(data);
    }
  }

  function toggleAssignee(id: string) {
    setAssigneeIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
    markDirty();
  }

  function toggleTag(id: string) {
    setTagIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
    markDirty();
  }

  const statusCfg = TASK_STATUS_CONFIG[status];
  const priorityCfg = TASK_PRIORITY_CONFIG[priority];
  const doneSubtasks = subtasks.filter((s) => s.status === 'done').length;

  return (
    <div className="panel-enter w-[400px] flex-shrink-0 glass-white flex flex-col max-h-[calc(100vh-200px)] sticky top-4 overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/60 bg-gradient-to-r from-slate-50/60 to-transparent">
        <span className="text-xs font-semibold text-fg-500 uppercase tracking-wide">Task Detail</span>
        <div className="flex items-center gap-1">
          {dirty && (
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          )}
          <button onClick={onClose} className="text-fg-400 hover:text-fg-600 p-1 rounded">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-5">

          {/* Title */}
          <div>
            <textarea
              value={title}
              onChange={(e) => { setTitle(e.target.value); markDirty(); }}
              className="w-full text-base font-semibold text-fg-900 bg-surf-card backdrop-blur-sm resize-none focus:outline-none focus:ring-2 focus-visible:ring-focus rounded-lg px-2 py-1 -mx-2 -my-1"
              rows={2}
              placeholder="Task title…"
            />
          </div>

          {/* Status + Priority row */}
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="block text-[10px] font-semibold text-fg-400 uppercase tracking-wide mb-1">
                <Flag className="h-3 w-3 inline mr-1" />Status
              </label>
              <select
                value={status}
                onChange={(e) => { setStatus(e.target.value as TaskStatus); markDirty(); }}
                className={`w-full text-xs font-medium px-2 py-1.5 rounded-lg border border-white/60 bg-surf-card backdrop-blur-sm focus:outline-none focus:ring-2 focus-visible:ring-focus ${statusCfg.color}`}
              >
                {STATUS_OPTIONS.map(([val, cfg]) => (
                  <option key={val} value={val}>{cfg.label}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-[10px] font-semibold text-fg-400 uppercase tracking-wide mb-1">
                <Flag className="h-3 w-3 inline mr-1" />Priority
              </label>
              <select
                value={priority}
                onChange={(e) => { setPriority(e.target.value as TaskPriority); markDirty(); }}
                className={`w-full text-xs font-medium px-2 py-1.5 rounded-lg border border-white/60 bg-surf-card backdrop-blur-sm focus:outline-none focus:ring-2 focus-visible:ring-focus ${priorityCfg.color}`}
              >
                {PRIORITY_OPTIONS.map(([val, cfg]) => (
                  <option key={val} value={val}>{cfg.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Due date */}
          <div>
            <label className="block text-[10px] font-semibold text-fg-400 uppercase tracking-wide mb-1">
              <Clock className="h-3 w-3 inline mr-1" />Due Date & Time
            </label>
            <input
              type="datetime-local"
              value={dueDate}
              onChange={(e) => { setDueDate(e.target.value); markDirty(); }}
              className="w-full text-xs border border-border-soft rounded-lg px-2 py-1.5 bg-surf-card backdrop-blur-sm focus:outline-none focus:ring-2 focus-visible:ring-focus"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-[10px] font-semibold text-fg-400 uppercase tracking-wide mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => { setDescription(e.target.value); markDirty(); }}
              rows={3}
              placeholder="Add description or links…"
              className="w-full text-sm border border-border-soft rounded-lg px-3 py-2 resize-none bg-surf-card backdrop-blur-sm focus:outline-none focus:ring-2 focus-visible:ring-focus text-fg-700"
            />
          </div>

          {/* Assignees */}
          <div>
            <label className="block text-[10px] font-semibold text-fg-400 uppercase tracking-wide mb-2">
              <Users className="h-3 w-3 inline mr-1" />Assignees
            </label>
            <div className="flex flex-wrap gap-1.5">
              {teamMembers.filter((m) => m.is_active).map((m) => {
                const active = assigneeIds.includes(m.id);
                return (
                  <button
                    key={m.id}
                    onClick={() => toggleAssignee(m.id)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-150 ${
                      active
                        ? 'bg-accent-primary text-accent-on shadow-sm'
                        : 'bg-surf-card backdrop-blur-sm border border-border-soft text-fg-600 hover:border-blue-200 hover:bg-surf-card'
                    }`}
                  >
                    {m.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-[10px] font-semibold text-fg-400 uppercase tracking-wide mb-2">
              <Tag className="h-3 w-3 inline mr-1" />Tags
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {allTags.map((tag) => {
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
              <button
                onClick={() => setShowNewTag((v) => !v)}
                className="px-2 py-0.5 rounded text-xs font-medium text-fg-400 border border-dashed border-border-solid hover:border-slate-400 hover:text-fg-600 transition-colors"
              >
                <Plus className="h-3 w-3 inline" /> New tag
              </button>
            </div>
            {showNewTag && (
              <div className="flex items-center gap-2 p-2 bg-surf-card backdrop-blur-sm rounded-lg border border-border-soft">
                <input
                  type="text"
                  value={newTagLabel}
                  onChange={(e) => setNewTagLabel(e.target.value)}
                  placeholder="Tag name"
                  className="flex-1 text-xs border border-border-soft rounded px-2 py-1 focus:outline-none focus:ring-1 focus-visible:ring-focus"
                  onKeyDown={(e) => { if (e.key === 'Enter') createTag(); }}
                />
                <div className="flex gap-1 flex-wrap max-w-[120px]">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setNewTagColor(c)}
                      className={`w-4 h-4 rounded-full transition-transform ${newTagColor === c ? 'scale-125 ring-2 ring-offset-1 ring-slate-400' : ''}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <Button size="sm" onClick={createTag} disabled={!newTagLabel.trim()}>Add</Button>
              </div>
            )}
          </div>

          {/* Subtasks */}
          <div>
            <label className="block text-[10px] font-semibold text-fg-400 uppercase tracking-wide mb-2">
              <CheckSquare className="h-3 w-3 inline mr-1" />Subtasks
              {subtasks.length > 0 && (
                <span className="ml-1 text-fg-400">{doneSubtasks}/{subtasks.length}</span>
              )}
            </label>
            <div className="space-y-1 mb-2">
              {subtasks.map((sub) => (
                <div key={sub.id} className="flex items-center gap-2 py-1 px-2 rounded hover:bg-surf-card group">
                  <button onClick={() => toggleSubtaskStatus(sub)}>
                    <span className={`block w-3.5 h-3.5 rounded-full border-2 transition-colors ${
                      sub.status === 'done' ? 'bg-green-500 border-green-500' : 'border-border-solid'
                    }`} />
                  </button>
                  <span className={`flex-1 text-xs ${sub.status === 'done' ? 'line-through text-fg-400' : 'text-fg-700'}`}>
                    {sub.title}
                  </span>
                  <button
                    onClick={() => deleteSubtask(sub.id)}
                    className="opacity-0 group-hover:opacity-100 text-fg-300 hover:text-red-500 transition-all"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') addSubtask(); }}
                placeholder="Add subtask…"
                className="flex-1 text-xs border border-border-soft rounded-lg px-2 py-1.5 bg-surf-card backdrop-blur-sm focus:outline-none focus:ring-2 focus-visible:ring-focus"
              />
              <button
                onClick={addSubtask}
                disabled={!newSubtaskTitle.trim()}
                className="text-blue-600 hover:text-blue-700 disabled:text-fg-300 transition-colors"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Deliverables */}
          <div>
            <label className="block text-[10px] font-semibold text-fg-400 uppercase tracking-wide mb-2">
              <Paperclip className="h-3 w-3 inline mr-1" />Deliverables
            </label>
            <TaskDeliverables
              taskId={task.id}
              deliverables={deliverables}
              onChange={setDeliverables}
            />
          </div>

          {/* Comments */}
          <div>
            <label className="block text-[10px] font-semibold text-fg-400 uppercase tracking-wide mb-2">
              <MessageSquare className="h-3 w-3 inline mr-1" />Comments
              {comments.length > 0 && <span className="ml-1 text-fg-400">{comments.length}</span>}
            </label>
            <TaskComments
              taskId={task.id}
              projectId={projectId}
              comments={comments}
              teamMembers={teamMembers}
              onChange={setComments}
            />
          </div>

          {/* Danger zone */}
          <div className="pt-2 border-t border-white/60">
            {showDeleteConfirm ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-fg-600">Delete this task?</span>
                <button
                  onClick={() => onDelete(task.id)}
                  className="text-xs font-semibold text-red-600 hover:text-red-700"
                >
                  Yes, delete
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="text-xs text-fg-400 hover:text-fg-600"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-1.5 text-xs text-fg-400 hover:text-red-500 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete task
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
