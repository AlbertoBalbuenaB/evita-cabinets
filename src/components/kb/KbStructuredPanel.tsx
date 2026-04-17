import type { Json } from '../../lib/database.types';
import { isStructuredObject } from '../../lib/kb/kbTypes';

interface KbStructuredPanelProps {
  data: Json | null;
}

function renderValue(value: Json): React.ReactNode {
  if (value === null || value === undefined) return <span className="text-slate-400">—</span>;
  if (typeof value === 'string') return <span className="text-slate-700">{value}</span>;
  if (typeof value === 'number') return <span className="font-mono text-slate-800">{value}</span>;
  if (typeof value === 'boolean') return <span className="font-mono text-slate-700">{value ? 'true' : 'false'}</span>;
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-slate-400">[]</span>;
    if (value.every((v) => typeof v === 'string' || typeof v === 'number')) {
      return (
        <div className="flex flex-wrap gap-1.5">
          {value.map((v, i) => (
            <span key={i} className="px-2 py-0.5 text-xs rounded-md bg-indigo-50 text-indigo-700 font-mono">
              {String(v)}
            </span>
          ))}
        </div>
      );
    }
    return (
      <pre className="text-xs font-mono text-slate-700 bg-slate-50/70 rounded-lg p-2 overflow-x-auto">
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  }
  if (isStructuredObject(value)) {
    return (
      <pre className="text-xs font-mono text-slate-700 bg-slate-50/70 rounded-lg p-2 overflow-x-auto">
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  }
  return <span className="text-slate-700">{String(value)}</span>;
}

function humanizeKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function KbStructuredPanel({ data }: KbStructuredPanelProps) {
  if (!isStructuredObject(data)) return null;
  const entries = Object.entries(data);
  if (entries.length === 0) return null;

  return (
    <div className="glass-white rounded-2xl p-4 sm:p-5">
      <h3 className="text-sm font-semibold text-slate-900 mb-3 uppercase tracking-wide">Structured Data</h3>
      <dl className="divide-y divide-slate-200/60">
        {entries.map(([key, value]) => (
          <div key={key} className="grid grid-cols-1 sm:grid-cols-3 gap-2 py-2">
            <dt className="text-sm font-medium text-slate-600">{humanizeKey(key)}</dt>
            <dd className="sm:col-span-2 text-sm">{renderValue(value)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
