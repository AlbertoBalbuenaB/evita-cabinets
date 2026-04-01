import { useState, useRef } from 'react';
import { Plus } from 'lucide-react';
import type { EnhancedTask, TaskStatus } from '../../types';
import { TASK_STATUS_CONFIG, TASK_STATUS_ORDER } from '../../types';
import { TaskCard } from './TaskCard';

interface Props {
  tasks: EnhancedTask[];
  selectedTaskId: string | null;
  onSelect: (id: string) => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
}

const COLUMN_ORDER = (Object.keys(TASK_STATUS_ORDER) as TaskStatus[]).sort(
  (a, b) => TASK_STATUS_ORDER[a] - TASK_STATUS_ORDER[b]
);

export function TaskKanbanView({ tasks, selectedTaskId, onSelect, onStatusChange }: Props) {
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<TaskStatus | null>(null);

  // Group tasks by status
  const grouped: Partial<Record<TaskStatus, EnhancedTask[]>> = {};
  for (const task of tasks) {
    if (!grouped[task.status]) grouped[task.status] = [];
    grouped[task.status]!.push(task);
  }

  function handleDragStart(e: React.DragEvent, taskId: string) {
    setDragTaskId(taskId);
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(e: React.DragEvent, status: TaskStatus) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverStatus(status);
  }

  function handleDrop(e: React.DragEvent, status: TaskStatus) {
    e.preventDefault();
    if (dragTaskId) {
      const task = tasks.find((t) => t.id === dragTaskId);
      if (task && task.status !== status) {
        onStatusChange(dragTaskId, status);
      }
    }
    setDragTaskId(null);
    setDragOverStatus(null);
  }

  function handleDragEnd() {
    setDragTaskId(null);
    setDragOverStatus(null);
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {COLUMN_ORDER.map((status) => {
        const cfg = TASK_STATUS_CONFIG[status];
        const columnTasks = grouped[status] || [];
        const isDragTarget = dragOverStatus === status;

        return (
          <div
            key={status}
            className={`flex-shrink-0 w-60 flex flex-col rounded-xl transition-colors ${
              isDragTarget ? 'bg-blue-50 ring-2 ring-blue-300' : 'bg-slate-50'
            }`}
            onDragOver={(e) => handleDragOver(e, status)}
            onDrop={(e) => handleDrop(e, status)}
            onDragLeave={() => setDragOverStatus(null)}
          >
            {/* Column header */}
            <div className="flex items-center gap-2 px-3 py-2.5">
              <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide flex-1">
                {cfg.label}
              </span>
              <span className="text-xs text-slate-400 font-medium bg-white rounded-full w-5 h-5 flex items-center justify-center">
                {columnTasks.length}
              </span>
            </div>

            {/* Cards */}
            <div className="flex-1 px-2 pb-2 space-y-2 min-h-[80px]">
              {columnTasks.map((task) => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, task.id)}
                  onDragEnd={handleDragEnd}
                  className={`cursor-grab active:cursor-grabbing transition-opacity ${
                    dragTaskId === task.id ? 'opacity-50' : ''
                  }`}
                >
                  <TaskCard
                    task={task}
                    selected={selectedTaskId === task.id}
                    onSelect={onSelect}
                    onStatusChange={onStatusChange}
                    compact
                  />
                </div>
              ))}
              {columnTasks.length === 0 && !isDragTarget && (
                <div className="h-12 border-2 border-dashed border-slate-200 rounded-lg flex items-center justify-center">
                  <span className="text-[10px] text-slate-300">Drop here</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
