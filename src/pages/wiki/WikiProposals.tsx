import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Library, Plus, Filter } from 'lucide-react';
import { Button } from '../../components/Button';
import { KbProposalStateBadge } from '../../components/kb/KbProposalStateBadge';
import { fetchWikiProposals } from '../../lib/wiki/wikiApi';
import { fetchMemberNames } from '../../lib/kb/kbApi';
import type { WikiProposal } from '../../lib/wiki/wikiTypes';

const STATE_FILTERS: Array<{ value: string | null; label: string }> = [
  { value: null, label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'changes_requested', label: 'Changes requested' },
  { value: 'approved', label: 'Approved' },
  { value: 'merged', label: 'Merged' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'withdrawn', label: 'Withdrawn' },
  { value: 'draft', label: 'Drafts' },
];

export function WikiProposals() {
  const [proposals, setProposals] = useState<WikiProposal[]>([]);
  const [members, setMembers]     = useState<Record<string, string>>({});
  const [stateFilter, setStateFilter] = useState<string | null>('open');
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  useEffect(() => {
    fetchMemberNames().then(setMembers).catch(() => {});
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetchWikiProposals({ state: stateFilter ?? undefined, limit: 200 })
      .then((rows) => active && setProposals(rows))
      .catch((err) => active && setError(err.message ?? 'Fetch failed'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [stateFilter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const p of proposals) c[p.state] = (c[p.state] ?? 0) + 1;
    return c;
  }, [proposals]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5 page-enter">
      <div className="glass-indigo rounded-2xl p-5 sm:p-6 hero-enter">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <Link to="/wiki" className="text-sm text-violet-600 hover:text-violet-800 inline-flex items-center gap-1 mb-2">
              <Library className="w-4 h-4" /> Wiki
            </Link>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Wiki proposals</h1>
            <p className="text-sm text-slate-700 mt-1">
              Cambios propuestos al manual. Los admins revisan, aprueban y mergean.
            </p>
          </div>
          <Link to="/wiki/new">
            <Button variant="primary" size="md">
              <Plus className="w-4 h-4 mr-1.5" />
              New proposal
            </Button>
          </Link>
        </div>
      </div>

      <div className="glass-white rounded-2xl p-3 sm:p-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-slate-500" />
          {STATE_FILTERS.map((f) => {
            const active = f.value === stateFilter;
            const count = f.value ? counts[f.value] : proposals.length;
            return (
              <button
                key={f.label}
                type="button"
                onClick={() => setStateFilter(f.value)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition ${
                  active
                    ? 'bg-violet-600 text-white border-violet-600'
                    : 'glass-white text-slate-700 border-slate-200/70 hover:bg-violet-50'
                }`}
              >
                {f.label}
                {count !== undefined && (
                  <span className={`text-[10px] ${active ? 'text-white/90' : 'text-slate-500'}`}>{count}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="glass-white rounded-xl p-4 border border-red-200/70 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass-white rounded-xl h-16 skeleton-shimmer" />
          ))}
        </div>
      ) : proposals.length === 0 ? (
        <div className="glass-white rounded-2xl p-8 text-center text-slate-500">
          No hay propuestas en este filtro.
        </div>
      ) : (
        <ul className="space-y-2 section-enter">
          {proposals.map((p) => (
            <li key={p.id}>
              <Link
                to={`/wiki/proposals/${p.id}`}
                className="glass-white rounded-xl p-4 block transition hover:bg-violet-50/30 hover:shadow-md row-enter"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <KbProposalStateBadge state={p.state} compact />
                      <span className="text-xs font-mono text-slate-500">{p.kind}</span>
                    </div>
                    <h3 className="text-sm font-semibold text-slate-900 truncate">{p.summary}</h3>
                    <p className="text-xs text-slate-500 mt-1">
                      {members[p.author_id] ?? 'Unknown'} · {new Date(p.created_at).toLocaleDateString()}
                      {p.target_article_id && <span className="ml-1">· targets existing article</span>}
                    </p>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
