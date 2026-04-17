import { useEffect, useMemo, useState } from 'react';
import { Library, ExternalLink, Plus, GitPullRequest, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useWikiStore } from '../../lib/wiki/wikiStore';
import { useCurrentMember } from '../../lib/useCurrentMember';
import { searchWikiArticles } from '../../lib/wiki/wikiApi';
import { KbSearchBar } from '../../components/kb/KbSearchBar';
import { WikiArticleCard } from '../../components/wiki/WikiArticleCard';
import { Button } from '../../components/Button';
import type { WikiArticleListItem } from '../../lib/wiki/wikiTypes';

export function WikiHub() {
  const { categories, fetchTaxonomy, isLoaded } = useWikiStore();
  const { member } = useCurrentMember();
  const isAdmin = member?.role === 'admin';
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [articles, setArticles] = useState<WikiArticleListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTaxonomy();
  }, [fetchTaxonomy]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    const handle = setTimeout(() => {
      searchWikiArticles(query, { categoryId: categoryFilter ?? undefined, limit: 100 })
        .then((rows) => active && setArticles(rows))
        .catch((err: Error) => active && setError(err.message ?? 'Search failed'))
        .finally(() => active && setLoading(false));
    }, 200);
    return () => {
      active = false;
      clearTimeout(handle);
    };
  }, [query, categoryFilter]);

  const categoriesById = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c])),
    [categories],
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5 page-enter">
      <div className="glass-indigo rounded-2xl p-5 sm:p-6 hero-enter">
        <div className="flex items-start gap-3">
          <Library className="w-6 h-6 text-violet-600 mt-1" />
          <div className="flex-1">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Wiki</h1>
              <div className="flex gap-2 flex-wrap">
                <Link to="/kb">
                  <Button variant="ghost" size="sm">
                    Knowledge Base
                    <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
                  </Button>
                </Link>
                {isAdmin && (
                  <Link to="/wiki/audit">
                    <Button variant="ghost" size="sm">
                      <Shield className="w-4 h-4 mr-1.5" />
                      Audit
                    </Button>
                  </Link>
                )}
                <Link to="/wiki/proposals">
                  <Button variant="ghost" size="sm">
                    <GitPullRequest className="w-4 h-4 mr-1.5" />
                    Proposals
                  </Button>
                </Link>
                <Link to="/wiki/new">
                  <Button variant="primary" size="sm">
                    <Plus className="w-4 h-4 mr-1.5" />
                    New
                  </Button>
                </Link>
              </div>
            </div>
            <p className="text-sm text-slate-700 mt-1">
              Manual de armado, protocolos de seguridad, control de calidad y capacitación. Complemento narrativo de la{' '}
              <Link to="/kb" className="text-indigo-600 hover:text-indigo-800 underline">Knowledge Base</Link>.
            </p>
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-600">
              <span>{categories.length} categorías</span>
              <span>·</span>
              <span>{articles.length} artículos visibles</span>
            </div>
          </div>
        </div>
      </div>

      <KbSearchBar value={query} onChange={setQuery} placeholder="Buscar en el manual…" />

      {isLoaded && categories.length > 0 && (
        <div className="flex flex-wrap gap-2 section-enter">
          <button
            type="button"
            onClick={() => setCategoryFilter(null)}
            className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition ${
              categoryFilter === null
                ? 'bg-violet-600 text-white border-violet-600'
                : 'glass-white text-slate-700 border-slate-200/70 hover:bg-violet-50'
            }`}
          >
            All
          </button>
          {categories.map((cat) => {
            const active = categoryFilter === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategoryFilter(active ? null : cat.id)}
                className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition ${
                  active
                    ? 'bg-violet-600 text-white border-violet-600'
                    : 'glass-white text-slate-700 border-slate-200/70 hover:bg-violet-50'
                }`}
              >
                {cat.name}
              </button>
            );
          })}
        </div>
      )}

      {error && (
        <div className="glass-white rounded-xl p-4 border border-red-200/70 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass-white rounded-xl h-28 skeleton-shimmer" />
          ))}
        </div>
      ) : articles.length === 0 ? (
        <div className="glass-white rounded-2xl p-8 text-center text-slate-500">
          {query ? 'No hay resultados.' : 'No hay artículos todavía.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 section-enter">
          {articles.map((a, i) => (
            <div key={a.id} className={`stagger-${Math.min(i + 1, 12)}`}>
              <WikiArticleCard article={a} category={categoriesById[a.category_id]} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
