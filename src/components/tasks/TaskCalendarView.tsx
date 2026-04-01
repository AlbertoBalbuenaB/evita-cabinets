import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek,
  isSameMonth, isSameDay, isToday, format, addMonths, subMonths,
} from 'date-fns';
import type { EnhancedTask } from '../../types';
import { TASK_PRIORITY_CONFIG } from '../../types';

interface Props {
  tasks: EnhancedTask[];
  onSelect: (id: string) => void;
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function TaskCalendarView({ tasks, onSelect }: Props) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart);
  const calEnd = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  // Group tasks by date (YYYY-MM-DD)
  const tasksByDay: Record<string, EnhancedTask[]> = {};
  for (const task of tasks) {
    if (!task.due_date) continue;
    const key = format(new Date(task.due_date), 'yyyy-MM-dd');
    if (!tasksByDay[key]) tasksByDay[key] = [];
    tasksByDay[key].push(task);
  }

  // Tasks with no due date
  const unscheduled = tasks.filter((t) => !t.due_date);

  return (
    <div className="space-y-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h4 className="text-sm font-semibold text-slate-800">
          {format(currentMonth, 'MMMM yyyy')}
        </h4>
        <button
          onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Grid */}
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200">
          {WEEKDAY_LABELS.map((d) => (
            <div key={d} className="py-2 text-center text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar cells */}
        <div className="grid grid-cols-7">
          {days.map((day, i) => {
            const key = format(day, 'yyyy-MM-dd');
            const dayTasks = tasksByDay[key] || [];
            const inMonth = isSameMonth(day, currentMonth);
            const today = isToday(day);

            return (
              <div
                key={key}
                className={`min-h-[80px] p-1.5 border-b border-r border-slate-100 ${
                  !inMonth ? 'bg-slate-50' : 'bg-white'
                } ${i % 7 === 6 ? 'border-r-0' : ''}`}
              >
                {/* Date number */}
                <div className="mb-1">
                  <span className={`
                    inline-flex w-6 h-6 items-center justify-center rounded-full text-xs font-medium
                    ${today ? 'bg-blue-600 text-white' : inMonth ? 'text-slate-700' : 'text-slate-300'}
                  `}>
                    {format(day, 'd')}
                  </span>
                </div>

                {/* Task chips */}
                <div className="space-y-0.5">
                  {dayTasks.slice(0, 3).map((task) => {
                    const priCfg = TASK_PRIORITY_CONFIG[task.priority];
                    const isDone = task.status === 'done' || task.status === 'cancelled';
                    return (
                      <button
                        key={task.id}
                        onClick={() => onSelect(task.id)}
                        className={`
                          w-full text-left px-1.5 py-0.5 rounded text-[10px] font-medium truncate transition-opacity
                          ${isDone ? 'opacity-50 line-through' : ''}
                          ${priCfg.bg} ${priCfg.color}
                        `}
                      >
                        {task.title}
                      </button>
                    );
                  })}
                  {dayTasks.length > 3 && (
                    <p className="text-[9px] text-slate-400 px-1">+{dayTasks.length - 3} more</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Unscheduled tasks */}
      {unscheduled.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
            No due date ({unscheduled.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {unscheduled.map((task) => {
              const priCfg = TASK_PRIORITY_CONFIG[task.priority];
              return (
                <button
                  key={task.id}
                  onClick={() => onSelect(task.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium ${priCfg.bg} ${priCfg.color} hover:opacity-80 transition-opacity`}
                >
                  {task.title}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
