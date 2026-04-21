import { useState } from 'react';
import { Plus, Trash2, ExternalLink } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { TaskDeliverable } from '../../types';

interface Props {
  taskId: string;
  deliverables: TaskDeliverable[];
  onChange: (d: TaskDeliverable[]) => void;
}

export function TaskDeliverables({ taskId, deliverables, onChange }: Props) {
  const [newLabel, setNewLabel] = useState('');
  const [newUrl, setNewUrl] = useState('');

  async function add() {
    if (!newLabel.trim()) return;
    const { data } = await supabase
      .from('task_deliverables')
      .insert({
        task_id: taskId,
        label: newLabel.trim(),
        url: newUrl.trim(),
        display_order: deliverables.length,
      })
      .select()
      .single();
    if (data) {
      onChange([...deliverables, data]);
      setNewLabel('');
      setNewUrl('');
    }
  }

  async function updateLabel(id: string, label: string) {
    onChange(deliverables.map((d) => d.id === id ? { ...d, label } : d));
    await supabase.from('task_deliverables').update({ label }).eq('id', id);
  }

  async function updateUrl(id: string, url: string) {
    onChange(deliverables.map((d) => d.id === id ? { ...d, url } : d));
    await supabase.from('task_deliverables').update({ url }).eq('id', id);
  }

  async function remove(id: string) {
    onChange(deliverables.filter((d) => d.id !== id));
    await supabase.from('task_deliverables').delete().eq('id', id);
  }

  return (
    <div className="space-y-2">
      {deliverables.map((d) => (
        <div key={d.id} className="flex items-center gap-2 group">
          <input
            type="text"
            value={d.label}
            onChange={(e) => updateLabel(d.id, e.target.value)}
            placeholder="Label"
            className="w-24 text-xs border border-border-soft rounded px-2 py-1 focus:outline-none focus:ring-1 focus-visible:ring-focus flex-shrink-0"
          />
          <input
            type="url"
            value={d.url}
            onChange={(e) => updateUrl(d.id, e.target.value)}
            placeholder="https://…"
            className="flex-1 text-xs border border-border-soft rounded px-2 py-1 focus:outline-none focus:ring-1 focus-visible:ring-focus"
          />
          {d.url && (
            <a
              href={d.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:text-accent-text flex-shrink-0"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          <button
            onClick={() => remove(d.id)}
            className="opacity-0 group-hover:opacity-100 text-fg-300 hover:text-red-500 transition-all flex-shrink-0"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}

      {/* Add row */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="Label"
          className="w-24 text-xs border border-dashed border-border-solid rounded px-2 py-1 focus:outline-none focus:ring-1 focus-visible:ring-focus flex-shrink-0"
          onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
        />
        <input
          type="url"
          value={newUrl}
          onChange={(e) => setNewUrl(e.target.value)}
          placeholder="https://… (optional)"
          className="flex-1 text-xs border border-dashed border-border-solid rounded px-2 py-1 focus:outline-none focus:ring-1 focus-visible:ring-focus"
          onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
        />
        <button
          onClick={add}
          disabled={!newLabel.trim()}
          className="text-accent-text hover:text-accent-text disabled:text-fg-300 transition-colors flex-shrink-0"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
