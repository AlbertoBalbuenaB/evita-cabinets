import { History } from 'lucide-react';
import type { KbEntryVersion } from '../../lib/kb/kbTypes';

interface KbVersionTimelineProps {
  versions: KbEntryVersion[];
  currentVersion: number;
  memberNames: Record<string, string>;
}

export function KbVersionTimeline({ versions, currentVersion, memberNames }: KbVersionTimelineProps) {
  if (versions.length === 0) return null;

  return (
    <div className="glass-white rounded-2xl p-4 sm:p-5">
      <h3 className="text-sm font-semibold text-slate-900 mb-3 uppercase tracking-wide flex items-center gap-2">
        <History className="w-4 h-4 text-indigo-500" />
        Version history
      </h3>
      <ul className="space-y-2">
        {versions.map((v) => {
          const isCurrent = v.version_num === currentVersion;
          const editor = v.edited_by ? memberNames[v.edited_by] ?? 'Unknown' : 'System';
          return (
            <li
              key={v.id}
              className={`flex items-start gap-3 p-2 rounded-lg ${
                isCurrent ? 'bg-indigo-50/60 border border-indigo-200/60' : ''
              }`}
            >
              <span className="font-mono text-xs text-indigo-700 font-semibold w-10">v{v.version_num}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-800 truncate">{v.edit_summary ?? 'No summary'}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {editor} · {new Date(v.created_at).toLocaleString()}
                  {isCurrent && <span className="ml-2 text-indigo-700 font-medium">current</span>}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
