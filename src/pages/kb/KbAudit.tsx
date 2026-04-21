import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';
import { fetchAuditLog, fetchMemberNames } from '../../lib/kb/kbApi';
import type { KbAuditRow } from '../../lib/kb/kbTypes';

const ACTION_STYLES: Record<string, { bg: string; text: string }> = {
  'proposal.create.merge':  { bg: 'bg-accent-tint-soft',   text: 'text-accent-text' },
  'proposal.edit.merge':    { bg: 'bg-accent-tint-soft',   text: 'text-accent-text' },
  'proposal.delete.merge':  { bg: 'bg-status-red-bg',     text: 'text-status-red-fg' },
  default_approved:         { bg: 'bg-status-emerald-bg',  text: 'text-status-emerald-fg' },
  default_rejected:         { bg: 'bg-status-red-bg',     text: 'text-status-red-fg' },
  default_changes:          { bg: 'bg-status-amber-bg',    text: 'text-status-amber-fg' },
  default_withdrawn:        { bg: 'bg-surf-muted',    text: 'text-fg-700' },
  default_open:             { bg: 'bg-accent-tint-strong',   text: 'text-accent-text' },
};

function styleForAction(action: string) {
  if (action.startsWith('proposal.')) {
    if (action.endsWith('.merge')) return ACTION_STYLES[action] ?? ACTION_STYLES['proposal.edit.merge'];
    if (action.includes('_to_approved'))  return ACTION_STYLES.default_approved;
    if (action.includes('_to_rejected'))  return ACTION_STYLES.default_rejected;
    if (action.includes('_to_changes_requested')) return ACTION_STYLES.default_changes;
    if (action.includes('_to_withdrawn')) return ACTION_STYLES.default_withdrawn;
    if (action.includes('_to_open'))      return ACTION_STYLES.default_open;
  }
  return { bg: 'bg-surf-muted', text: 'text-fg-700' };
}

export function KbAudit() {
  const [rows, setRows]         = useState<KbAuditRow[]>([]);
  const [members, setMembers]   = useState<Record<string, string>>({});
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([fetchAuditLog(200), fetchMemberNames()])
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
      <Link to="/kb" className="inline-flex items-center gap-1 text-sm text-accent-text hover:text-accent-text">
        <ArrowLeft className="w-4 h-4" /> Knowledge Base
      </Link>

      <div className="glass-indigo rounded-2xl p-5 sm:p-6 hero-enter">
        <div className="flex items-start gap-3">
          <Shield className="w-6 h-6 text-accent-text mt-1" />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-fg-900">Audit log</h1>
            <p className="text-sm text-fg-700 mt-1">
              Registro inmutable de mutaciones del KB: merges, cambios de estado de propuestas, rechazos, withdraws.
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
                <th className="text-left px-3 py-2 font-semibold text-fg-800">Entry / Proposal</th>
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
                            to={`/kb/proposals/${row.proposal_id}`}
                            className="text-accent-text hover:text-accent-text font-mono block"
                          >
                            prop {row.proposal_id.slice(0, 8)}
                          </Link>
                        )}
                        {row.entry_id && (
                          <span className="text-fg-500 font-mono block">
                            entry {row.entry_id.slice(0, 8)}
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
