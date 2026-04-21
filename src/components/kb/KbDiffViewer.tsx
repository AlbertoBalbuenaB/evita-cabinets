import { useMemo } from 'react';
import { diffLines, diffWordsWithSpace } from 'diff';

interface KbDiffViewerProps {
  before: string;
  after: string;
  mode?: 'line' | 'word';
  label?: { before: string; after: string };
}

export function KbDiffViewer({ before, after, mode = 'line', label }: KbDiffViewerProps) {
  const changes = useMemo(() => {
    return mode === 'word' ? diffWordsWithSpace(before, after) : diffLines(before, after);
  }, [before, after, mode]);

  if (before === after) {
    return (
      <div className="glass-white rounded-xl p-4 text-sm text-fg-500 italic">
        Sin cambios en el contenido.
      </div>
    );
  }

  return (
    <div className="glass-white rounded-xl overflow-hidden">
      {label && (
        <div className="grid grid-cols-2 border-b border-border-soft text-xs font-medium text-fg-600">
          <div className="px-3 py-1.5 bg-status-red-bg">− {label.before}</div>
          <div className="px-3 py-1.5 bg-status-emerald-bg">+ {label.after}</div>
        </div>
      )}
      <pre className="text-xs font-mono leading-relaxed overflow-x-auto p-3 whitespace-pre-wrap">
        {changes.map((part, i) => {
          if (part.added) {
            return (
              <span key={i} className="bg-status-emerald-bg text-emerald-900">
                {part.value}
              </span>
            );
          }
          if (part.removed) {
            return (
              <span key={i} className="bg-status-red-bg text-rose-900 line-through">
                {part.value}
              </span>
            );
          }
          return (
            <span key={i} className="text-fg-700">
              {part.value}
            </span>
          );
        })}
      </pre>
    </div>
  );
}
