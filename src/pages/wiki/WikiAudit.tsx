import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';
import { fetchWikiAuditLog } from '../../lib/wiki/wikiApi';
import { fetchMemberNames } from '../../lib/kb/kbApi';
import type { WikiAuditRow } from '../../lib/wiki/wikiTypes';

function styleForAction(action: string) {
  if (action.startsWith('proposal.')) {
    if (action.endsWith('.merge')) return { bg: 'bg-accent-tint-soft', text: 'text-violet-800' };
    if (action.includes('_to_approved'))  return { bg: 'bg-status-emerald-bg', text: 'text-emerald-800' };
    if (action.includes('_to_rejected'))  return { bg: 'bg-status-red-bg',    text: 'text-rose-800' };
    if (action.includes('_to_changes_requested')) return { bg: 'bg-status-amber-bg', text: 'text-amber-800' };
    if (action.includes('_to_withdrawn')) return { bg: 'bg-surf-muted',   text: 'text-fg-700' };
    if (action.includes('_to_open'))      return { bg: 'bg-accent-tint-strong',  text: 'text-indigo-800' };
  }
  return { bg: 'bg-surf-muted', text: 'text-fg-700' };
}

export function WikiAudit() {
  const [rows, setRows]       = useState<WikiAuditRow[]>([]);
  const [members, setMembers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([fetchWikiAuditLog(200), fetchMemberNames()])
      .then(([r, m]) => {
        if (!active) return;
        setRows(r);
        setMembers(m);
      })
      .catch((err) => active && setError(err.message ?? 'Fetch failed'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5 page-enter">
      <Link to="/wiki" className="inline-flex items-center gap-1 text-sm text-accent-text hover:text-violet-800">
        <ArrowLeft className="w-4 h-4" /> Wiki
      </Link>

      <div className="glass-indigo rounded-2xl p-5 sm:p-6 hero-enter">
        <div className="flex items-start gap-3">
          <Shield className="w-6 h-6 text-accent-text mt-1" />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-fg-900">Wiki audit log</h1>
            <p className="text-sm text-fg-700 mt-1">
              Registro inmutable de mutaciones del Wiki: merges, cambios de estado de propuestas.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="glass-white rounded-xl p-4 border border-status-red-brd text-sm text-status-red-fg">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass-white rounded-xl h-14 skeleton-shimmer" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="glass-white rounded-2xl p-8 text-center text-fg-500">
          Sin eventos registrados todavía.
        </div>
      ) : (
        <div className="glass-white rounded-2xl overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-surf-app">
              <tr className="border-b border-border-soft">
                <th className="text-left px-3 py-2 font-semibold text-fg-800">When</th>
                <th className="text-left px-3 py-2 font-semibold text-fg-800">Actor</th>
                <th className="text-left px-3 py-2 font-semibold text-fg-800">Action</th>
                <th className="text-left px-3 py-2 font-semibold text-fg-800">Article / Proposal</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const style = styleForAction(row.action);
                const actor = row.actor_id ? members[row.actor_id] ?? 'Unknown' : 'System';
                return (
                  <tr key={row.id} className="border-b border-border-soft row-enter">
                    <td className="px-3 py-2 text-fg-600 whitespace-nowrap">
                      {new Date(row.created_at).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-fg-800">{actor}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${style.bg} ${style.text}`}>
                        {row.action}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <div className="space-y-0.5">
                        {row.proposal_id && (
                          <Link
                            to={`/wiki/proposals/${row.proposal_id}`}
                            className="text-accent-text hover:text-violet-800 font-mono block"
                          >
                            prop {row.proposal_id.slice(0, 8)}
                          </Link>
                        )}
                        {row.article_id && (
                          <span className="text-fg-500 font-mono block">
                            art {row.article_id.slice(0, 8)}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
