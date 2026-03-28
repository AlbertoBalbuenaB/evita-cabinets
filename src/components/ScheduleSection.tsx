import { useState, useEffect, useRef } from 'react';
import { CalendarDays, Trash2, Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button } from './Button';
import type { ProjectActivity } from '../types';

interface Props {
  projectId: string;
}

export function ScheduleSection({ projectId }: Props) {
  const [activities, setActivities] = useState<ProjectActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const editRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadActivities();
  }, [projectId]);

  useEffect(() => {
    if (editingId && editRef.current) {
      editRef.current.focus();
      editRef.current.select();
    }
  }, [editingId]);

  async function loadActivities() {
    try {
      const { data, error } = await supabase
        .from('project_activities')
        .select('*')
        .eq('project_id', projectId)
        .order('display_order');

      if (error) throw error;
      setActivities(data || []);
    } catch (error) {
      console.error('Error loading activities:', error);
    } finally {
      setLoading(false);
    }
  }

  async function addActivity() {
    if (!newName.trim() || !newStart || !newEnd) return;

    const optimistic: ProjectActivity = {
      id: crypto.randomUUID(),
      project_id: projectId,
      name: newName,
      start_date: newStart,
      end_date: newEnd,
      display_order: activities.length,
      created_at: new Date().toISOString(),
    };

    setActivities((prev) => [...prev, optimistic]);
    setNewName('');
    setNewStart('');
    setNewEnd('');

    try {
      const { error } = await supabase.from('project_activities').insert({
        project_id: projectId,
        name: optimistic.name,
        start_date: optimistic.start_date,
        end_date: optimistic.end_date,
        display_order: optimistic.display_order,
      });
      if (error) throw error;
      loadActivities();
    } catch (error) {
      console.error('Error adding activity:', error);
      setActivities((prev) => prev.filter((a) => a.id !== optimistic.id));
    }
  }

  async function deleteActivity(id: string) {
    const prev = [...activities];
    setActivities((a) => a.filter((x) => x.id !== id));

    try {
      const { error } = await supabase.from('project_activities').delete().eq('id', id);
      if (error) throw error;
    } catch (error) {
      console.error('Error deleting activity:', error);
      setActivities(prev);
    }
  }

  async function updateActivityName(id: string, name: string) {
    setEditingId(null);
    if (!name.trim()) return;

    const prev = [...activities];
    setActivities((a) => a.map((x) => (x.id === id ? { ...x, name } : x)));

    try {
      const { error } = await supabase.from('project_activities').update({ name }).eq('id', id);
      if (error) throw error;
    } catch (error) {
      console.error('Error updating activity name:', error);
      setActivities(prev);
    }
  }

  async function updateActivityDate(id: string, field: 'start_date' | 'end_date', value: string) {
    const prev = [...activities];
    setActivities((a) => a.map((x) => (x.id === id ? { ...x, [field]: value } : x)));

    try {
      const { error } = await supabase
        .from('project_activities')
        .update({ [field]: value })
        .eq('id', id);
      if (error) throw error;
    } catch (error) {
      console.error('Error updating activity date:', error);
      setActivities(prev);
    }
  }

  function getDurationDays(start: string, end: string): number {
    const s = new Date(start);
    const e = new Date(end);
    const diff = (e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24);
    return Math.max(diff, 1);
  }

  const maxDuration = activities.reduce((max, a) => {
    return Math.max(max, getDurationDays(a.start_date, a.end_date));
  }, 1);

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="animate-pulse h-6 bg-slate-100 rounded w-32" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <div className="flex items-center mb-4">
        <CalendarDays className="h-5 w-5 text-blue-600 mr-2" />
        <h3 className="text-lg font-semibold text-slate-900">Schedule</h3>
      </div>

      {activities.length === 0 ? (
        <div className="py-8 text-center text-slate-400">
          <CalendarDays className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No activities scheduled yet</p>
        </div>
      ) : (
        <div className="space-y-2 mb-4">
          {activities.map((activity) => {
            const duration = getDurationDays(activity.start_date, activity.end_date);
            const barWidth = (duration / maxDuration) * 100;

            return (
              <div key={activity.id} className="flex items-center gap-3 group">
                <div className="w-40 flex-shrink-0">
                  {editingId === activity.id ? (
                    <input
                      ref={editRef}
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onBlur={() => updateActivityName(activity.id, editingName)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') updateActivityName(activity.id, editingName);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      className="w-full px-2 py-1 text-sm border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <button
                      onClick={() => {
                        setEditingId(activity.id);
                        setEditingName(activity.name);
                      }}
                      className="text-sm font-medium text-slate-700 hover:text-blue-600 truncate block w-full text-left"
                    >
                      {activity.name}
                    </button>
                  )}
                </div>
                <input
                  type="date"
                  value={activity.start_date}
                  onChange={(e) => updateActivityDate(activity.id, 'start_date', e.target.value)}
                  className="text-xs px-2 py-1 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="date"
                  value={activity.end_date}
                  onChange={(e) => updateActivityDate(activity.id, 'end_date', e.target.value)}
                  className="text-xs px-2 py-1 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex-1 bg-slate-200 rounded h-2">
                  <div
                    className="bg-blue-400 h-2 rounded"
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
                <button
                  onClick={() => deleteActivity(activity.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-500"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="pt-3 border-t border-slate-200">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className="block text-xs text-slate-600 mb-1">Activity</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Activity name"
              className="block w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyDown={(e) => { if (e.key === 'Enter') addActivity(); }}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Start</label>
            <input
              type="date"
              value={newStart}
              onChange={(e) => setNewStart(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">End</label>
            <input
              type="date"
              value={newEnd}
              onChange={(e) => setNewEnd(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <Button onClick={addActivity} disabled={!newName.trim() || !newStart || !newEnd} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}
