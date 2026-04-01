import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  CheckSquare, Clock, ChevronDown, ChevronRight, CheckCircle2,
  ScrollText, ArrowRightCircle, Lightbulb, AlertTriangle, Star,
  Activity, ExternalLink, Filter, X, TrendingUp, FolderOpen, ArrowRight,
  Users, Calendar, Ban, GitMerge,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import type { EnhancedTask, TaskStatus, TaskPriority, TeamMember } from '../types';
import { TASK_PRIORITY_CONFIG } from '../types';
import { TaskCard } from '../components/tasks/TaskCard';
import { formatCurrency } from '../lib/calculations';
import { useSettingsStore } from '../lib/settingsStore';

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

// ── Log type config (mirrors BitacoraSection) ─────────────────────────────────

type LogType = 'note' | 'change_request' | 'approved_change' | 'decision' | 'error' | 'achievement';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const LOG_TYPES: Record<LogType, { label: string; Icon: any; color: string; bg: string; border: string; badgeBg: string }> = {
  note:            { label: 'Note',            Icon: ScrollText,       color: 'text-slate-500',   bg: 'bg-slate-50/70',    border: 'border-l-slate-300',   badgeBg: 'bg-slate-100'   },
  change_request:  { label: 'Change Request',  Icon: ArrowRightCircle, color: 'text-blue-600',    bg: 'bg-blue-50/70',     border: 'border-l-blue-400',    badgeBg: 'bg-blue-100'    },
  approved_change: { label: 'Approved Change', Icon: CheckCircle2,     color: 'text-green-600',   bg: 'bg-green-50/70',    border: 'border-l-green-400',   badgeBg: 'bg-green-100'   },
  decision:        { label: 'Decision',        Icon: Lightbulb,        color: 'text-amber-600',   bg: 'bg-amber-50/70',    border: 'border-l-amber-400',   badgeBg: 'bg-amber-100'   },
  error:           { label: 'Error',           Icon: AlertTriangle,    color: 'text-red-600',     bg: 'bg-red-50/70',      border: 'border-l-red-400',     badgeBg: 'bg-red-100'     },
  achievement:     { label: 'Achievement',     Icon: Star,             color: 'text-emerald-600', bg: 'bg-emerald-50/70',  border: 'border-l-emerald-400', badgeBg: 'bg-emerald-100' },
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
  onNavigate: (task: CrossProjectTask) => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
}

function TaskSubsection({
  variant, title, tasks, totalCount, collapsible = false, defaultCollapsed = false,
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
            <p className={`text-xs font-medium ${v.emptyDot} opacity-70`}>No tasks here</p>
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

export function HomePage() {
  const navigate = useNavigate();
  const exchangeRate = useSettingsStore(s => s.settings.exchangeRateUsdToMxn);
  const fetchSettings = useSettingsStore(s => s.fetchSettings);
  const [tasks, setTasks] = useState<CrossProjectTask[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [logs, setLogs] = useState<CrossProjectLog[]>([]);
  const [recentQuotes, setRecentQuotes] = useState<RecentQuote[]>([]);
  const [pipeline, setPipeline] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [taskFilters, setTaskFilters] = useState<TaskFilterState>({ priority: '', assigneeId: '', projectId: '' });
  const [doneExpanded, setDoneExpanded] = useState(false);

  useEffect(() => {
    fetchSettings();
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    await Promise.all([loadTasks(), loadLogs(), loadQuotesData()]);
    setLoading(false);
  }

  async function loadQuotesData() {
    const [recentRes, pipelineRes] = await Promise.all([
      supabase
        .from('quotations')
        .select('id, project_id, name, quote_date, total_amount, status, project_type, updated_at')
        .order('updated_at', { ascending: false })
        .limit(5),
      supabase.from('quotations').select('status'),
    ]);
    setRecentQuotes(recentRes.data || []);
    const counts: Record<string, number> = {};
    (pipelineRes.data || []).forEach(q => { counts[q.status] = (counts[q.status] || 0) + 1; });
    setPipeline(counts);
  }

  async function loadTasks() {
    const { data: rawTasks } = await supabase
      .from('project_tasks')
      .select('*')
      .is('parent_task_id', null)
      .order('display_order');

    if (!rawTasks || rawTasks.length === 0) { setTasks([]); return; }

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
          assignees: [], tags: [], subtasks: [], comments: [], deliverables: [],
          project_name: projectsMap.get(s.project_id) ?? '',
        }));

      return {
        ...raw,
        description: (raw as Record<string, unknown>).description as string ?? null,
        priority: ((raw as Record<string, unknown>).priority as TaskPriority) ?? 'medium',
        parent_task_id: null,
        assignees: taskAssignees,
        tags: [], subtasks: taskSubtasks, comments: [], deliverables: [],
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

    if (!logsData || logsData.length === 0) { setLogs([]); return; }

    const projectIds = [...new Set(logsData.map(l => l.project_id))];
    const { data: projectsData } = await supabase
      .from('projects').select('id, name').in('id', projectIds);

    const projectsMap = new Map((projectsData || []).map(p => [p.id, p.name as string]));
    setLogs(logsData.map(l => ({ ...l, project_name: projectsMap.get(l.project_id) ?? 'Unknown Project' })));
  }

  async function handleStatusChange(taskId: string, status: TaskStatus) {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status } : t));
    await supabase.from('project_tasks').update({ status, updated_at: new Date().toISOString() }).eq('id', taskId);
  }

  // ── Derived data ──────────────────────────────────────────────────────────

  function applyFilters(list: CrossProjectTask[]): CrossProjectTask[] {
    return list.filter(t => {
      if (taskFilters.priority && t.priority !== taskFilters.priority) return false;
      if (taskFilters.assigneeId && !t.assignees.some(a => a.id === taskFilters.assigneeId)) return false;
      if (taskFilters.projectId && t.project_id !== taskFilters.projectId) return false;
      return true;
    });
  }

  // Raw counts (hero stats — always unfiltered)
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const sevenDaysOut = new Date(today); sevenDaysOut.setDate(sevenDaysOut.getDate() + 7);

  const inProgressAll = tasks.filter(t => t.status === 'in_progress').length;
  const pendingAll    = tasks.filter(t => t.status === 'pending').length;
  const doneAll       = tasks.filter(t => t.status === 'done' || t.status === 'cancelled').length;
  const overdueAll    = tasks.filter(t => t.due_date && new Date(t.due_date) < today && t.status !== 'done' && t.status !== 'cancelled').length;
  const blockedAll    = tasks.filter(t => t.status === 'blocked').length;

  // Filtered task lists (subsections)
  const isActive = (t: CrossProjectTask) => t.status !== 'done' && t.status !== 'cancelled';

  const overdueTasks  = applyFilters(tasks.filter(t => t.due_date && new Date(t.due_date) < today && isActive(t)));
  const blockedTasks  = applyFilters(tasks.filter(t => t.status === 'blocked'));
  const workingOnIt   = applyFilters(tasks.filter(t => t.status === 'in_progress'));
  const upcomingTasks = applyFilters(
    tasks.filter(t => t.due_date && new Date(t.due_date) >= today && new Date(t.due_date) <= sevenDaysOut && isActive(t))
  ).sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime());
  const toDo          = applyFilters(tasks.filter(t => t.status === 'pending'));
  const allDoneTasks  = tasks.filter(t => t.status === 'done' || t.status === 'cancelled');
  const filteredDone  = applyFilters(allDoneTasks);

  const allProjects = [
    ...new Map(tasks.map(t => [t.project_id, { id: t.project_id, name: t.project_name }])).values(),
  ];

  const hasActiveFilters = taskFilters.priority || taskFilters.assigneeId || taskFilters.projectId;

  // Team workload — active tasks per member
  const workload = teamMembers
    .filter(m => m.is_active)
    .map((m, idx) => {
      const mine = tasks.filter(t => isActive(t) && t.assignees.some(a => a.id === m.id));
      return {
        member: m, idx,
        total:      mine.length,
        inProgress: mine.filter(t => t.status === 'in_progress').length,
        pending:    mine.filter(t => t.status === 'pending').length,
        blocked:    mine.filter(t => t.status === 'blocked').length,
      };
    })
    .filter(w => w.total > 0)
    .sort((a, b) => b.total - a.total);

  const maxWorkload = workload[0]?.total ?? 1;

  // Feed — group by project, 3 entries max per project
  const logsByProject = new Map<string, CrossProjectLog[]>();
  for (const log of logs) {
    if (!logsByProject.has(log.project_id)) logsByProject.set(log.project_id, []);
    logsByProject.get(log.project_id)!.push(log);
  }
  const logProjectOrder = [...logsByProject.keys()];

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
    <div className="space-y-5">

      {/* ── Hero stat bar ─────────────────────────────────────────────────── */}
      <div className="glass-indigo px-6 py-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Home</h1>
            <p className="text-sm text-slate-500 mt-0.5">Track tasks and activity across all your projects</p>
          </div>

          {tasks.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/60 border border-blue-200/60 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                <span className="text-sm font-bold text-blue-800 tabular-nums">{inProgressAll}</span>
                <span className="text-xs text-blue-600 font-medium hidden sm:inline">In Progress</span>
              </div>
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
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Pipeline</span>
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
            <Link to="/projects" className="ml-auto flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 font-medium transition-colors flex-shrink-0">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
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
            {recentQuotes.map(q => (
              <div
                key={q.id}
                onClick={() => navigate(`/projects/${q.project_id}/quotations/${q.id}`)}
                className="group p-4 rounded-xl border border-slate-200/60 hover:border-blue-400/60 hover:shadow-md cursor-pointer transition-all bg-white/60 backdrop-blur-sm"
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
                    {formatCurrency(q.total_amount / (exchangeRate || 1), 'USD')}
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
        <div className="glass-white overflow-hidden p-0">
          {/* Header */}
          <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-100/80">
            <div className="p-1.5 rounded-lg bg-blue-100">
              <CheckSquare className="h-4 w-4 text-blue-600" />
            </div>
            <h2 className="text-base font-semibold text-slate-900">Tasks</h2>
            {tasks.length > 0 && (
              <span className="text-xs font-semibold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                {tasks.length}
              </span>
            )}
          </div>

          {tasks.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <CheckSquare className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium">No tasks across any project yet</p>
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
              </div>

              {/* Subsections */}
              <div className="p-4 space-y-3">
                {overdueTasks.length > 0 && (
                  <TaskSubsection
                    variant="red"
                    title="Overdue"
                    tasks={overdueTasks}
                    onNavigate={task => navigate(`/projects/${task.project_id}`)}
                    onStatusChange={handleStatusChange}
                  />
                )}
                {blockedTasks.length > 0 && (
                  <TaskSubsection
                    variant="rose"
                    title="Blocked"
                    tasks={blockedTasks}
                    onNavigate={task => navigate(`/projects/${task.project_id}`)}
                    onStatusChange={handleStatusChange}
                  />
                )}
                <TaskSubsection
                  variant="blue"
                  title="Working on it"
                  tasks={workingOnIt}
                  onNavigate={task => navigate(`/projects/${task.project_id}`)}
                  onStatusChange={handleStatusChange}
                />
                <TaskSubsection
                  variant="amber"
                  title="To-do"
                  tasks={toDo}
                  onNavigate={task => navigate(`/projects/${task.project_id}`)}
                  onStatusChange={handleStatusChange}
                />
                {upcomingTasks.length > 0 && (
                  <TaskSubsection
                    variant="purple"
                    title="Due in 7 days"
                    tasks={upcomingTasks}
                    onNavigate={task => navigate(`/projects/${task.project_id}`)}
                    onStatusChange={handleStatusChange}
                  />
                )}

                {/* Done — collapsible */}
                <div className="rounded-xl border bg-emerald-50/50 border-emerald-100/80 overflow-hidden">
                  <button
                    onClick={() => setDoneExpanded(p => !p)}
                    className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-white/30 transition-colors"
                  >
                    {doneExpanded
                      ? <ChevronDown className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                      : <ChevronRight className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                    }
                    <span className="w-2 h-2 rounded-full flex-shrink-0 bg-emerald-500" />
                    <span className="text-xs font-semibold uppercase tracking-wide flex-1 text-emerald-800">Done</span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                      {hasActiveFilters && filteredDone.length !== allDoneTasks.length
                        ? `${filteredDone.length} / ${allDoneTasks.length}`
                        : allDoneTasks.length}
                    </span>
                  </button>

                  {doneExpanded && (
                    filteredDone.length === 0 ? (
                      <div className="px-4 pb-3 pt-1 text-center">
                        <p className="text-xs font-medium text-emerald-300 opacity-70">No completed tasks match the current filters</p>
                      </div>
                    ) : (
                      <div className="px-3 pb-3 space-y-1.5">
                        {filteredDone.map(task => (
                          <div key={task.id}>
                            <TaskCard
                              task={task}
                              onSelect={() => navigate(`/projects/${task.project_id}`)}
                              onStatusChange={handleStatusChange}
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
              </div>
            </>
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
            <div className="p-4 space-y-3">
              {workload.map(({ member, idx, total, inProgress, pending, blocked: bk }) => (
                <div key={member.id} className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${AVATAR_COLORS[idx % AVATAR_COLORS.length]}`}>
                    {getInitials(member.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-slate-700 truncate">{member.name.split(' ')[0]}</span>
                      <span className="text-xs font-bold text-slate-500 tabular-nums ml-2 flex-shrink-0">{total}</span>
                    </div>
                    {/* Stacked mini bar */}
                    <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden flex">
                      <div className="bg-blue-500 transition-all" style={{ width: `${(inProgress / maxWorkload) * 100}%` }} />
                      <div className="bg-amber-400 transition-all" style={{ width: `${(pending / maxWorkload) * 100}%` }} />
                      {bk > 0 && <div className="bg-rose-500 transition-all" style={{ width: `${(bk / maxWorkload) * 100}%` }} />}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      {inProgress > 0 && <span className="text-[10px] text-blue-600 font-medium">{inProgress} in progress</span>}
                      {pending > 0   && <span className="text-[10px] text-amber-600 font-medium">{pending} pending</span>}
                      {bk > 0        && <span className="text-[10px] text-rose-600 font-medium">{bk} blocked</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Feed */}
        <div className="glass-white overflow-hidden p-0">
          {/* Header */}
          <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-100/80">
            <div className="p-1.5 rounded-lg bg-violet-100">
              <Activity className="h-4 w-4 text-violet-600" />
            </div>
            <h2 className="text-base font-semibold text-slate-900">Feed</h2>
            {logs.length > 0 && (
              <span className="text-xs font-semibold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                {logs.length}
              </span>
            )}
          </div>

          {logs.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <Activity className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium">No log entries yet</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100/80">
              {logProjectOrder.map(projectId => {
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
                            className={`flex gap-2.5 p-2.5 rounded-lg border-l-4 ${cfg.bg} ${cfg.border}`}
                          >
                            <div className={`flex-shrink-0 mt-0.5 ${cfg.color}`}>
                              <Icon className="h-3.5 w-3.5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${cfg.badgeBg} ${cfg.color}`}>
                                  {cfg.label}
                                </span>
                                {log.author_name && (
                                  <span className="text-[10px] text-slate-500 font-medium truncate">{log.author_name}</span>
                                )}
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
  );
}
