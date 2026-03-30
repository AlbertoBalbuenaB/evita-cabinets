import { useState } from 'react';
import { GripVertical, Pencil, Trash2 } from 'lucide-react';
import type { AreaSection } from '../types';

interface SectionDividerProps {
  section: AreaSection;
  onRename: (newName: string) => void;
  onDelete: () => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragOver?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop?: (e: React.DragEvent<HTMLDivElement>) => void;
  isDropTarget?: boolean;
}

export function SectionDivider({
  section,
  onRename,
  onDelete,
  draggable,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  isDropTarget,
}: SectionDividerProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(section.name);

  function commitRename() {
    const trimmed = name.trim();
    if (trimmed && trimmed !== section.name) {
      onRename(trimmed);
    } else {
      setName(section.name);
    }
    setEditing(false);
  }

  return (
    <div
      className={`relative flex items-center gap-2 py-2 group select-none ${isDropTarget ? 'ring-2 ring-blue-400 ring-offset-1 rounded' : ''}`}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {draggable && (
        <div className="flex-shrink-0 cursor-grab active:cursor-grabbing p-1 rounded hover:bg-slate-100 transition-colors" title="Drag to reorder">
          <GripVertical className="h-4 w-4 text-slate-300" />
        </div>
      )}

      {editing ? (
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitRename();
            if (e.key === 'Escape') { setName(section.name); setEditing(false); }
          }}
          className="text-sm font-semibold text-slate-600 bg-transparent border-b border-slate-400 outline-none min-w-[8rem]"
        />
      ) : (
        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">
          {section.name}
        </span>
      )}

      <div className="flex-1 h-px bg-slate-200" />

      <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => { setName(section.name); setEditing(true); }}
          className="p-1 rounded hover:bg-slate-100 transition-colors"
          title="Rename section"
        >
          <Pencil className="h-3.5 w-3.5 text-slate-400 hover:text-slate-600" />
        </button>
        <button
          onClick={onDelete}
          className="p-1 rounded hover:bg-red-50 transition-colors"
          title="Delete section"
        >
          <Trash2 className="h-3.5 w-3.5 text-slate-400 hover:text-red-500" />
        </button>
      </div>
    </div>
  );
}
