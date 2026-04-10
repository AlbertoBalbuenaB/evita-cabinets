import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  CheckSquare, Clock, ChevronDown, ChevronRight, CheckCircle2,
  ScrollText, ArrowRightCircle, Lightbulb, AlertTriangle, Star,
  Activity, ExternalLink, Filter, X, TrendingUp, FolderOpen, ArrowRight,
  Users, Ban, GitMerge, Search, Inbox, Sun, CalendarDays, CalendarRange, Plus, Repeat,
  FolderKanban, NotebookPen,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { NewProjectModal } from '../components/NewProjectModal';
import type { EnhancedTask, TaskStatus, TaskPriority, TeamMember } from '../types';
import { TASK_PRIORITY_CONFIG } from '../types';
import type { Database } from '../lib/database.types';
import { TaskCard } from '../components/tasks/TaskCard';
import { HomeTaskFormModal, type HomeTask, type TaskBucket, type TaskRecurrence } from '../components/tasks/HomeTaskFormModal';
import { HomeLogCreateModal, type CreatedLog } from '../components/HomeLogCreateModal';
import { HomeLogDetailModal } from '../components/HomeLogDetailModal';
import { formatCurrency } from '../lib/calculations';
import { useSettingsStore } from '../lib/settingsStore';
import { useCurrentMember } from '../lib/useCurrentMember';

// ── Types ─────────────────────────────────────────────────────────────────────

type ProjectTaskRow = Database['public']['Tables']['project_tasks']['Row'];
type ProjectLogRow  = Database['public']['Tables']['project_logs']['Row'];

interface CrossProjectTask extends EnhancedTask {
  project_name: string;
  owner_member_id: string | null;
  bucket: TaskBucket | null;
  recurrence: TaskRecurrence;
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

interface RecentQuote {
  id: string;
  project_id: string;
  name: string;
  quote_date: string;
  total_amount: number;
  status: string;
  project_type: string;
  updated_at: string;
}

type TaskFilterState = {
  priority: TaskPriority | '';
  assigneeId: string;
  projectId: string;
};

// ── Subsection variant config ─────────────────────────────────────────────────

type SubsectionVariant = 'blue' | 'amber' | 'green' | 'red' | 'rose' | 'purple';

const VARIANT = {
  blue: {
    bg: 'bg-blue-50/50',    border: 'border-blue-100/80',    dot: 'bg-blue-500',
    label: 'text-blue-800', badge: 'bg-blue-100 text-blue-700', emptyDot: 'text-blue-300',
  },
  amber: {
    bg: 'bg-amber-50/50',    border: 'border-amber-100/80',    dot: 'bg-amber-500',
    label: 'text-amber-800', badge: 'bg-amber-100 text-amber-700', emptyDot: 'text-amber-300',
  },
  green: {
    bg: 'bg-emerald-50/50',    border: 'border-emerald-100/80',    dot: 'bg-emerald-500',
    label: 'text-emerald-800', badge: 'bg-emerald-100 text-emerald-700', emptyDot: 'text-emerald-300',
  },
  red: {
    bg: 'bg-red-50/60',    border: 'border-red-200/80',    dot: 'bg-red-500',
    label: 'text-red-800', badge: 'bg-red-100 text-red-700', emptyDot: 'text-red-300',
  },
  rose: {
    bg: 'bg-rose-50/50',    border: 'border-rose-200/70',    dot: 'bg-rose-500',
    label: 'text-rose-800', badge: 'bg-rose-100 text-rose-700', emptyDot: 'text-rose-300',
  },
  purple: {
    bg: 'bg-purple-50/50',    border: 'border-purple-100/80',    dot: 'bg-purple-500',
    label: 'text-purple-800', badge: 'bg-purple-100 text-purple-700', emptyDot: 'text-purple-300',
  },
} satisfies Record<SubsectionVariant, object>;

// ── Log type config (aligned with BitacoraSection + real DB data) ─────────────

type LogType = 'note' | 'change' | 'decision' | 'risk' | 'issue' | 'milestone' | 'update';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const LOG_TYPES: Record<LogType, { label: string; Icon: any; color: string; bg: string; border: string; badgeBg: string }> = {
  note:      { label: 'Note',      Icon: ScrollText,       color: 'text-slate-500',   bg: 'bg-slate-50/70',    border: 'border-l-slate-300',   badgeBg: 'bg-slate-100'   },
  change:    { label: 'Change',    Icon: ArrowRightCircle, color: 'text-amber-600',   bg: 'bg-amber-50/70',    border: 'border-l-amber-400',   badgeBg: 'bg-amber-100'   },
  decision:  { label: 'Decision',  Icon: CheckCircle2,     color: 'text-blue-600',    bg: 'bg-blue-50/70',     border: 'border-l-blue-400',    badgeBg: 'bg-blue-100'    },
  risk:      { label: 'Risk',      Icon: AlertTriangle,    color: 'text-orange-600',  bg: 'bg-orange-50/70',   border: 'border-l-orange-400',  badgeBg: 'bg-orange-100'  },
  issue:     { label: 'Issue',     Icon: Lightbulb,        color: 'text-red-600',     bg: 'bg-red-50/70',      border: 'border-l-red-400',     badgeBg: 'bg-red-100'     },
  milestone: { label: 'Milestone', Icon: Star,             color: 'text-green-600',   bg: 'bg-green-50/70',    border: 'border-l-green-400',   badgeBg: 'bg-green-100'   },
  update:    { label: 'Update',    Icon: Activity,         color: 'text-purple-600',  bg: 'bg-purple-50/70',   border: 'border-l-purple-400',  badgeBg: 'bg-purple-100'  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
}

const AVATAR_COLORS = [
  'bg-violet-100 text-violet-700', 'bg-blue-100 text-blue-700',
  'bg-amber-100 text-amber-700',   'bg-emerald-100 text-emerald-700',
  'bg-rose-100 text-rose-700',     'bg-cyan-100 text-cyan-700',
];

const PIPELINE_ORDER = ['Pending', 'Estimating', 'Sent', 'Awarded', 'Lost'];
const PIPELINE_COLORS: Record<string, string> = {
  Pending:    'bg-blue-50   text-blue-700   border-blue-200',
  Estimating: 'bg-orange-50 text-orange-700 border-orange-200',
  Sent:       'bg-cyan-50   text-cyan-700   border-cyan-200',
  Awarded:    'bg-green-50  text-green-700  border-green-200',
  Lost:       'bg-red-50    text-red-600    border-red-200',
};

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

// ── Sub-component: task subsection ───────────────────────────────────────────

interface TaskSubsectionProps {
  variant: SubsectionVariant;
  title: string;
  tasks: CrossProjectTask[];
  totalCount?: number; // if different from tasks.length (filtered vs all)
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  emptyMessage?: string;
  onNavigate: (task: CrossProjectTask) => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
}

function TaskSubsection({
  variant, title, tasks, totalCount, collapsible = false, defaultCollapsed = false,
  emptyMessage = 'No tasks here',
  onNavigate, onStatusChange,
}: TaskSubsectionProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const v = VARIANT[variant];
  const displayCount = totalCount !== undefined
    ? (tasks.length !== totalCount ? `${tasks.length} / ${totalCount}` : totalCount)
    : tasks.length;

  return (
    <div className={`rounded-xl border ${v.bg} ${v.border} overflow-hidden`}>
      {/* Subsection header */}
      <button
        onClick={() => (collapsible || tasks.length > 0) && setCollapsed(p => !p)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-white/30 transition-colors"
        disabled={!collapsible && tasks.length === 0}
      >
        {collapsible ? (
          collapsed
            ? <ChevronRight className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
            : <ChevronDown className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
        ) : (
          tasks.length > 0
            ? (collapsed
              ? <ChevronRight className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
              : <ChevronDown className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />)
            : <span className="w-3.5 h-3.5 flex-shrink-0" />
        )}
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${v.dot}`} />
        <span className={`text-xs font-semibold uppercase tracking-wide flex-1 ${v.label}`}>{title}</span>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${v.badge}`}>
          {displayCount}
        </span>
      </button>

      {/* Tasks list */}
      {!collapsed && (
        tasks.length === 0 ? (
          <div className="px-4 pb-3 pt-1 text-center">
            <p className={`text-xs font-medium ${v.emptyDot} opacity-70`}>{emptyMessage}</p>
          </div>
        ) : (
          <div className="px-3 pb-3 space-y-1.5">
            {tasks.map(task => (
              <div key={task.id} className="group">
                <TaskCard
                  task={task}
                  onSelect={() => onNavigate(task)}
                  onStatusChange={onStatusChange}
                  compact
                />
                <Link
                  to={`/projects/${task.project_id}`}
                  onClick={e => e.stopPropagation()}
                  className="block text-[10px] text-slate-400 hover:text-blue-500 transition-colors pl-3 mt-0.5 truncate"
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

// ── Sub-component: personal bucket section (Bullet Journal) ───────────────────

interface PersonalBucketSectionProps {
  bucket: TaskBucket;
  label: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Icon: any;
  variant: SubsectionVariant;
  tasks: CrossProjectTask[];
  onNavigate: (task: CrossProjectTask) => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
}

function PersonalBucketSection({
  label, Icon, variant, tasks, onNavigate, onStatusChange,
}: PersonalBucketSectionProps) {
  const v = VARIANT[variant];
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={`rounded-xl border ${v.bg} ${v.border} overflow-hidden`}>
      <button
        onClick={() => setCollapsed(p => !p)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-white/30 transition-colors"
      >
        {collapsed
          ? <ChevronRight className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
          : <ChevronDown className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />}
        <Icon className={`h-3.5 w-3.5 ${v.label} flex-shrink-0`} />
        <span className={`text-xs font-semibold uppercase tracking-wide flex-1 ${v.label}`}>{label}</span>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${v.badge}`}>
          {tasks.length}
        </span>
      </button>

      {!collapsed && (
        tasks.length === 0 ? (
          <div className="px-4 pb-3 pt-1 text-center">
            <p className={`text-xs font-medium ${v.emptyDot} opacity-70`}>Nothing here — add one above</p>
          </div>
        ) : (
          <div className="px-3 pb-3 space-y-1.5">
            {tasks.map(task => {
              const isOverdue = task.due_date && new Date(task.due_date).getTime() < Date.now() && task.status !== 'done' && task.status !== 'cancelled';
              return (
                <div key={task.id} className="group">
                  <TaskCard
                    task={task}
                    onSelect={() => onNavigate(task)}
                    onStatusChange={onStatusChange}
                    compact
                  />
                  {(task.recurrence && task.recurrence !== 'none') || isOverdue ? (
                    <div className="flex items-center gap-2 pl-3 mt-0.5 text-[10px]">
                      {task.recurrence && task.recurrence !== 'none' && (
                        <span className="flex items-center gap-0.5 text-slate-500">
                          <Repeat className="h-2.5 w-2.5" />
                          {task.recurrence}
                        </span>
                      )}
                      {isOverdue && (
                        <span className="text-rose-600 font-medium">Overdue</span>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const QUOTE_STATUS_COLORS: Record<string, string> = {
  'Awarded':    'bg-green-100 text-green-700 border-green-200',
  'Pending':    'bg-blue-100 text-blue-700 border-blue-200',
  'Estimating': 'bg-orange-100 text-orange-700 border-orange-200',
  'Sent':       'bg-cyan-100 text-cyan-700 border-cyan-200',
  'Lost':       'bg-red-100 text-red-700 border-red-200',
  'Discarded':  'bg-slate-100 text-slate-600 border-slate-200',
  'Cancelled':  'bg-gray-100 text-gray-600 border-gray-200',
};

function getGreeting(name: string): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return `Good morning, ${name}`;
  if (hour >= 12 && hour < 18) return `Good afternoon, ${name}`;
  return `Good evening, ${name}`;
}

export function HomePage() {
  const navigate = useNavigate();
  const { member } = useCurrentMember();
  const exchangeRate = useSettingsStore(s => s.settings.exchangeRateUsdToMxn);
  const fetchSettings = useSettingsStore(s => s.fetchSettings);
  const [myTasksOnly, setMyTasksOnly] = useState(() => localStorage.getItem('homepage_tasks_filter') !== 'all');
  const [tasks, setTasks] = useState<CrossProjectTask[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [logs, setLogs] = useState<CrossProjectLog[]>([]);
  const [recentQuotes, setRecentQuotes] = useState<RecentQuote[]>([]);
  const [pipeline, setPipeline] = useState<Record<string, number>>({});
  const [projectsList, setProjectsList] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [taskFilters, setTaskFilters] = useState<TaskFilterState>({ priority: '', assigneeId: '', projectId: '' });
  const [taskTab, setTaskTab] = useState<'projects' | 'planner'>(() => {
    const stored = localStorage.getItem('homepage_task_tab');
    // Backwards-compat: the tab used to be called 'personal'
    return stored === 'planner' || stored === 'personal' ? 'planner' : 'projects';
  });
  const [editingTask, setEditingTask] = useState<CrossProjectTask | null>(null);
  const [creatingTask, setCreatingTask] = useState<
    { kind: 'project' | 'planner'; projectId?: string | null; bucket?: TaskBucket } | null
  >(null);
  const [personalQuickAdd, setPersonalQuickAdd] = useState('');
  const [personalQuickBucket, setPersonalQuickBucket] = useState<TaskBucket>('inbox');
  const [creatingPersonal, setCreatingPersonal] = useState(false);
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [showNewLogModal, setShowNewLogModal] = useState(false);
  const [viewingLog, setViewingLog] = useState<CrossProjectLog | null>(null);
  const [feedSearch, setFeedSearch] = useState('');
  const [feedDropdownOpen, setFeedDropdownOpen] = useState(false);
  const feedSearchRef = useRef<HTMLDivElement>(null);

  function switchTaskTab(next: 'projects' | 'planner') {
    setTaskTab(next);
    localStorage.setItem('homepage_task_tab', next);
  }

  useEffect(() => {
    let cancelled = false;
    fetchSettings();
    (async () => {
      setLoading(true);
      await Promise.all([loadTasks(), loadLogs(), loadQuotesData(), loadProjectsList()]);
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
    // load functions only close over stable setState setters; fetchSettings is stable from zustand
  }, [fetchSettings]);

  async function loadQuotesData() {
    const [recentRes, pipelineRes] = await Promise.all([
      supabase
        .from('quotations')
        .select('id, project_id, name, quote_date, total_amount, status, project_type, updated_at')
        .order('updated_at', { ascending: false })
        .limit(5),
      supabase.from('quotations').select('status'),
    ]);
    setRecentQuotes((recentRes.data ?? []) as RecentQuote[]);
    const counts: Record<string, number> = {};
    (pipelineRes.data ?? []).forEach(q => {
      const status = q.status ?? 'unknown';
      counts[status] = (counts[status] || 0) + 1;
    });
    setPipeline(counts);
  }

  async function loadProjectsList() {
    const { data } = await supabase
      .from('projects')
      .select('id, name')
      .order('name', { ascending: true });
    setProjectsList((data ?? []) as Array<{ id: string; name: string }>);
  }

  async function loadTasks() {
    const { data: rawTasks } = await supabase
      .from('project_tasks')
      .select('*')
      .is('parent_task_id', null)
      .order('display_order');

    if (!rawTasks || rawTasks.length === 0) { setTasks([]); return; }

    const taskIds = rawTasks.map(t => t.id);
    const projectIds = [...new Set(rawTasks.map(t => t.project_id).filter((id): id is string => !!id))];

    const [assigneesRes, membersRes, projectsRes, subtasksRes] = await Promise.all([
      supabase.from('task_assignees').select('task_id, member_id').in('task_id', taskIds),
      supabase.from('team_members').select('*'),
      supabase.from('projects').select('id, name').in('id', projectIds),
      supabase.from('project_tasks').select('*').in('parent_task_id', taskIds).order('display_order'),
    ]);

    const members = membersRes.data ?? [];
    const membersMap = new Map<string, TeamMember>(members.map(m => [m.id, m as TeamMember]));
    const projectsMap = new Map<string, string>(
      (projectsRes.data ?? []).map(p => [p.id, p.name as string])
    );
    const assigneeRows = assigneesRes.data ?? [];
    const subtasksRaw: ProjectTaskRow[] = subtasksRes.data ?? [];

    setTeamMembers(members as TeamMember[]);

    // Pre-group assignees by task_id — O(n) instead of O(n·m)
    const assigneesByTaskId = new Map<string, TeamMember[]>();
    for (const row of assigneeRows) {
      const member = membersMap.get(row.member_id);
      if (!member) continue;
      const list = assigneesByTaskId.get(row.task_id) ?? [];
      list.push(member);
      assigneesByTaskId.set(row.task_id, list);
    }

    // Pre-group subtasks by parent_task_id — O(n) instead of O(n·m)
    const subtasksByParentId = new Map<string, ProjectTaskRow[]>();
    for (const st of subtasksRaw) {
      if (!st.parent_task_id) continue;
      const list = subtasksByParentId.get(st.parent_task_id) ?? [];
      list.push(st);
      subtasksByParentId.set(st.parent_task_id, list);
    }

    const enhanced: CrossProjectTask[] = (rawTasks as ProjectTaskRow[]).map((raw): CrossProjectTask => {
      const taskAssignees = assigneesByTaskId.get(raw.id) ?? [];

      const taskSubtasks: EnhancedTask[] = (subtasksByParentId.get(raw.id) ?? []).map(s => ({
        ...s,
        description: s.description ?? null,
        priority: (s.priority ?? 'medium') as TaskPriority,
        parent_task_id: s.parent_task_id ?? null,
        assignees: [],
        tags: [],
        subtasks: [],
        comments: [],
        deliverables: [],
      } as EnhancedTask));

      return {
        ...raw,
        description: raw.description ?? null,
        priority: (raw.priority ?? 'medium') as TaskPriority,
        parent_task_id: null,
        assignees: taskAssignees,
        tags: [],
        subtasks: taskSubtasks,
        comments: [],
        deliverables: [],
        project_name: projectsMap.get(raw.project_id ?? '') ?? '',
        owner_member_id: raw.owner_member_id ?? null,
        bucket: (raw.bucket ?? null) as TaskBucket | null,
        recurrence: (raw.recurrence ?? 'none') as TaskRecurrence,
      } as CrossProjectTask;
    });

    setTasks(enhanced);
  }

  async function loadLogs() {
    const { data: logsData } = await supabase
      .from('project_logs')
      .select('id, project_id, log_type, comment, author_name, created_at')
      .order('created_at', { ascending: false })
      .limit(100);

    if (!logsData || logsData.length === 0) { setLogs([]); return; }

    type LogRow = Pick<ProjectLogRow, 'id' | 'project_id' | 'log_type' | 'comment' | 'author_name' | 'created_at'>;
    const rows = logsData as LogRow[];

    const projectIds = [...new Set(rows.map(l => l.project_id).filter((id): id is string => !!id))];
    const { data: projectsData } = await supabase
      .from('projects').select('id, name').in('id', projectIds);

    const projectsMap = new Map<string, string>(
      (projectsData ?? []).map(p => [p.id, p.name as string])
    );
    setLogs(rows.map(l => ({
      id: l.id,
      project_id: l.project_id ?? '',
      project_name: projectsMap.get(l.project_id ?? '') ?? 'Unknown Project',
      log_type: l.log_type,
      comment: l.comment,
      author_name: l.author_name,
      created_at: l.created_at ?? '',
    })));
  }

  /**
   * Roll a recurring personal task's due_date forward by one period.
   * Returns the new ISO date string (or null if the task had no due date).
   */
  function rollDueDate(currentDueIso: string | null, recurrence: TaskRecurrence): string | null {
    if (recurrence === 'none') return currentDueIso;
    const base = currentDueIso ? new Date(currentDueIso) : new Date();
    if (Number.isNaN(base.getTime())) return currentDueIso;
    const next = new Date(base);
    if (recurrence === 'daily')   next.setDate(next.getDate() + 1);
    if (recurrence === 'weekly')  next.setDate(next.getDate() + 7);
    if (recurrence === 'monthly') next.setMonth(next.getMonth() + 1);
    return next.toISOString();
  }

  async function handleStatusChange(taskId: string, status: TaskStatus) {
    const target = tasks.find(t => t.id === taskId);
    // Recurrence rollover: when marking a recurring task done, bump its due date
    // and keep it pending instead of actually marking it done.
    if (target && (status === 'done' || status === 'cancelled') && target.recurrence !== 'none') {
      const nextDue = rollDueDate(target.due_date, target.recurrence);
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'pending', due_date: nextDue } : t));
      await supabase
        .from('project_tasks')
        .update({ status: 'pending', due_date: nextDue, updated_at: new Date().toISOString() })
        .eq('id', taskId);
      return;
    }

    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status } : t));
    await supabase.from('project_tasks').update({ status, updated_at: new Date().toISOString() }).eq('id', taskId);
  }

  // Click a task → open edit modal in Home (primary action).
  // The modal exposes a secondary "Open in project" link for full project context.
  const openTaskEditor = (task: CrossProjectTask) => setEditingTask(task);

  // Apply an edited task back to the tasks state
  function applyEditedTask(updated: HomeTask) {
    setTasks(prev => prev.map(t => t.id === updated.id ? {
      ...t,
      title: updated.title,
      description: updated.description ?? null,
      status: updated.status,
      priority: updated.priority,
      due_date: updated.due_date,
      assignees: updated.assignees,
      bucket: (updated.bucket ?? null) as TaskBucket | null,
      recurrence: (updated.recurrence ?? 'none') as TaskRecurrence,
    } : t));
    setEditingTask(null);
  }

  function removeTaskFromState(id: string) {
    setTasks(prev => prev.filter(t => t.id !== id));
    setEditingTask(null);
  }

  // Insert a newly-created task from the form modal into the tasks state
  function applyCreatedTask(created: HomeTask) {
    setTasks(prev => [created as CrossProjectTask, ...prev]);
    setCreatingTask(null);
  }

  // Insert a newly-created log into the logs state (prepend = most recent first)
  function applyCreatedLog(log: CreatedLog) {
    setLogs(prev => [log as CrossProjectLog, ...prev]);
    setShowNewLogModal(false);
  }

  async function quickAddPersonalTask(bucket: TaskBucket) {
    const title = personalQuickAdd.trim();
    if (!title || !member || creatingPersonal) return;
    setCreatingPersonal(true);

    const { data, error } = await supabase
      .from('project_tasks')
      .insert({
        title,
        project_id: null,
        owner_member_id: member.id,
        bucket,
        status: 'pending',
        priority: 'medium',
        recurrence: 'none',
        display_order: 0,
      })
      .select()
      .single();

    setCreatingPersonal(false);
    if (error || !data) return;
    setPersonalQuickAdd('');

    const newTask: CrossProjectTask = {
      ...data,
      description: data.description ?? null,
      priority: (data.priority ?? 'medium') as TaskPriority,
      parent_task_id: null,
      assignees: [],
      tags: [],
      subtasks: [],
      comments: [],
      deliverables: [],
      project_name: '',
      owner_member_id: data.owner_member_id ?? null,
      bucket: (data.bucket ?? null) as TaskBucket | null,
      recurrence: (data.recurrence ?? 'none') as TaskRecurrence,
    } as CrossProjectTask;

    setTasks(prev => [newTask, ...prev]);
  }

  // ── Derived data ──────────────────────────────────────────────────────────

  // Day boundaries computed once per mount (stable for session; a medianoche crossing requires reload)
  const { todayTs, sevenDaysOutTs } = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    const seven = new Date(d);
    seven.setDate(seven.getDate() + 7);
    return { todayTs: d.getTime(), sevenDaysOutTs: seven.getTime() };
  }, []);

  function toggleMyTasks(on: boolean) {
    setMyTasksOnly(on);
    localStorage.setItem('homepage_tasks_filter', on ? 'mine' : 'all');
  }

  // Split tasks into project-bound and personal (team-wide)
  const projectTasks = useMemo(
    () => tasks.filter(t => !!t.project_id),
    [tasks]
  );
  const allPersonalTasks = useMemo(
    () => tasks.filter(t => !t.project_id),
    [tasks]
  );
  // Just mine (owned by current member)
  const myPersonalTasks = useMemo(
    () => (member ? allPersonalTasks.filter(t => t.owner_member_id === member.id) : []),
    [allPersonalTasks, member]
  );

  // My tasks filter (projects tab: assignee-based)
  const myTasks = useMemo(
    () => (member ? projectTasks.filter(t => t.assignees.some(a => a.id === member.id)) : projectTasks),
    [projectTasks, member]
  );
  const visibleTasks = useMemo(
    () => (myTasksOnly ? myTasks : projectTasks),
    [myTasksOnly, myTasks, projectTasks]
  );
  // Visible personal tasks: same Mine/All semantics applied to the Planner tab
  const visiblePersonalTasks = useMemo(
    () => (myTasksOnly ? myPersonalTasks : allPersonalTasks),
    [myTasksOnly, myPersonalTasks, allPersonalTasks]
  );

  const hasActiveFilters = !!(taskFilters.priority || taskFilters.assigneeId || taskFilters.projectId);

  // Single memo for project-task derived lists (subsections + hero counts + allProjects)
  const derived = useMemo(() => {
    const applyFilters = (list: CrossProjectTask[]): CrossProjectTask[] =>
      list.filter(t => {
        if (taskFilters.priority && t.priority !== taskFilters.priority) return false;
        if (taskFilters.assigneeId && !t.assignees.some(a => a.id === taskFilters.assigneeId)) return false;
        if (taskFilters.projectId && t.project_id !== taskFilters.projectId) return false;
        return true;
      });

    const isActive = (t: CrossProjectTask) => t.status !== 'done' && t.status !== 'cancelled';
    const dueTs = (t: CrossProjectTask) => (t.due_date ? new Date(t.due_date).getTime() : NaN);

    // Hero counts reflect BOTH myTasks toggle AND filter bar (consistent with subsections below)
    const filteredVisible = applyFilters(visibleTasks);

    const overdueTasks  = filteredVisible.filter(t => t.due_date && dueTs(t) < todayTs && isActive(t));
    const blockedTasks  = filteredVisible.filter(t => t.status === 'blocked');
    const workingOnIt   = filteredVisible.filter(t => t.status === 'in_progress');
    const inReviewTasks = filteredVisible.filter(t => t.status === 'in_review');
    const upcomingTasks = filteredVisible
      .filter(t => t.due_date && dueTs(t) >= todayTs && dueTs(t) <= sevenDaysOutTs && isActive(t))
      .sort((a, b) => dueTs(a) - dueTs(b));
    const toDo         = filteredVisible.filter(t => t.status === 'pending');
    const allDoneTasks = visibleTasks.filter(t => t.status === 'done' || t.status === 'cancelled');
    const filteredDone = applyFilters(allDoneTasks);

    const allProjects = [
      ...new Map(visibleTasks.map(t => [t.project_id, { id: t.project_id, name: t.project_name }])).values(),
    ];

    return {
      filteredVisible,
      overdueTasks, blockedTasks, workingOnIt, inReviewTasks,
      upcomingTasks, toDo, allDoneTasks, filteredDone,
      allProjects,
      inProgressAll: workingOnIt.length,
      inReviewAll:   inReviewTasks.length,
      pendingAll:    toDo.length,
      doneAll:       filteredDone.length,
      overdueAll:    overdueTasks.length,
      blockedAll:    blockedTasks.length,
    };
  }, [visibleTasks, taskFilters, todayTs, sevenDaysOutTs]);

  const {
    overdueTasks, blockedTasks, workingOnIt, inReviewTasks,
    upcomingTasks, toDo, allDoneTasks, filteredDone, allProjects,
  } = derived;

  // Personal-task derivation: group by bucket + count per-status for hero
  const personalDerived = useMemo(() => {
    const dueTs = (t: CrossProjectTask) => (t.due_date ? new Date(t.due_date).getTime() : NaN);
    const isActive = (t: CrossProjectTask) => t.status !== 'done' && t.status !== 'cancelled';

    const priorityFilter = taskFilters.priority;
    const passesPriority = (t: CrossProjectTask) => !priorityFilter || t.priority === priorityFilter;

    const byBucket: Record<TaskBucket, CrossProjectTask[]> = { inbox: [], daily: [], weekly: [], monthly: [] };
    const done: CrossProjectTask[] = [];

    for (const t of visiblePersonalTasks) {
      if (t.status === 'done' || t.status === 'cancelled') {
        if (passesPriority(t)) done.push(t);
        continue;
      }
      if (!passesPriority(t)) continue;
      const key = ((t.bucket ?? 'inbox') as TaskBucket);
      byBucket[key].push(t);
    }

    // Sort each bucket: overdue first, then by due date (nulls last), then by display_order/title
    const sortBucket = (list: CrossProjectTask[]) => list.sort((a, b) => {
      const aHas = !!a.due_date, bHas = !!b.due_date;
      if (aHas && bHas) return dueTs(a) - dueTs(b);
      if (aHas) return -1;
      if (bHas) return 1;
      return (a.display_order ?? 0) - (b.display_order ?? 0) || a.title.localeCompare(b.title);
    });
    (Object.keys(byBucket) as TaskBucket[]).forEach(k => sortBucket(byBucket[k]));

    // Hero counts scoped to personal tab (ignores filters to always reflect raw totals)
    const activePersonal = visiblePersonalTasks.filter(isActive);
    return {
      byBucket,
      done,
      counts: {
        inProgressAll: activePersonal.filter(t => t.status === 'in_progress').length,
        inReviewAll:   activePersonal.filter(t => t.status === 'in_review').length,
        pendingAll:    activePersonal.filter(t => t.status === 'pending').length,
        doneAll:       visiblePersonalTasks.filter(t => t.status === 'done' || t.status === 'cancelled').length,
        overdueAll:    activePersonal.filter(t => t.due_date && dueTs(t) < todayTs).length,
        blockedAll:    activePersonal.filter(t => t.status === 'blocked').length,
      },
    };
  }, [visiblePersonalTasks, taskFilters, todayTs]);

  // Hero counts switch between tabs
  const heroCounts = taskTab === 'planner'
    ? personalDerived.counts
    : {
        inProgressAll: derived.inProgressAll,
        inReviewAll:   derived.inReviewAll,
        pendingAll:    derived.pendingAll,
        doneAll:       derived.doneAll,
        overdueAll:    derived.overdueAll,
        blockedAll:    derived.blockedAll,
      };
  const { inProgressAll, inReviewAll, pendingAll, doneAll, overdueAll, blockedAll } = heroCounts;

  // Team workload — based on full `projectTasks` (not affected by filters or myTasks toggle)
  const workload = useMemo(() => {
    const isActive = (t: CrossProjectTask) => t.status !== 'done' && t.status !== 'cancelled';
    const dueTs = (t: CrossProjectTask) => (t.due_date ? new Date(t.due_date).getTime() : NaN);

    const w = teamMembers
      .filter(m => m.is_active)
      .map((m, idx) => {
        const mine = projectTasks.filter(t => isActive(t) && t.assignees.some(a => a.id === m.id));
        return {
          member: m, idx,
          tasks: mine,
          total:      mine.length,
          overdue:    mine.filter(t => t.due_date && dueTs(t) < todayTs).length,
          inProgress: mine.filter(t => t.status === 'in_progress').length,
          pending:    mine.filter(t => t.status === 'pending').length,
          blocked:    mine.filter(t => t.status === 'blocked').length,
        };
      })
      .filter(x => x.total > 0)
      // Risk-weighted sort: overdue → blocked → in-progress → pending
      .sort((a, b) => {
        const risk = (w: typeof a) => w.overdue * 1000 + w.blocked * 100 + w.inProgress * 10 + w.pending;
        return risk(b) - risk(a);
      });
    return w;
  }, [projectTasks, teamMembers, todayTs]);

  // Feed — group by project (preserving insertion order for "most recent first")
  const { logsByProject, logProjectOrder, allFeedProjects } = useMemo(() => {
    const byProject = new Map<string, CrossProjectLog[]>();
    for (const log of logs) {
      const list = byProject.get(log.project_id);
      if (list) list.push(log);
      else byProject.set(log.project_id, [log]);
    }
    const order = [...byProject.keys()];
    const feedProjects = order.map(id => ({ id, name: byProject.get(id)![0].project_name }));
    return { logsByProject: byProject, logProjectOrder: order, allFeedProjects: feedProjects };
  }, [logs]);

  // Feed search
  const feedSuggestions = useMemo(() => {
    if (!feedSearch.trim()) return [];
    const q = feedSearch.toLowerCase();
    return allFeedProjects.filter(p => p.name.toLowerCase().includes(q));
  }, [feedSearch, allFeedProjects]);
  const filteredLogProjectOrder = useMemo(() => {
    if (!feedSearch.trim()) return logProjectOrder;
    const q = feedSearch.toLowerCase();
    return logProjectOrder.filter(id => logsByProject.get(id)![0].project_name.toLowerCase().includes(q));
  }, [feedSearch, logProjectOrder, logsByProject]);

  // ── Loading skeleton ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="glass-indigo rounded-2xl h-24 animate-pulse" />
        <div className="glass-white rounded-2xl h-12 animate-pulse" />
        <div className="glass-white rounded-2xl h-28 animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5">
          <div className="glass-white rounded-2xl h-[500px] animate-pulse" />
          <div className="space-y-5">
            <div className="glass-white rounded-2xl h-48 animate-pulse" />
            <div className="glass-white rounded-2xl h-64 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
    <div className="space-y-5 page-enter">

      {/* ── Hero stat bar ─────────────────────────────────────────────────── */}
      <div className="glass-indigo px-6 py-5 hero-enter">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{member ? getGreeting(member.name) : 'Home'}</h1>
            <p className="text-sm text-slate-500 mt-0.5">Track tasks and activity across all your projects</p>
          </div>

          {tasks.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/60 border border-blue-200/60 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                <span className="text-sm font-bold text-blue-800 tabular-nums">{inProgressAll}</span>
                <span className="text-xs text-blue-600 font-medium hidden sm:inline">In Progress</span>
              </div>
              {inReviewAll > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/60 border border-purple-200/60 shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-purple-500 flex-shrink-0" />
                  <span className="text-sm font-bold text-purple-800 tabular-nums">{inReviewAll}</span>
                  <span className="text-xs text-purple-600 font-medium hidden sm:inline">In Review</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/60 border border-amber-200/60 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
                <span className="text-sm font-bold text-amber-800 tabular-nums">{pendingAll}</span>
                <span className="text-xs text-amber-600 font-medium hidden sm:inline">To-do</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/60 border border-emerald-200/60 shadow-sm">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
                <span className="text-sm font-bold text-emerald-800 tabular-nums">{doneAll}</span>
                <span className="text-xs text-emerald-600 font-medium hidden sm:inline">Done</span>
              </div>
              {overdueAll > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50/80 border border-red-300/70 shadow-sm">
                  <AlertTriangle className="h-3.5 w-3.5 text-red-600 flex-shrink-0" />
                  <span className="text-sm font-bold text-red-800 tabular-nums">{overdueAll}</span>
                  <span className="text-xs text-red-600 font-medium hidden sm:inline">Overdue</span>
                </div>
              )}
              {blockedAll > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50/80 border border-rose-300/70 shadow-sm">
                  <Ban className="h-3.5 w-3.5 text-rose-600 flex-shrink-0" />
                  <span className="text-sm font-bold text-rose-800 tabular-nums">{blockedAll}</span>
                  <span className="text-xs text-rose-600 font-medium hidden sm:inline">Blocked</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Project Pipeline ──────────────────────────────────────────────── */}
      {Object.keys(pipeline).length > 0 && (
        <div className="glass-white px-5 py-3.5">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <div className="p-1 rounded-md bg-slate-100">
                <GitMerge className="h-3.5 w-3.5 text-slate-500" />
              </div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Projects Pipeline</span>
            </div>
            <div className="w-px h-4 bg-slate-200 hidden sm:block" />
            <div className="flex items-center gap-2 flex-wrap">
              {PIPELINE_ORDER.map(status => {
                const count = pipeline[status];
                if (!count) return null;
                return (
                  <div key={status} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium ${PIPELINE_COLORS[status]}`}>
                    <span className="font-bold tabular-nums">{count}</span>
                    <span className="opacity-80">{status}</span>
                  </div>
                );
              })}
            </div>
            <div className="ml-auto flex items-center gap-3 flex-shrink-0">
              <button
                onClick={() => setShowNewProjectModal(true)}
                className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/60 px-2.5 py-1 rounded-lg transition-all"
              >
                <span className="text-base leading-none font-bold">+</span> New Project
              </button>
              <Link to="/projects" className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 font-medium transition-colors">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ── Recent Quotes ─────────────────────────────────────────────────── */}
      <div className="glass-white overflow-hidden p-0">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100/80">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-indigo-100">
              <FolderOpen className="h-4 w-4 text-indigo-600" />
            </div>
            <h2 className="text-base font-semibold text-slate-900">Recent Quotes</h2>
            {recentQuotes.length > 0 && (
              <span className="text-xs font-semibold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                {recentQuotes.length}
              </span>
            )}
          </div>
          <button
            onClick={() => navigate('/projects')}
            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
          >
            View all
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {recentQuotes.length === 0 ? (
          <div className="py-10 text-center text-slate-400">
            <FolderOpen className="h-8 w-8 mx-auto mb-2 opacity-20" />
            <p className="text-sm font-medium">No quotes yet</p>
          </div>
        ) : (
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            {recentQuotes.map((q, idx) => (
              <div
                key={q.id}
                onClick={() => navigate(`/projects/${q.project_id}/quotations/${q.id}`)}
                className={`group p-4 rounded-xl border border-slate-200/60 hover:border-blue-400/60 hover:shadow-lg hover:-translate-y-0.5 cursor-pointer transition-all bg-white/60 backdrop-blur-sm card-enter stagger-${Math.min(idx + 1, 12)}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-sm font-semibold text-slate-900 truncate flex-1 mr-2 leading-snug">
                    {q.name}
                  </h3>
                  <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-blue-600 transition-colors flex-shrink-0 mt-0.5" />
                </div>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${QUOTE_STATUS_COLORS[q.status] ?? 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                    {q.status}
                  </span>
                  {q.project_type && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                      {q.project_type}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-400">
                    {new Date(q.quote_date).toLocaleDateString()}
                  </span>
                  <span className="text-sm font-bold text-slate-900">
                    {formatCurrency((q.total_amount ?? 0) / exchangeRate, 'USD')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Main grid ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5 items-start">

        {/* ── Tasks column ──────────────────────────────────────────────── */}
        <div className={`glass-white overflow-hidden p-0 transition-colors duration-500 ${taskTab === 'planner' ? 'ring-1 ring-violet-200/50' : 'ring-1 ring-blue-100/40'}`}>
          {/* ── Title row + Mine/All toggle ───────────────────────────── */}
          <div className="flex items-center gap-2.5 px-5 pt-4 pb-3">
            <div className={`p-1.5 rounded-lg transition-colors duration-500 ${taskTab === 'planner' ? 'bg-violet-100' : 'bg-blue-100'}`}>
              <CheckSquare className={`h-4 w-4 transition-colors duration-500 ${taskTab === 'planner' ? 'text-violet-600' : 'text-blue-600'}`} />
            </div>
            <h2 className="text-base font-semibold text-slate-900">Tasks</h2>

            {/* Mine / All toggle — applies to the active tab */}
            {member && (() => {
              const activeAccent = taskTab === 'planner'
                ? 'bg-violet-500 text-white shadow-sm'
                : 'bg-blue-500 text-white shadow-sm';
              const mineCount = taskTab === 'planner' ? myPersonalTasks.length : myTasks.length;
              const allCount  = taskTab === 'planner' ? allPersonalTasks.length : projectTasks.length;
              return (
                <div className="ml-auto flex items-center rounded-lg border border-slate-200 bg-white overflow-hidden text-xs font-medium shadow-sm">
                  <button
                    onClick={() => toggleMyTasks(true)}
                    className={`px-3 py-1.5 transition-all duration-200 ${myTasksOnly ? activeAccent : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                    aria-pressed={myTasksOnly}
                  >
                    Mine <span className="tabular-nums opacity-90">({mineCount})</span>
                  </button>
                  <span className="w-px self-stretch bg-slate-200/80" />
                  <button
                    onClick={() => toggleMyTasks(false)}
                    className={`px-3 py-1.5 transition-all duration-200 ${!myTasksOnly ? activeAccent : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                    aria-pressed={!myTasksOnly}
                  >
                    All <span className="tabular-nums opacity-90">({allCount})</span>
                  </button>
                </div>
              );
            })()}
          </div>

          {/* ── Prominent 2-column tab switcher ───────────────────────── */}
          <div className="relative grid grid-cols-2 border-y border-slate-100/80 bg-slate-50/40">
            <button
              onClick={() => switchTaskTab('projects')}
              className={`relative group flex items-center justify-center gap-2 px-4 py-4 text-sm font-semibold transition-all duration-300 ${
                taskTab === 'projects'
                  ? 'text-blue-700 bg-gradient-to-b from-blue-50/70 to-white'
                  : 'text-slate-400 hover:text-slate-600 hover:bg-white/50'
              }`}
              aria-pressed={taskTab === 'projects'}
            >
              <FolderKanban className={`h-4 w-4 transition-transform duration-300 ${taskTab === 'projects' ? 'scale-110' : 'scale-100'}`} />
              <span>Projects</span>
              {/* Animated underline indicator */}
              <span
                className={`absolute bottom-0 left-0 right-0 h-[3px] bg-gradient-to-r from-blue-400 via-blue-500 to-indigo-500 rounded-t-full transition-all duration-300 ${
                  taskTab === 'projects' ? 'opacity-100 scale-x-100' : 'opacity-0 scale-x-75'
                }`}
              />
            </button>
            <button
              onClick={() => switchTaskTab('planner')}
              disabled={!member}
              title={!member ? 'Sign in to use the planner' : undefined}
              className={`relative group flex items-center justify-center gap-2 px-4 py-4 text-sm font-semibold transition-all duration-300 ${
                taskTab === 'planner'
                  ? 'text-violet-700 bg-gradient-to-b from-violet-50/70 to-white'
                  : 'text-slate-400 hover:text-slate-600 hover:bg-white/50'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
              aria-pressed={taskTab === 'planner'}
            >
              <NotebookPen className={`h-4 w-4 transition-transform duration-300 ${taskTab === 'planner' ? 'scale-110' : 'scale-100'}`} />
              <span>Planner</span>
              {/* Animated underline indicator */}
              <span
                className={`absolute bottom-0 left-0 right-0 h-[3px] bg-gradient-to-r from-violet-400 via-violet-500 to-fuchsia-500 rounded-t-full transition-all duration-300 ${
                  taskTab === 'planner' ? 'opacity-100 scale-x-100' : 'opacity-0 scale-x-75'
                }`}
              />
            </button>
            {/* Vertical divider between tabs */}
            <span className="pointer-events-none absolute top-2 bottom-2 left-1/2 w-px bg-slate-200/70" />
          </div>

          {/* ── Projects tab ───────────────────────────────────────────── */}
          {taskTab === 'projects' && (
          <div key="projects-tab" className="tab-enter-left">
            {visibleTasks.length === 0 ? (
              <div className="py-16 text-center text-slate-400">
                <CheckSquare className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm font-medium">{myTasksOnly ? 'You have no assigned tasks at this time' : 'No tasks across any project yet'}</p>
              </div>
            ) : (
              <>
                {/* Filter bar */}
                <div className="px-5 py-3 border-b border-slate-100/80 bg-slate-50/60 flex items-center gap-2 flex-wrap">
                  <Filter className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />

                  <select
                    value={taskFilters.priority}
                    onChange={e => setTaskFilters(p => ({ ...p, priority: e.target.value as TaskPriority | '' }))}
                    className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">All priorities</option>
                    {(Object.entries(TASK_PRIORITY_CONFIG) as [TaskPriority, typeof TASK_PRIORITY_CONFIG[TaskPriority]][]).map(([val, cfg]) => (
                      <option key={val} value={val}>{cfg.label}</option>
                    ))}
                  </select>

                  <select
                    value={taskFilters.assigneeId}
                    onChange={e => setTaskFilters(p => ({ ...p, assigneeId: e.target.value }))}
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
                      onChange={e => setTaskFilters(p => ({ ...p, projectId: e.target.value }))}
                      className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">All projects</option>
                      {allProjects.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  )}

                  {hasActiveFilters && (
                    <button
                      onClick={() => setTaskFilters({ priority: '', assigneeId: '', projectId: '' })}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-slate-700 transition-colors"
                    >
                      <X className="h-3 w-3" />
                      Clear
                    </button>
                  )}

                  <button
                    onClick={() => setCreatingTask({ kind: 'project' })}
                    className="ml-auto flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200/60 px-2.5 py-1 rounded-lg transition-all"
                  >
                    <Plus className="h-3 w-3" /> New Task
                  </button>
                </div>

                {/* Subsections */}
                <div className="p-4 space-y-3">
                  {overdueTasks.length > 0 && (
                    <TaskSubsection
                      variant="red"
                      title="Overdue"
                      tasks={overdueTasks}
                      onNavigate={openTaskEditor}
                      onStatusChange={handleStatusChange}
                    />
                  )}
                  {blockedTasks.length > 0 && (
                    <TaskSubsection
                      variant="rose"
                      title="Blocked"
                      tasks={blockedTasks}
                      onNavigate={openTaskEditor}
                      onStatusChange={handleStatusChange}
                    />
                  )}
                  <TaskSubsection
                    variant="blue"
                    title="Working on it"
                    tasks={workingOnIt}
                    onNavigate={openTaskEditor}
                    onStatusChange={handleStatusChange}
                  />
                  {inReviewTasks.length > 0 && (
                    <TaskSubsection
                      variant="purple"
                      title="In Review"
                      tasks={inReviewTasks}
                      onNavigate={openTaskEditor}
                      onStatusChange={handleStatusChange}
                    />
                  )}
                  {upcomingTasks.length > 0 && (
                    <TaskSubsection
                      variant="purple"
                      title="Due in 7 days"
                      tasks={upcomingTasks}
                      onNavigate={openTaskEditor}
                      onStatusChange={handleStatusChange}
                    />
                  )}
                  <TaskSubsection
                    variant="amber"
                    title="To-do"
                    tasks={toDo}
                    onNavigate={openTaskEditor}
                    onStatusChange={handleStatusChange}
                  />

                  <TaskSubsection
                    variant="green"
                    title="Done"
                    tasks={filteredDone}
                    totalCount={allDoneTasks.length}
                    collapsible
                    defaultCollapsed
                    emptyMessage="No completed tasks match the current filters"
                    onNavigate={openTaskEditor}
                    onStatusChange={handleStatusChange}
                  />
                </div>
              </>
            )
          }
          </div>
          )}

          {/* ── Planner tab (Bullet Journal buckets) ───────────────────── */}
          {taskTab === 'planner' && (
          <div key="planner-tab" className="tab-enter-right">
            {!member ? (
              <div className="py-16 text-center text-slate-400">
                <CheckSquare className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm font-medium">Sign in to use the planner</p>
              </div>
            ) : (
              <>
                {/* Quick-add bar */}
                <div className="px-5 py-3 border-b border-slate-100/80 bg-slate-50/60">
                  <div className="flex items-center gap-2">
                    <select
                      value={personalQuickBucket}
                      onChange={e => setPersonalQuickBucket(e.target.value as TaskBucket)}
                      className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="inbox">Inbox</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={personalQuickAdd}
                        onChange={e => setPersonalQuickAdd(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') quickAddPersonalTask(personalQuickBucket); }}
                        placeholder={`Add to ${personalQuickBucket}…  (press Enter)`}
                        className="w-full text-xs border border-slate-200 rounded-lg pl-8 pr-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <Plus className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                    </div>
                    <button
                      onClick={() => quickAddPersonalTask(personalQuickBucket)}
                      disabled={!personalQuickAdd.trim() || creatingPersonal}
                      className="text-xs font-semibold bg-blue-500 hover:bg-blue-600 disabled:bg-slate-200 disabled:text-slate-400 text-white px-3 py-1.5 rounded-lg transition-colors"
                    >
                      {creatingPersonal ? 'Adding…' : 'Add'}
                    </button>
                  </div>
                </div>

                {/* Priority filter (only) */}
                <div className="px-5 py-3 border-b border-slate-100/80 bg-slate-50/60 flex items-center gap-2 flex-wrap">
                  <Filter className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                  <select
                    value={taskFilters.priority}
                    onChange={e => setTaskFilters(p => ({ ...p, priority: e.target.value as TaskPriority | '' }))}
                    className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">All priorities</option>
                    {(Object.entries(TASK_PRIORITY_CONFIG) as [TaskPriority, typeof TASK_PRIORITY_CONFIG[TaskPriority]][]).map(([val, cfg]) => (
                      <option key={val} value={val}>{cfg.label}</option>
                    ))}
                  </select>
                  {taskFilters.priority && (
                    <button
                      onClick={() => setTaskFilters(p => ({ ...p, priority: '' }))}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-slate-700 transition-colors"
                    >
                      <X className="h-3 w-3" />
                      Clear
                    </button>
                  )}
                </div>

                {/* Bucket sections */}
                <div className="p-4 space-y-3">
                  {visiblePersonalTasks.length === 0 ? (
                    <div className="py-12 text-center text-slate-400">
                      <Inbox className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm font-medium">
                        {myTasksOnly ? 'Your planner is empty' : 'No planner tasks on the team yet'}
                      </p>
                      <p className="text-[11px] mt-0.5">Add your first task above</p>
                    </div>
                  ) : (
                    <>
                      <PersonalBucketSection
                        bucket="inbox"
                        label="Inbox"
                        Icon={Inbox}
                        variant="purple"
                        tasks={personalDerived.byBucket.inbox}
                        onNavigate={openTaskEditor}
                        onStatusChange={handleStatusChange}
                      />
                      <PersonalBucketSection
                        bucket="daily"
                        label="Daily"
                        Icon={Sun}
                        variant="amber"
                        tasks={personalDerived.byBucket.daily}
                        onNavigate={openTaskEditor}
                        onStatusChange={handleStatusChange}
                      />
                      <PersonalBucketSection
                        bucket="weekly"
                        label="Weekly"
                        Icon={CalendarDays}
                        variant="blue"
                        tasks={personalDerived.byBucket.weekly}
                        onNavigate={openTaskEditor}
                        onStatusChange={handleStatusChange}
                      />
                      <PersonalBucketSection
                        bucket="monthly"
                        label="Monthly"
                        Icon={CalendarRange}
                        variant="green"
                        tasks={personalDerived.byBucket.monthly}
                        onNavigate={openTaskEditor}
                        onStatusChange={handleStatusChange}
                      />
                      {personalDerived.done.length > 0 && (
                        <TaskSubsection
                          variant="green"
                          title="Done"
                          tasks={personalDerived.done}
                          totalCount={personalDerived.done.length}
                          collapsible
                          defaultCollapsed
                          emptyMessage="No completed personal tasks"
                          onNavigate={openTaskEditor}
                          onStatusChange={handleStatusChange}
                        />
                      )}
                    </>
                  )}
                </div>
              </>
            )}
          </div>
          )}
        </div>

        {/* ── Right column ──────────────────────────────────────────────── */}
        <div className="flex flex-col gap-5">

        {/* Team Workload */}
        <div className="glass-white overflow-hidden p-0">
          <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-100/80">
            <div className="p-1.5 rounded-lg bg-teal-100">
              <Users className="h-4 w-4 text-teal-600" />
            </div>
            <h2 className="text-base font-semibold text-slate-900">Team Workload</h2>
          </div>
          {workload.length === 0 ? (
            <div className="py-10 text-center text-slate-400">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-20" />
              <p className="text-sm font-medium">No active tasks assigned</p>
            </div>
          ) : (
            <div className="p-4 space-y-1">
              {workload.map((w) => {
                const { member, idx, tasks: memberTasks, total, overdue, inProgress, pending, blocked: bk } = w;
                const isExpanded = expandedMemberId === member.id;
                const pct = (n: number) => total > 0 ? `${(n / total) * 100}%` : '0%';

                function handleMemberClick() {
                  if (isExpanded) {
                    // Collapse + clear filter
                    setExpandedMemberId(null);
                    setTaskFilters(prev => ({ ...prev, assigneeId: '' }));
                  } else {
                    // Expand + filter to this member + switch to Projects tab
                    setExpandedMemberId(member.id);
                    setTaskFilters(prev => ({ ...prev, assigneeId: member.id }));
                    switchTaskTab('projects');
                  }
                }

                return (
                  <div key={member.id}>
                    <div
                      onClick={handleMemberClick}
                      className={`flex items-center gap-3 px-2 py-2.5 -mx-2 rounded-xl cursor-pointer transition-all ${
                        isExpanded
                          ? 'bg-blue-50/60 ring-1 ring-blue-200/50'
                          : 'hover:bg-slate-50/80'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${AVATAR_COLORS[idx % AVATAR_COLORS.length]}`}>
                        {getInitials(member.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-sm font-medium text-slate-700 truncate">{member.name.split(' ')[0]}</span>
                            {overdue > 0 && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-red-700 bg-red-100 px-1.5 py-0.5 rounded-full animate-pulse">
                                <AlertTriangle className="h-2.5 w-2.5" />
                                {overdue} overdue
                              </span>
                            )}
                          </div>
                          <span className="text-xs font-bold text-slate-500 tabular-nums ml-2 flex-shrink-0">{total}</span>
                        </div>
                        {/* Proportional stacked bar — segments show composition of member's work */}
                        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden flex">
                          {overdue > 0    && <div className="bg-red-500 transition-all"  style={{ width: pct(overdue) }} />}
                          {bk > 0         && <div className="bg-rose-400 transition-all" style={{ width: pct(bk) }} />}
                          {inProgress > 0 && <div className="bg-blue-500 transition-all" style={{ width: pct(inProgress) }} />}
                          {pending > 0    && <div className="bg-amber-400 transition-all" style={{ width: pct(pending) }} />}
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          {overdue > 0    && <span className="text-[10px] text-red-600 font-medium">{overdue} overdue</span>}
                          {bk > 0         && <span className="text-[10px] text-rose-600 font-medium">{bk} blocked</span>}
                          {inProgress > 0 && <span className="text-[10px] text-blue-600 font-medium">{inProgress} in progress</span>}
                          {pending > 0    && <span className="text-[10px] text-amber-600 font-medium">{pending} pending</span>}
                        </div>
                      </div>
                      <ChevronDown className={`h-3.5 w-3.5 text-slate-400 flex-shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>

                    {/* Expanded task list */}
                    {isExpanded && (
                      <div className="ml-11 mr-1 mt-1 mb-2 space-y-0.5">
                        {memberTasks.slice(0, 8).map(task => {
                          const taskOverdue = task.due_date && new Date(task.due_date).getTime() < todayTs;
                          return (
                            <div
                              key={task.id}
                              onClick={e => { e.stopPropagation(); openTaskEditor(task); }}
                              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs cursor-pointer hover:bg-white/80 hover:shadow-sm transition-all group"
                            >
                              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                taskOverdue ? 'bg-red-500' :
                                task.status === 'blocked' ? 'bg-rose-500' :
                                task.status === 'in_progress' ? 'bg-blue-500' :
                                task.status === 'in_review' ? 'bg-purple-500' :
                                'bg-amber-400'
                              }`} />
                              <span className="text-slate-700 truncate flex-1 group-hover:text-blue-700 transition-colors">{task.title}</span>
                              {task.due_date && (
                                <span className={`text-[10px] tabular-nums flex-shrink-0 ${taskOverdue ? 'text-red-500 font-semibold' : 'text-slate-400'}`}>
                                  {format(new Date(task.due_date), 'MMM d')}
                                </span>
                              )}
                            </div>
                          );
                        })}
                        {memberTasks.length > 8 && (
                          <span className="block text-[10px] text-slate-400 px-2.5 py-1">
                            +{memberTasks.length - 8} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Feed */}
        <div className="glass-white overflow-hidden p-0">
          {/* Header */}
          {/* Header row */}
          <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-100/80">
            <div className="p-1.5 rounded-lg bg-violet-100 flex-shrink-0">
              <Activity className="h-4 w-4 text-violet-600" />
            </div>
            <h2 className="text-base font-semibold text-slate-900 flex-shrink-0">Feed</h2>
            {logs.length > 0 && (
              <span className="text-xs font-semibold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full flex-shrink-0">
                {logs.length}
              </span>
            )}
            <button
              onClick={() => setShowNewLogModal(true)}
              className="flex items-center gap-1 text-xs font-semibold text-violet-600 hover:text-violet-800 bg-violet-50 hover:bg-violet-100 border border-violet-200/60 px-2.5 py-1 rounded-lg transition-all flex-shrink-0"
            >
              <Plus className="h-3 w-3" /> New Entry
            </button>
          </div>

          {/* Search bar — separate row below header */}
          {logs.length > 0 && (
            <div className="px-5 py-2.5 border-b border-slate-100/80 bg-slate-50/40">
              <div ref={feedSearchRef} className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={feedSearch}
                  onChange={e => { setFeedSearch(e.target.value); setFeedDropdownOpen(true); }}
                  onFocus={() => setFeedDropdownOpen(true)}
                  onBlur={() => setTimeout(() => setFeedDropdownOpen(false), 150)}
                  placeholder="Search project…"
                  className="w-full pl-7 pr-7 py-1.5 text-xs border border-slate-200/70 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400/50 bg-white/70 placeholder-slate-400 text-slate-700"
                />
                {feedSearch && (
                  <button
                    onMouseDown={e => { e.preventDefault(); setFeedSearch(''); setFeedDropdownOpen(false); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
                {feedDropdownOpen && feedSuggestions.length > 0 && (
                  <div className="absolute top-full mt-1 left-0 right-0 z-20 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
                    {feedSuggestions.map(({ id, name }) => (
                      <button
                        key={id}
                        onMouseDown={e => { e.preventDefault(); setFeedSearch(name); setFeedDropdownOpen(false); }}
                        className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-violet-50 hover:text-violet-700 transition-colors truncate"
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {logs.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <Activity className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium">No log entries yet</p>
            </div>
          ) : filteredLogProjectOrder.length === 0 ? (
            <div className="py-10 text-center text-slate-400">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-20" />
              <p className="text-sm font-medium">No projects match &ldquo;{feedSearch}&rdquo;</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100/80">
              {filteredLogProjectOrder.map(projectId => {
                const allEntries = logsByProject.get(projectId)!;
                const entries = allEntries.slice(0, 3);
                const extra = allEntries.length - 3;
                const projectName = allEntries[0].project_name;

                return (
                  <div key={projectId} className="px-4 py-4">
                    {/* Project header */}
                    <Link
                      to={`/projects/${projectId}`}
                      className="inline-flex items-center gap-1.5 mb-3 group"
                    >
                      <span className="text-sm font-semibold text-slate-700 group-hover:text-blue-600 transition-colors truncate max-w-[240px]">
                        {projectName}
                      </span>
                      <ExternalLink className="h-3 w-3 text-slate-400 group-hover:text-blue-500 transition-colors flex-shrink-0" />
                    </Link>

                    {/* Log entries (max 3) */}
                    <div className="space-y-1.5 pl-0.5">
                      {entries.map(log => {
                        const cfg = LOG_TYPES[(log.log_type as LogType)] ?? LOG_TYPES.note;
                        const { Icon } = cfg;
                        const text = getLogText(log.comment);

                        return (
                          <div
                            key={log.id}
                            onClick={() => setViewingLog(log)}
                            className={`flex gap-2.5 p-2.5 rounded-lg border-l-4 cursor-pointer hover:shadow-sm hover:brightness-[0.98] transition-all ${cfg.bg} ${cfg.border}`}
                          >
                            <div className={`flex-shrink-0 mt-0.5 ${cfg.color}`}>
                              <Icon className="h-3.5 w-3.5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${cfg.badgeBg} ${cfg.color}`}>
                                  {cfg.label}
                                </span>
                                <span className="text-[10px] text-slate-500 font-medium truncate">
                                  {log.author_name ?? 'Previous user'}
                                </span>
                                <span className="text-[10px] text-slate-400 flex items-center gap-0.5 ml-auto flex-shrink-0">
                                  <Clock className="h-2.5 w-2.5" />
                                  {format(new Date(log.created_at), 'MMM d, HH:mm')}
                                </span>
                              </div>
                              {text && (
                                <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">{text}</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* "X more" link */}
                    {extra > 0 && (
                      <Link
                        to={`/projects/${projectId}`}
                        className="mt-2 flex items-center gap-1 text-[11px] text-blue-500 hover:text-blue-700 font-medium transition-colors pl-0.5"
                      >
                        +{extra} more {extra === 1 ? 'entry' : 'entries'}
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        </div>{/* end right column */}
      </div>

    </div>

      <NewProjectModal
        isOpen={showNewProjectModal}
        onClose={() => setShowNewProjectModal(false)}
        onSuccess={(id) => navigate(`/projects/${id}`)}
      />

      {editingTask && (
        <HomeTaskFormModal
          mode="edit"
          task={editingTask}
          teamMembers={teamMembers}
          currentMemberId={member?.id ?? null}
          onSaved={applyEditedTask}
          onDeleted={removeTaskFromState}
          onClose={() => setEditingTask(null)}
        />
      )}

      {creatingTask && (
        <HomeTaskFormModal
          mode="create"
          teamMembers={teamMembers}
          projects={projectsList}
          createDefaults={{
            kind: creatingTask.kind,
            projectId: creatingTask.projectId ?? null,
            ownerMemberId: creatingTask.kind === 'planner' ? (member?.id ?? null) : null,
            bucket: creatingTask.bucket,
          }}
          currentMemberId={member?.id ?? null}
          onSaved={applyCreatedTask}
          onDeleted={() => { /* unused in create mode */ }}
          onClose={() => setCreatingTask(null)}
        />
      )}

      {showNewLogModal && (
        <HomeLogCreateModal
          projects={projectsList}
          currentMemberId={member?.id ?? null}
          currentMemberName={member?.name ?? null}
          onCreated={applyCreatedLog}
          onClose={() => setShowNewLogModal(false)}
        />
      )}

      {viewingLog && (
        <HomeLogDetailModal
          log={viewingLog}
          currentMemberId={member?.id ?? null}
          currentMemberName={member?.name ?? null}
          onClose={() => setViewingLog(null)}
        />
      )}
    </>
  );
}
