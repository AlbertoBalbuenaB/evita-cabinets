import { useState, useEffect } from 'react';
import { CheckSquare, Trash2, Plus, Pencil, X, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button } from './Button';
import type { TeamMember, ProjectTaskWithAssignee } from '../types';
import { format } from 'date-fns';

interface Props {
  projectId: string;
  teamMembers: TeamMember[];
}

type TaskStatus = 'pending' | 'in_progress' | 'done';

const STATUS_CYCLE: Record<string, TaskStatus> = {
  pending: 'in_progress',
  in_progress: 'done',
  done: 'pending',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-slate-200 text-slate-600',
  in_progress: 'bg-amber-100 text-amber-700',
  done: 'bg-green-100 text-green-700',
};

const STATUS_DOT: Record<string, string> = {
  pending: 'bg-slate-400',
  in_progress: 'bg-amber-400',
  done: 'bg-green-500',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  done: 'Done',
};

interface EditState {
  title: string;
  details: string;
  dueDate: string;
  assigneeId: string;
  status: TaskStatus;
}

export function TasksSection({ projectId, teamMembers }: Props) {
  const [tasks, setTasks] = useState<ProjectTaskWithAssignee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDetails, setNewDetails] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newAssigneeId, setNewAssigneeId] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);

  useEffect(() => {
    loadTasks();
  }, [projectId]);

  function resolveAssigneeName(assigneeId: string | null): string | undefined {
    if (!assigneeId) return undefined;
    const member = teamMembers.find((m) => m.id === assigneeId);
    return member?.name;
  }

  async function loadTasks() {
    try {
      const { data, error } = await supabase
        .from('project_tasks')
        .select('*')
        .eq('project_id', projectId)
        .order('display_order');

      if (error) throw error;

      const resolved: ProjectTaskWithAssignee[] = (data || []).map((t) => ({
        ...t,
        assignee_name: resolveAssigneeName(t.assignee_id),
      }));
      setTasks(resolved);
    } catch (error) {
      console.error('Error loading tasks:', error);
    } finally {
      setLoading(false);
    }
  }

  async function toggleStatus(task: ProjectTaskWithAssignee) {
    const nextStatus = STATUS_CYCLE[task.status] || 'pending';
    const prev = [...tasks];
    setTasks((t) =>
      t.map((x) => (x.id === task.id ? { ...x, status: nextStatus } : x))
    );

    try {
      const { error } = await supabase
        .from('project_tasks')
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq('id', task.id);
      if (error) throw error;
    } catch (error) {
      console.error('Error updating task status:', error);
      setTasks(prev);
    }
  }

  function startEdit(task: ProjectTaskWithAssignee) {
    setEditingId(task.id);
    setEditState({
      title: task.title,
      details: task.details || '',
      dueDate: task.due_date || '',
      assigneeId: task.assignee_id || '',
      status: task.status as TaskStatus,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditState(null);
  }

  async function saveEdit(taskId: string) {
    if (!editState || !editState.title.trim()) return;

    const prev = [...tasks];
    setTasks((t) =>
      t.map((x) =>
        x.id === taskId
          ? {
              ...x,
              title: editState.title,
              details: editState.details || null,
              due_date: editState.dueDate || null,
              assignee_id: editState.assigneeId || null,
              assignee_name: resolveAssigneeName(editState.assigneeId || null),
              status: editState.status,
            }
          : x
      )
    );
    setEditingId(null);
    setEditState(null);

    try {
      const { error } = await supabase
        .from('project_tasks')
        .update({
          title: editState.title,
          details: editState.details || null,
          due_date: editState.dueDate || null,
          assignee_id: editState.assigneeId || null,
          status: editState.status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', taskId);
      if (error) throw error;
    } catch (error) {
      console.error('Error updating task:', error);
      setTasks(prev);
    }
  }

  async function addTask() {
    if (!newTitle.trim()) return;

    const optimistic: ProjectTaskWithAssignee = {
      id: crypto.randomUUID(),
      project_id: projectId,
      title: newTitle,
      details: newDetails || null,
      due_date: newDueDate || null,
      assignee_id: newAssigneeId || null,
      assignee_name: resolveAssigneeName(newAssigneeId || null),
      status: 'pending',
      display_order: tasks.length,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setTasks((prev) => [...prev, optimistic]);
    setNewTitle('');
    setNewDetails('');
    setNewDueDate('');
    setNewAssigneeId('');
    setShowAddForm(false);

    try {
      const { error } = await supabase.from('project_tasks').insert({
        project_id: projectId,
        title: optimistic.title,
        details: optimistic.details,
        due_date: optimistic.due_date,
        assignee_id: optimistic.assignee_id,
        display_order: optimistic.display_order,
      });
      if (error) throw error;
      loadTasks();
    } catch (error) {
      console.error('Error adding task:', error);
      setTasks((prev) => prev.filter((t) => t.id !== optimistic.id));
    }
  }

  async function deleteTask(id: string) {
    const prev = [...tasks];
    setTasks((t) => t.filter((x) => x.id !== id));

    try {
      const { error } = await supabase.from('project_tasks').delete().eq('id', id);
      if (error) throw error;
    } catch (error) {
      console.error('Error deleting task:', error);
      setTasks(prev);
    }
  }

  function formatDueDate(date: string | null): string {
    if (!date) return '';
    try {
      return `Due: ${format(new Date(date + 'T00:00:00'), 'MMM d, yyyy')}`;
    } catch {
      return '';
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="animate-pulse h-6 bg-slate-100 rounded w-24" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <CheckSquare className="h-5 w-5 text-green-600 mr-2" />
          <h3 className="text-lg font-semibold text-slate-900">Tasks</h3>
        </div>
        {!showAddForm && (
          <Button size="sm" variant="ghost" onClick={() => setShowAddForm(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Add Task
          </Button>
        )}
      </div>

      {tasks.length === 0 && !showAddForm ? (
        <div className="py-8 text-center text-slate-400">
          <CheckSquare className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No tasks yet</p>
        </div>
      ) : (
        <div className="space-y-2 mb-4">
          {tasks.map((task) =>
            editingId === task.id && editState ? (
              <div key={task.id} className="p-3 bg-slate-50 rounded-lg border border-blue-200 space-y-3">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Title *</label>
                  <input
                    type="text"
                    value={editState.title}
                    onChange={(e) => setEditState({ ...editState, title: e.target.value })}
                    className="block w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Details</label>
                  <textarea
                    value={editState.details}
                    onChange={(e) => setEditState({ ...editState, details: e.target.value })}
                    rows={2}
                    className="block w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>
                <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                  <div className="w-full sm:w-auto">
                    <label className="block text-xs text-slate-600 mb-1">Due Date</label>
                    <input
                      type="date"
                      value={editState.dueDate}
                      onChange={(e) => setEditState({ ...editState, dueDate: e.target.value })}
                      className="block w-full sm:w-auto px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-slate-600 mb-1">Assignee</label>
                    <select
                      value={editState.assigneeId}
                      onChange={(e) => setEditState({ ...editState, assigneeId: e.target.value })}
                      className="block w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="">Unassigned</option>
                      {teamMembers.map((m) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="w-full sm:w-auto">
                    <label className="block text-xs text-slate-600 mb-1">Status</label>
                    <select
                      value={editState.status}
                      onChange={(e) => setEditState({ ...editState, status: e.target.value as TaskStatus })}
                      className="block w-full sm:w-auto px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="pending">Pending</option>
                      <option value="in_progress">In Progress</option>
                      <option value="done">Done</option>
                    </select>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={() => saveEdit(task.id)} disabled={!editState.title.trim()}>
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
              <div
                key={task.id}
                className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg group"
              >
                <button
                  onClick={() => toggleStatus(task)}
                  className="mt-0.5 flex-shrink-0"
                  title={`Click to advance: ${STATUS_LABELS[task.status]}`}
                >
                  <span className={`block w-3.5 h-3.5 rounded-full ${STATUS_DOT[task.status]} transition-colors`} />
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${task.status === 'done' ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                    {task.title}
                  </p>
                  {task.details && (
                    <p className="text-sm text-slate-500 mt-0.5 line-clamp-2">{task.details}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer select-none ${STATUS_COLORS[task.status]}`}
                      onClick={() => toggleStatus(task)}
                      title="Click to change status"
                    >
                      {STATUS_LABELS[task.status]}
                    </span>
                    {task.due_date && (
                      <span className="text-xs text-slate-400">{formatDueDate(task.due_date)}</span>
                    )}
                    {task.assignee_name && (
                      <span className="text-xs text-slate-500 font-medium">{task.assignee_name}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <button
                    onClick={() => startEdit(task)}
                    className="text-slate-400 hover:text-blue-600 p-0.5"
                    title="Edit task"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => deleteTask(task.id)}
                    className="text-slate-400 hover:text-red-500 p-0.5"
                    title="Delete task"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      )}

      {showAddForm && (
        <div className="pt-3 border-t border-slate-200 space-y-3">
          <div>
            <label className="block text-xs text-slate-600 mb-1">Title *</label>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Task title"
              className="block w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyDown={(e) => { if (e.key === 'Enter' && newTitle.trim()) addTask(); }}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Details</label>
            <textarea
              value={newDetails}
              onChange={(e) => setNewDetails(e.target.value)}
              placeholder="Additional details (optional)"
              rows={2}
              className="block w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="w-full sm:w-auto">
              <label className="block text-xs text-slate-600 mb-1">Due Date</label>
              <input
                type="date"
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
                className="block w-full sm:w-auto px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-slate-600 mb-1">Assignee</label>
              <select
                value={newAssigneeId}
                onChange={(e) => setNewAssigneeId(e.target.value)}
                className="block w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">Unassigned</option>
                {teamMembers.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Button size="sm" onClick={addTask} disabled={!newTitle.trim()}>
              Save
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowAddForm(false);
                setNewTitle('');
                setNewDetails('');
                setNewDueDate('');
                setNewAssigneeId('');
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
