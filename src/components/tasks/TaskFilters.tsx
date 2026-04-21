import { X } from 'lucide-react';
import type { TeamMember, TaskTag, TaskStatus, TaskPriority } from '../../types';
import { TASK_STATUS_CONFIG, TASK_PRIORITY_CONFIG } from '../../types';
import type { TaskFilterState } from './TasksSection';

interface Props {
  filters: TaskFilterState;
  onFiltersChange: (f: TaskFilterState) => void;
  teamMembers: TeamMember[];
  tags: TaskTag[];
}

const STATUS_OPTIONS = Object.entries(TASK_STATUS_CONFIG) as [TaskStatus, typeof TASK_STATUS_CONFIG[TaskStatus]][];
const PRIORITY_OPTIONS = Object.entries(TASK_PRIORITY_CONFIG) as [TaskPriority, typeof TASK_PRIORITY_CONFIG[TaskPriority]][];

function hasActiveFilters(f: TaskFilterState) {
  return f.assigneeId || f.status || f.priority || f.tagId;
}

export function TaskFilters({ filters, onFiltersChange, teamMembers, tags }: Props) {
  function set(patch: Partial<TaskFilterState>) {
    onFiltersChange({ ...filters, ...patch });
  }

  const activeMembers = teamMembers.filter((m) => m.is_active);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Assignee filter pills */}
      <div className="flex items-center gap-1 flex-wrap">
        <button
          onClick={() => set({ assigneeId: '' })}
          className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-150 ${
            !filters.assigneeId
              ? 'bg-accent-primary text-accent-on shadow-sm'
              : 'bg-surf-card backdrop-blur-sm border border-border-soft text-fg-600 hover:border-accent-tint-border hover:bg-surf-card'
          }`}
        >
          All
        </button>
        {activeMembers.map((m) => (
          <button
            key={m.id}
            onClick={() => set({ assigneeId: m.id === filters.assigneeId ? '' : m.id })}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-150 ${
              filters.assigneeId === m.id
                ? 'bg-accent-primary text-accent-on shadow-sm'
                : 'bg-surf-card backdrop-blur-sm border border-border-soft text-fg-600 hover:border-accent-tint-border hover:bg-surf-card'
            }`}
          >
            {m.name.split(' ')[0]}
          </button>
        ))}
      </div>

      {/* Divider */}
      {(activeMembers.length > 0) && <div className="w-px h-5 bg-surf-muted" />}

      {/* Status filter */}
      <select
        value={filters.status}
        onChange={(e) => set({ status: e.target.value as TaskStatus | '' })}
        className="text-xs border border-border-soft rounded-lg px-2 py-1 bg-surf-card backdrop-blur-sm text-fg-600 focus:outline-none focus:ring-2 focus-visible:ring-focus focus:border-transparent"
      >
        <option value="">All statuses</option>
        {STATUS_OPTIONS.map(([val, cfg]) => (
          <option key={val} value={val}>{cfg.label}</option>
        ))}
      </select>

      {/* Priority filter */}
      <select
        value={filters.priority}
        onChange={(e) => set({ priority: e.target.value as TaskPriority | '' })}
        className="text-xs border border-border-soft rounded-lg px-2 py-1 bg-surf-card backdrop-blur-sm text-fg-600 focus:outline-none focus:ring-2 focus-visible:ring-focus focus:border-transparent"
      >
        <option value="">All priorities</option>
        {PRIORITY_OPTIONS.map(([val, cfg]) => (
          <option key={val} value={val}>{cfg.label}</option>
        ))}
      </select>

      {/* Tag filter */}
      {tags.length > 0 && (
        <select
          value={filters.tagId}
          onChange={(e) => set({ tagId: e.target.value })}
          className="text-xs border border-border-soft rounded-lg px-2 py-1 bg-surf-card backdrop-blur-sm text-fg-600 focus:outline-none focus:ring-2 focus-visible:ring-focus focus:border-transparent"
        >
          <option value="">All tags</option>
          {tags.map((tag) => (
            <option key={tag.id} value={tag.id}>{tag.label}</option>
          ))}
        </select>
      )}

      {/* Clear filters */}
      {hasActiveFilters(filters) && (
        <button
          onClick={() => onFiltersChange({ assigneeId: '', status: '', priority: '', tagId: '' })}
          className="flex items-center gap-1 px-2 py-1 text-xs text-fg-400 hover:text-fg-700 transition-colors"
        >
          <X className="h-3 w-3" />
          Clear
        </button>
      )}
    </div>
  );
}
