import { useState, useEffect } from 'react';
import { CheckSquare, List, LayoutGrid, Calendar, Plus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useCurrentMember } from '../../lib/useCurrentMember';
import type {
  TeamMember, EnhancedTask, TaskTag,
  TaskStatus, TaskPriority, TaskView,
} from '../../types';
import {
  TASK_STATUS_ORDER as STATUS_ORDER,
  TASK_PRIORITY_ORDER as PRIORITY_ORDER,
} from '../../types';
import { TaskFilters } from './TaskFilters';
import { TaskListView } from './TaskListView';
import { TaskKanbanView } from './TaskKanbanView';
import { TaskCalendarView } from './TaskCalendarView';
import { TaskDetailPanel } from './TaskDetailPanel';
import { TaskFormModal } from './TaskFormModal';

interface Props {
  projectId: string;
  teamMembers: TeamMember[];
  /** Optional deep-link task id — opens the task detail panel when provided. */
  initialTaskId?: string | null;
}

export interface TaskFilterState {
  assigneeId: string;
  status: TaskStatus | '';
  priority: TaskPriority | '';
  tagId: string;
}

export function TasksSection({ projectId, teamMembers, initialTaskId }: Props) {
  const { member: currentMember } = useCurrentMember();
  const [tasks, setTasks] = useState<EnhancedTask[]>([]);
  const [tags, setTags] = useState<TaskTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<TaskView>('list');
  const [filters, setFilters] = useState<TaskFilterState>({ assigneeId: '', status: '', priority: '', tagId: '' });
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    loadAll();
  }, [projectId]);

  // Open the deep-linked task once tasks have loaded and the id matches a loaded task
  useEffect(() => {
    if (!initialTaskId) return;
    if (tasks.some(t => t.id === initialTaskId)) {
      setSelectedTaskId(initialTaskId);
    }
  }, [initialTaskId, tasks]);

  async function loadAll() {
    setLoading(true);
    await Promise.all([loadTasks(), loadTags()]);
    setLoading(false);
  }

  async function loadTags() {
    const { data } = await supabase
      .from('task_tags')
      .select('*')
      .eq('project_id', projectId)
      .order('label');
    setTags(data || []);
  }

  async function loadTasks() {
    const { data: rawTasks } = await supabase
      .from('project_tasks')
      .select('*')
      .eq('project_id', projectId)
      .is('parent_task_id', null)
      .order('display_order');

    if (!rawTasks) return;

    const taskIds = rawTasks.map((t) => t.id);

    // Load subtasks, assignees, tag assignments, team members, and tags in parallel
    // NOTE: team_members is fetched here directly to avoid race condition with the
    // parent prop (teamMembers prop may be empty when this runs on first render).
    const [subtasksRes, assigneesRes, tagAssignRes, membersRes, allTagsRes] = await Promise.all([
      supabase.from('project_tasks').select('*').in('parent_task_id', taskIds.length ? taskIds : ['none']).order('display_order'),
      supabase.from('task_assignees').select('task_id, member_id').in('task_id', taskIds.length ? taskIds : ['none']),
      supabase.from('task_tag_assignments').select('task_id, tag_id').in('task_id', taskIds.length ? taskIds : ['none']),
      supabase.from('team_members').select('*').eq('is_active', true).order('display_order'),
      supabase.from('task_tags').select('*').eq('project_id', projectId),
    ]);

    const subtasks = subtasksRes.data || [];
    const assigneeRows = assigneesRes.data || [];
    const tagRows = tagAssignRes.data || [];

    const allTags = allTagsRes.data || [];
    const tagsMap = new Map(allTags.map((t) => [t.id, t]));
    // Use freshly fetched members so assignees always resolve regardless of prop timing
    const freshMembers = membersRes.data || [];
    const membersMap = new Map(freshMembers.map((m) => [m.id, m]));

    function buildEnhanced(raw: NonNullable<typeof rawTasks>[0], subs: typeof subtasks): EnhancedTask {
      const taskAssignees = assigneeRows
        .filter((r) => r.task_id === raw.id)
        .map((r) => membersMap.get(r.member_id))
        .filter(Boolean) as TeamMember[];

      const taskTags = tagRows
        .filter((r) => r.task_id === raw.id)
        .map((r) => tagsMap.get(r.tag_id))
        .filter(Boolean) as TaskTag[];

      const taskSubtasks = subs
        .filter((s) => s.parent_task_id === raw.id)
        .map((s) => buildEnhanced(s, []));

      return {
        ...raw,
        description: (raw as any).description ?? null,
        priority: ((raw as any).priority ?? 'medium') as TaskPriority,
        parent_task_id: (raw as any).parent_task_id ?? null,
        assignees: taskAssignees,
        tags: taskTags,
        subtasks: taskSubtasks,
        comments: [],
        deliverables: [],
      } as EnhancedTask;
    }

    const enhanced = rawTasks.map((t) => buildEnhanced(t, subtasks));
    setTasks(enhanced);
  }

  function sortTasks(list: EnhancedTask[]): EnhancedTask[] {
    return [...list].sort((a, b) => {
      const statusDiff = (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99);
      if (statusDiff !== 0) return statusDiff;
      return (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99);
    });
  }

  function applyFilters(list: EnhancedTask[]): EnhancedTask[] {
    return list.filter((t) => {
      if (filters.assigneeId && !t.assignees.some((a) => a.id === filters.assigneeId)) return false;
      if (filters.status && t.status !== filters.status) return false;
      if (filters.priority && t.priority !== filters.priority) return false;
      if (filters.tagId && !t.tags.some((tag) => tag.id === filters.tagId)) return false;
      return true;
    });
  }

  const visibleTasks = sortTasks(applyFilters(tasks));
  const selectedTask = selectedTaskId ? tasks.find((t) => t.id === selectedTaskId) ?? null : null;

  async function handleStatusChange(taskId: string, status: TaskStatus) {
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status } : t));
    await supabase.from('project_tasks').update({ status, updated_at: new Date().toISOString() }).eq('id', taskId);
  }

  function handleTaskUpdate(updated: EnhancedTask) {
    // Only update local state — the panel's save() already persisted to the DB.
    setTasks((prev) => prev.map((t) => t.id === updated.id ? updated : t));
  }

  async function handleTaskDelete(taskId: string) {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    setSelectedTaskId(null);
    await supabase.from('project_tasks').delete().eq('id', taskId);
  }

  async function handleTaskCreated() {
    await loadTasks();
    setShowAddModal(false);
  }

  function handleTaskSelect(taskId: string) {
    setSelectedTaskId(taskId === selectedTaskId ? null : taskId);
  }

  if (loading) {
    return (
      <div className="glass-white p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-6 bg-surf-card rounded w-24" />
          <div className="h-4 bg-surf-card rounded w-full" />
          <div className="h-4 bg-surf-card rounded w-3/4" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-4 items-start">
      {/* Main panel */}
      <div className={`glass-white flex-1 min-w-0 overflow-hidden transition-all ${selectedTask ? 'lg:max-w-[calc(100%-420px)]' : ''}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-rail bg-accent-tint-card">
          <div className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5 text-accent-text" />
            <h3 className="text-lg font-semibold text-fg-900">Tasks</h3>
            {tasks.length > 0 && (
              <span className="text-xs font-medium bg-accent-tint-soft text-accent-text border border-accent-tint-border px-2 py-0.5 rounded-full">
                {tasks.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* View switcher */}
            <div className="flex items-center bg-surf-card backdrop-blur-sm border border-border-soft rounded-lg p-0.5 gap-0.5">
              <button
                onClick={() => setView('list')}
                title="List view"
                className={`p-1.5 rounded-md transition-all ${view === 'list' ? 'bg-surf-card shadow-md text-blue-600' : 'text-fg-400 hover:text-fg-600'}`}
              >
                <List className="h-4 w-4" />
              </button>
              <button
                onClick={() => setView('kanban')}
                title="Board view"
                className={`p-1.5 rounded-md transition-all ${view === 'kanban' ? 'bg-surf-card shadow-md text-blue-600' : 'text-fg-400 hover:text-fg-600'}`}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setView('calendar')}
                title="Calendar view"
                className={`p-1.5 rounded-md transition-all ${view === 'calendar' ? 'bg-surf-card shadow-md text-blue-600' : 'text-fg-400 hover:text-fg-600'}`}
              >
                <Calendar className="h-4 w-4" />
              </button>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="btn-primary-glass flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
            >
              <Plus className="h-4 w-4" />
              Add Task
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="px-5 py-3 border-b border-border-rail bg-surf-card">
          <TaskFilters
            filters={filters}
            onFiltersChange={setFilters}
            teamMembers={teamMembers}
            tags={tags}
          />
        </div>

        {/* View content */}
        <div className="p-5">
          {tasks.length === 0 ? (
            <div className="py-12 text-center text-fg-400">
              <CheckSquare className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">No tasks yet</p>
              <p className="text-xs mt-1">Click "Add Task" to get started</p>
            </div>
          ) : view === 'list' ? (
            <TaskListView
              tasks={visibleTasks}
              selectedTaskId={selectedTaskId}
              onSelect={handleTaskSelect}
              onStatusChange={handleStatusChange}
            />
          ) : view === 'kanban' ? (
            <TaskKanbanView
              tasks={visibleTasks}
              selectedTaskId={selectedTaskId}
              onSelect={handleTaskSelect}
              onStatusChange={handleStatusChange}
            />
          ) : (
            <TaskCalendarView
              tasks={visibleTasks}
              onSelect={handleTaskSelect}
            />
          )}
        </div>
      </div>

      {/* Detail panel (slides in) */}
      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          teamMembers={teamMembers}
          tags={tags}
          projectId={projectId}
          onClose={() => setSelectedTaskId(null)}
          onUpdate={handleTaskUpdate}
          onDelete={handleTaskDelete}
          onReload={loadTasks}
          onTagCreated={(tag) => setTags((prev) => [...prev, tag])}
        />
      )}

      {/* Create task modal */}
      {showAddModal && (
        <TaskFormModal
          projectId={projectId}
          teamMembers={teamMembers}
          tags={tags}
          displayOrder={tasks.length}
          currentMemberId={currentMember?.id}
          onCreated={handleTaskCreated}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}
