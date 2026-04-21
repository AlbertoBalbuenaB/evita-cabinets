import { MessageSquare, Paperclip, CheckSquare, Clock } from 'lucide-react';
import { format, isPast, isToday } from 'date-fns';
import type { EnhancedTask, TaskStatus } from '../../types';
import { TASK_STATUS_CONFIG, TASK_PRIORITY_CONFIG } from '../../types';

interface Props {
  task: EnhancedTask;
  selected?: boolean;
  onSelect: (id: string) => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
  compact?: boolean;
}

const STATUS_ORDER_CYCLE: TaskStatus[] = ['pending', 'in_progress', 'in_review', 'blocked', 'done', 'cancelled'];

const AVATAR_COLORS = [
  'bg-accent-tint-soft text-accent-text',
  'bg-accent-tint-soft text-accent-text',
  'bg-status-amber-bg text-status-amber-fg',
  'bg-status-emerald-bg text-status-emerald-fg',
  'bg-status-red-bg text-status-red-fg',
];

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function formatDue(date: string | null): { text: string; urgent: boolean } | null {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  const urgent = isPast(d) || isToday(d);
  const text = isToday(d)
    ? 'Today'
    : format(d, 'MMM d');
  return { text, urgent };
}

export function TaskCard({ task, selected, onSelect, onStatusChange, compact }: Props) {
  const statusCfg = TASK_STATUS_CONFIG[task.status] ?? TASK_STATUS_CONFIG.pending;
  const priorityCfg = TASK_PRIORITY_CONFIG[task.priority] ?? TASK_PRIORITY_CONFIG.medium;
  const due = formatDue(task.due_date);
  const isDone = task.status === 'done' || task.status === 'cancelled';

  function cycleStatus(e: React.MouseEvent) {
    e.stopPropagation();
    const idx = STATUS_ORDER_CYCLE.indexOf(task.status);
    const next = STATUS_ORDER_CYCLE[(idx + 1) % STATUS_ORDER_CYCLE.length];
    onStatusChange(task.id, next);
  }

  return (
    <div
      onClick={() => onSelect(task.id)}
      className={`
        task-enter group relative cursor-pointer rounded-xl border-l-4 bg-surf-card backdrop-blur-sm p-3 shadow-sm
        hover:shadow-md hover:border-accent-tint-border transition-all duration-200
        ${priorityCfg.border}
        ${selected ? 'ring-2 ring-blue-400/70 ring-offset-1 border-accent-tint-border' : 'border border-white/80'}
        ${isDone ? 'opacity-60' : ''}
      `}
    >
      <div className="flex items-start gap-2.5">
        {/* Status dot button */}
        <button
          onClick={cycleStatus}
          title={`Status: ${statusCfg.label} — click to advance`}
          className="mt-0.5 flex-shrink-0"
        >
          <span className={`block w-3 h-3 rounded-full ${statusCfg.dot} transition-transform hover:scale-125`} />
        </button>

        <div className="flex-1 min-w-0">
          {/* Title */}
          <p className={`text-sm font-medium leading-snug ${isDone ? 'line-through text-fg-400' : 'text-fg-800'}`}>
            {task.title}
          </p>

          {/* Description snippet */}
          {!compact && (task.description || task.details) && (
            <p className="text-xs text-fg-400 mt-0.5 line-clamp-1">
              {task.description || task.details}
            </p>
          )}

          {/* Meta row */}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {/* Status badge */}
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium backdrop-blur-sm ${statusCfg.color}`}>
              {statusCfg.label}
            </span>

            {/* Priority badge */}
            <span className={`text-[10px] font-semibold ${priorityCfg.color}`}>
              {priorityCfg.label}
            </span>

            {/* Tags */}
            {task.tags.slice(0, 2).map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium text-white"
                style={{ backgroundColor: tag.color }}
              >
                {tag.label}
              </span>
            ))}
            {task.tags.length > 2 && (
              <span className="text-[10px] text-fg-400">+{task.tags.length - 2}</span>
            )}

            {/* Due date */}
            {due && (
              <span className={`flex items-center gap-0.5 text-[10px] font-medium ${due.urgent ? 'text-red-500' : 'text-fg-400'}`}>
                <Clock className="h-2.5 w-2.5" />
                {due.text}
              </span>
            )}
          </div>

          {/* Bottom row: assignees + counters */}
          {!compact && (
            <div className="flex items-center justify-between mt-2">
              {/* Assignee avatars */}
              <div className="flex -space-x-1.5">
                {task.assignees.slice(0, 4).map((a, i) => (
                  <span
                    key={a.id}
                    title={a.name}
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ring-2 ring-white/80 ${AVATAR_COLORS[i % AVATAR_COLORS.length]}`}
                  >
                    {getInitials(a.name)}
                  </span>
                ))}
                {task.assignees.length > 4 && (
                  <span className="w-5 h-5 rounded-full bg-surf-muted text-fg-500 flex items-center justify-center text-[9px] font-bold ring-1 ring-white">
                    +{task.assignees.length - 4}
                  </span>
                )}
              </div>

              {/* Counters */}
              <div className="flex items-center gap-2 text-fg-300">
                {task.subtasks.length > 0 && (
                  <span className="flex items-center gap-0.5 text-[10px]">
                    <CheckSquare className="h-3 w-3" />
                    {task.subtasks.filter((s) => s.status === 'done').length}/{task.subtasks.length}
                  </span>
                )}
                {task.comments.length > 0 && (
                  <span className="flex items-center gap-0.5 text-[10px]">
                    <MessageSquare className="h-3 w-3" />
                    {task.comments.length}
                  </span>
                )}
                {task.deliverables.length > 0 && (
                  <span className="flex items-center gap-0.5 text-[10px]">
                    <Paperclip className="h-3 w-3" />
                    {task.deliverables.length}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
