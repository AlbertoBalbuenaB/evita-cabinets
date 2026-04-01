import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { EnhancedTask, TaskStatus } from '../../types';
import { TASK_STATUS_CONFIG, TASK_STATUS_ORDER } from '../../types';
import { TaskCard } from './TaskCard';

interface Props {
  tasks: EnhancedTask[];
  selectedTaskId: string | null;
  onSelect: (id: string) => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
}

// Group by status in display order
const STATUS_GROUPS = (Object.keys(TASK_STATUS_ORDER) as TaskStatus[]).sort(
  (a, b) => TASK_STATUS_ORDER[a] - TASK_STATUS_ORDER[b]
);

export function TaskListView({ tasks, selectedTaskId, onSelect, onStatusChange }: Props) {
  const [collapsed, setCollapsed] = useState<Set<TaskStatus>>(new Set(['done', 'cancelled']));

  function toggle(status: TaskStatus) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  }

  // Group tasks by status
  const grouped: Partial<Record<TaskStatus, EnhancedTask[]>> = {};
  for (const task of tasks) {
    if (!grouped[task.status]) grouped[task.status] = [];
    grouped[task.status]!.push(task);
  }

  const hasAny = tasks.length > 0;

  if (!hasAny) {
    return (
      <p className="text-sm text-slate-400 text-center py-4">No tasks match the current filters.</p>
    );
  }

  return (
    <div className="space-y-4">
      {STATUS_GROUPS.map((status) => {
        const group = grouped[status];
        if (!group || group.length === 0) return null;
        const cfg = TASK_STATUS_CONFIG[status];
        const isCollapsed = collapsed.has(status);

        return (
          <div key={status}>
            {/* Group header */}
            <button
              onClick={() => toggle(status)}
              className="flex items-center gap-2 w-full text-left mb-2 group"
            >
              {isCollapsed
                ? <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                : <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              }
              <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                {cfg.label}
              </span>
              <span className="text-xs text-slate-400 font-medium">{group.length}</span>
            </button>

            {/* Tasks */}
            {!isCollapsed && (
              <div className="space-y-2 pl-5">
                {group.map((task) => (
                  <div key={task.id}>
                    <TaskCard
                      task={task}
                      selected={selectedTaskId === task.id}
                      onSelect={onSelect}
                      onStatusChange={onStatusChange}
                    />
                    {/* Subtasks */}
                    {task.subtasks.length > 0 && (
                      <div className="mt-1 ml-5 space-y-1">
                        {task.subtasks.map((sub) => (
                          <TaskCard
                            key={sub.id}
                            task={sub}
                            selected={selectedTaskId === sub.id}
                            onSelect={onSelect}
                            onStatusChange={onStatusChange}
                            compact
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
