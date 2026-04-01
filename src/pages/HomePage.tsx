import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  CheckSquare, Clock, ChevronDown, ChevronRight,
  ScrollText, ArrowRightCircle, CheckCircle2, Lightbulb, AlertTriangle, Star,
  Activity, ExternalLink, Filter, X,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import type { EnhancedTask, TaskStatus, TaskPriority, TeamMember } from '../types';
import { TASK_STATUS_CONFIG, TASK_PRIORITY_CONFIG } from '../types';
import { TaskCard } from '../components/tasks/TaskCard';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CrossProjectTask extends EnhancedTask {
  project_name: string;
}

interface CrossProjectLog {
  id: string;
  project_id: string;
  project_name: string;
  log_type: string;
  comment: string;
  author_name: string | null;
  created_at: string;
}

type TaskFilterState = {
  priority: TaskPriority | '';
  assigneeId: string;
  projectId: string;
};

// ── Log type config (mirrors BitacoraSection) ─────────────────────────────────

type LogType = 'note' | 'change_request' | 'approved_change' | 'decision' | 'error' | 'achievement';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const LOG_TYPES: Record<LogType, { label: string; Icon: any; color: string; bg: string; border: string; badgeBg: string }> = {
  note:            { label: 'Note',            Icon: ScrollText,       color: 'text-slate-600',   bg: 'bg-slate-50',   border: 'border-l-slate-300',  badgeBg: 'bg-slate-100'  },
  change_request:  { label: 'Change Request',  Icon: ArrowRightCircle, color: 'text-blue-600',    bg: 'bg-blue-50',    border: 'border-l-blue-400',   badgeBg: 'bg-blue-100'   },
  approved_change: { label: 'Approved Change', Icon: CheckCircle2,     color: 'text-green-600',   bg: 'bg-green-50',   border: 'border-l-green-400',  badgeBg: 'bg-green-100'  },
  decision:        { label: 'Decision',        Icon: Lightbulb,        color: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-l-amber-400',  badgeBg: 'bg-amber-100'  },
  error:           { label: 'Error',           Icon: AlertTriangle,    color: 'text-red-600',     bg: 'bg-red-50',     border: 'border-l-red-400',    badgeBg: 'bg-red-100'    },
  achievement:     { label: 'Achievement',     Icon: Star,             color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-l-emerald-400',badgeBg: 'bg-emerald-100' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getLogText(comment: string): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const doc = JSON.parse(comment) as any;
    if (!doc || doc.type !== 'doc') return comment;
    const texts: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function walk(node: any) {
      if (node.type === 'text' && node.text) texts.push(node.text);
      if (node.content) node.content.forEach(walk);
    }
    walk(doc);
    return texts.join(' ').trim();
  } catch {
    return comment;
  }
}

// ── Sub-component: task subsection (Working on it / To-do) ───────────────────

interface TaskSubsectionProps {
  title: string;
  dotColor: string;
  tasks: CrossProjectTask[];
  emptyText: string;
  onNavigate: (task: CrossProjectTask) => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
}

function TaskSubsection({ title, dotColor, tasks, emptyText, onNavigate, onStatusChange }: TaskSubsectionProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="px-5 py-4">
      <button
        onClick={() => setCollapsed(prev => !prev)}
        className="flex items-center gap-2 w-full text-left mb-3 group"
      >
        {collapsed
          ? <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
          : <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
        }
        <span className={`w-2 h-2 rounded-full ${dotColor}`} />
        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{title}</span>
        <span className="text-xs text-slate-400 font-medium">{tasks.length}</span>
      </button>

      {!collapsed && (
        tasks.length === 0 ? (
          <p className="text-sm text-slate-400 pl-5 py-1">{emptyText}</p>
        ) : (
          <div className="space-y-2 pl-5">
            {tasks.map(task => (
              <div key={task.id}>
                <TaskCard
                  task={task}
                  onSelect={() => onNavigate(task)}
                  onStatusChange={onStatusChange}
                />
                <Link
                  to={`/projects/${task.project_id}`}
                  onClick={e => e.stopPropagation()}
                  className="text-[10px] text-slate-400 hover:text-blue-500 transition-colors mt-0.5 pl-3 block"
                >
                  {task.project_name}
                </Link>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function HomePage() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<CrossProjectTask[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [logs, setLogs] = useState<CrossProjectLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [taskFilters, setTaskFilters] = useState<TaskFilterState>({ priority: '', assigneeId: '', projectId: '' });
  const [doneExpanded, setDoneExpanded] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    await Promise.all([loadTasks(), loadLogs()]);
    setLoading(false);
  }

  async function loadTasks() {
    const { data: rawTasks } = await supabase
      .from('project_tasks')
      .select('*')
      .is('parent_task_id', null)
      .order('display_order');

    if (!rawTasks || rawTasks.length === 0) {
      setTasks([]);
      return;
    }

    const taskIds = rawTasks.map(t => t.id);
    const projectIds = [...new Set(rawTasks.map(t => t.project_id))];

    const [assigneesRes, membersRes, projectsRes, subtasksRes] = await Promise.all([
      supabase.from('task_assignees').select('task_id, member_id').in('task_id', taskIds),
      supabase.from('team_members').select('*'),
      supabase.from('projects').select('id, name').in('id', projectIds),
      supabase.from('project_tasks').select('*').in('parent_task_id', taskIds).order('display_order'),
    ]);

    const membersMap = new Map((membersRes.data || []).map(m => [m.id, m]));
    const projectsMap = new Map((projectsRes.data || []).map(p => [p.id, p.name as string]));
    const assigneeRows = assigneesRes.data || [];
    const subtasksRaw = subtasksRes.data || [];

    setTeamMembers(membersRes.data || []);

    const enhanced: CrossProjectTask[] = rawTasks.map(raw => {
      const taskAssignees = assigneeRows
        .filter(r => r.task_id === raw.id)
        .map(r => membersMap.get(r.member_id))
        .filter(Boolean) as TeamMember[];

      const taskSubtasks = subtasksRaw
        .filter(s => s.parent_task_id === raw.id)
        .map(s => ({
          ...s,
          description: (s as Record<string, unknown>).description as string ?? null,
          priority: ((s as Record<string, unknown>).priority as TaskPriority) ?? 'medium',
          parent_task_id: s.parent_task_id ?? null,
          assignees: [],
          tags: [],
          subtasks: [],
          comments: [],
          deliverables: [],
          project_name: projectsMap.get(s.project_id) ?? '',
        }));

      return {
        ...raw,
        description: (raw as Record<string, unknown>).description as string ?? null,
        priority: ((raw as Record<string, unknown>).priority as TaskPriority) ?? 'medium',
        parent_task_id: null,
        assignees: taskAssignees,
        tags: [],
        subtasks: taskSubtasks,
        comments: [],
        deliverables: [],
        project_name: projectsMap.get(raw.project_id) ?? '',
      };
    });

    setTasks(enhanced);
  }

  async function loadLogs() {
    const { data: logsData } = await supabase
      .from('project_logs')
      .select('id, project_id, log_type, comment, author_name, created_at')
      .order('created_at', { ascending: false });

    if (!logsData || logsData.length === 0) {
      setLogs([]);
      return;
    }

    const projectIds = [...new Set(logsData.map(l => l.project_id))];
    const { data: projectsData } = await supabase
      .from('projects')
      .select('id, name')
      .in('id', projectIds);

    const projectsMap = new Map((projectsData || []).map(p => [p.id, p.name as string]));

    setLogs(logsData.map(l => ({
      ...l,
      project_name: projectsMap.get(l.project_id) ?? 'Unknown Project',
    })));
  }

  async function handleStatusChange(taskId: string, status: TaskStatus) {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status } : t));
    await supabase.from('project_tasks').update({ status, updated_at: new Date().toISOString() }).eq('id', taskId);
  }

  // ── Derived data ──────────────────────────────────────────────────────────

  function applyTaskFilters(list: CrossProjectTask[]): CrossProjectTask[] {
    return list.filter(t => {
      if (taskFilters.priority && t.priority !== taskFilters.priority) return false;
      if (taskFilters.assigneeId && !t.assignees.some(a => a.id === taskFilters.assigneeId)) return false;
      if (taskFilters.projectId && t.project_id !== taskFilters.projectId) return false;
      return true;
    });
  }

  const workingOnIt = applyTaskFilters(tasks.filter(t => t.status === 'in_progress'));
  const toDo = applyTaskFilters(tasks.filter(t => t.status === 'pending'));
  const doneTasks = tasks.filter(t => t.status === 'done' || t.status === 'cancelled');
  const filteredDone = applyTaskFilters(doneTasks);

  // All unique projects across all tasks (for the project filter dropdown)
  const allProjects = [
    ...new Map(tasks.map(t => [t.project_id, { id: t.project_id, name: t.project_name }])).values(),
  ];

  function hasActiveTaskFilters() {
    return taskFilters.priority || taskFilters.assigneeId || taskFilters.projectId;
  }

  // Group logs by project, preserving order (most recent log drives project order)
  const logsByProject = new Map<string, CrossProjectLog[]>();
  for (const log of logs) {
    if (!logsByProject.has(log.project_id)) logsByProject.set(log.project_id, []);
    logsByProject.get(log.project_id)!.push(log);
  }
  const logProjectOrder = [...logsByProject.keys()];

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-4">
        {[0, 1, 2].map(i => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 p-6 animate-pulse">
            <div className="h-5 bg-slate-100 rounded w-32 mb-4" />
            <div className="space-y-2">
              <div className="h-4 bg-slate-100 rounded w-full" />
              <div className="h-4 bg-slate-100 rounded w-3/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Tasks ─────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
          <CheckSquare className="h-5 w-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-slate-900">Tasks</h2>
          {tasks.length > 0 && (
            <span className="text-xs font-medium bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
              {tasks.length}
            </span>
          )}
        </div>

        {/* Global task filters */}
        {tasks.length > 0 && (
          <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2 flex-wrap">
            <Filter className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />

            <select
              value={taskFilters.priority}
              onChange={e => setTaskFilters(prev => ({ ...prev, priority: e.target.value as TaskPriority | '' }))}
              className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All priorities</option>
              {(Object.entries(TASK_PRIORITY_CONFIG) as [TaskPriority, typeof TASK_PRIORITY_CONFIG[TaskPriority]][]).map(([val, cfg]) => (
                <option key={val} value={val}>{cfg.label}</option>
              ))}
            </select>

            <select
              value={taskFilters.assigneeId}
              onChange={e => setTaskFilters(prev => ({ ...prev, assigneeId: e.target.value }))}
              className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All assignees</option>
              {teamMembers.filter(m => m.is_active).map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>

            {allProjects.length > 1 && (
              <select
                value={taskFilters.projectId}
                onChange={e => setTaskFilters(prev => ({ ...prev, projectId: e.target.value }))}
                className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All projects</option>
                {allProjects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            )}

            {hasActiveTaskFilters() && (
              <button
                onClick={() => setTaskFilters({ priority: '', assigneeId: '', projectId: '' })}
                className="flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-slate-700 transition-colors"
              >
                <X className="h-3 w-3" />
                Clear
              </button>
            )}
          </div>
        )}

        {tasks.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <CheckSquare className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">No tasks across any project yet</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {/* Working on it */}
            <TaskSubsection
              title="Working on it"
              dotColor="bg-blue-500"
              tasks={workingOnIt}
              emptyText="No tasks in progress"
              onNavigate={task => navigate(`/projects/${task.project_id}`)}
              onStatusChange={handleStatusChange}
            />

            {/* To-do */}
            <TaskSubsection
              title="To-do"
              dotColor="bg-slate-400"
              tasks={toDo}
              emptyText="No pending tasks"
              onNavigate={task => navigate(`/projects/${task.project_id}`)}
              onStatusChange={handleStatusChange}
            />

            {/* Done */}
            <div className="px-5 py-4">
              <button
                onClick={() => setDoneExpanded(prev => !prev)}
                className="flex items-center gap-2 w-full text-left mb-3"
              >
                {doneExpanded
                  ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                  : <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                }
                <span className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Done</span>
                <span className="text-xs font-medium bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                  {hasActiveTaskFilters()
                    ? `${filteredDone.length} / ${doneTasks.length}`
                    : doneTasks.length}
                </span>
              </button>

              {doneExpanded && (
                <div className="pl-5">
                  {filteredDone.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-4">No completed tasks match the current filters.</p>
                  ) : (
                    <div className="space-y-2">
                      {filteredDone.map(task => (
                        <div key={task.id}>
                          <TaskCard
                            task={task}
                            onSelect={() => navigate(`/projects/${task.project_id}`)}
                            onStatusChange={handleStatusChange}
                          />
                          <Link
                            to={`/projects/${task.project_id}`}
                            onClick={e => e.stopPropagation()}
                            className="text-[10px] text-slate-400 hover:text-blue-500 transition-colors mt-0.5 pl-3 block"
                          >
                            {task.project_name}
                          </Link>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Feed ──────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
          <Activity className="h-5 w-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-slate-900">Feed</h2>
          {logs.length > 0 && (
            <span className="text-xs font-medium bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
              {logs.length}
            </span>
          )}
        </div>

        {logs.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <Activity className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">No log entries yet</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {logProjectOrder.map(projectId => {
              const projectLogs = logsByProject.get(projectId)!;
              const projectName = projectLogs[0].project_name;

              return (
                <div key={projectId} className="px-5 py-4">
                  {/* Project header */}
                  <Link
                    to={`/projects/${projectId}`}
                    className="inline-flex items-center gap-1.5 mb-3 text-sm font-semibold text-slate-700 hover:text-blue-600 transition-colors group"
                  >
                    {projectName}
                    <ExternalLink className="h-3.5 w-3.5 text-slate-400 group-hover:text-blue-500" />
                  </Link>

                  {/* Log entries */}
                  <div className="space-y-2 pl-1">
                    {projectLogs.map(log => {
                      const logTypeCfg = LOG_TYPES[(log.log_type as LogType)] ?? LOG_TYPES.note;
                      const { Icon } = logTypeCfg;
                      const text = getLogText(log.comment);

                      return (
                        <div
                          key={log.id}
                          className={`flex gap-3 p-3 rounded-lg border-l-4 ${logTypeCfg.bg} ${logTypeCfg.border}`}
                        >
                          <div className={`flex-shrink-0 mt-0.5 ${logTypeCfg.color}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${logTypeCfg.badgeBg} ${logTypeCfg.color}`}>
                                {logTypeCfg.label}
                              </span>
                              {log.author_name && (
                                <span className="text-[10px] text-slate-500 font-medium">{log.author_name}</span>
                              )}
                              <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                                <Clock className="h-2.5 w-2.5" />
                                {format(new Date(log.created_at), 'MMM d, yyyy HH:mm')}
                              </span>
                            </div>
                            {text && (
                              <p className="text-xs text-slate-600 line-clamp-3">{text}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
