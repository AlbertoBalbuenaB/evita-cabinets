import { Link } from 'react-router-dom';
import { AlertCircle, FileText } from 'lucide-react';
import type { KbCategory, KbEntryListItem } from '../../lib/kb/kbTypes';

interface KbEntryCardProps {
  entry: KbEntryListItem;
  category?: KbCategory;
}

export function KbEntryCard({ entry, category }: KbEntryCardProps) {
  return (
    <Link
      to={`/kb/${entry.slug}`}
      className="glass-white rounded-xl p-4 block transition hover:bg-indigo-50/30 hover:shadow-md card-enter"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="w-4 h-4 text-indigo-500 flex-shrink-0" />
          <h3 className="text-sm font-semibold text-slate-900 truncate">{entry.title}</h3>
        </div>
        {entry.needs_enrichment && (
          <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" aria-label="Needs enrichment" />
        )}
      </div>
      <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
        {category?.section_num && <span className="font-mono">{category.section_num}</span>}
        {category?.name && <span>· {category.name}</span>}
        <span className="text-slate-400">·</span>
        <span className="text-slate-500 font-mono text-[10px]">{entry.entry_type}</span>
      </div>
      {entry.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {entry.tags.slice(0, 5).map((t) => (
            <span key={t} className="px-1.5 py-0.5 rounded bg-slate-100/70 text-[10px] text-slate-600 font-mono">
              {t}
            </span>
          ))}
          {entry.tags.length > 5 && (
            <span className="text-[10px] text-slate-400">+{entry.tags.length - 5}</span>
          )}
        </div>
      )}
    </Link>
  );
}
