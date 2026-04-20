import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, AlertCircle, GitPullRequest, Plus, Shield, Library } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/Button';
import { useKbStore } from '../../lib/kb/kbStore';
import { useCurrentMember } from '../../lib/useCurrentMember';
import { searchEntries } from '../../lib/kb/kbApi';
import { KbSearchBar } from '../../components/kb/KbSearchBar';
import { KbEntryCard } from '../../components/kb/KbEntryCard';
import { KbCategoryChip } from '../../components/kb/KbCategoryChip';
import { usePageChrome } from '../../contexts/PageChromeContext';
import type { KbEntryListItem } from '../../lib/kb/kbTypes';

export function KbHub() {
  const navigate = useNavigate();
  const { categories, suppliers, fetchTaxonomy, isLoaded } = useKbStore();
  const { member } = useCurrentMember();
  const isAdmin = member?.role === 'admin';

  usePageChrome(
    {
      title: 'Knowledge Base',
      crumbs: [{ label: 'KB' }],
      primaryAction: {
        label: 'New Entry',
        icon: Plus,
        onClick: () => navigate('/kb/new'),
      },
    },
    [navigate],
  );
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [entries, setEntries] = useState<KbEntryListItem[]>([]);
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
      searchEntries(query, { categoryId: categoryFilter ?? undefined, limit: 100 })
        .then((rows) => {
          if (active) setEntries(rows);
        })
        .catch((err: Error) => {
          if (active) setError(err.message ?? 'Search failed');
        })
        .finally(() => {
          if (active) setLoading(false);
        });
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

  const needsEnrichmentCount = entries.filter((e) => e.needs_enrichment).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5 page-enter">
      <div className="glass-indigo rounded-2xl p-5 sm:p-6 hero-enter">
        <div className="flex items-start gap-3">
          <BookOpen className="w-6 h-6 text-indigo-600 mt-1" />
          <div className="flex-1">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Knowledge Base</h1>
              <div className="flex gap-2">
                <Link to="/wiki">
                  <Button variant="ghost" size="sm">
                    <Library className="w-4 h-4 mr-1.5" />
                    Wiki
                  </Button>
                </Link>
                {isAdmin && (
                  <Link to="/kb/audit">
                    <Button variant="ghost" size="sm">
                      <Shield className="w-4 h-4 mr-1.5" />
                      Audit
                    </Button>
                  </Link>
                )}
                <Link to="/kb/proposals">
                  <Button variant="ghost" size="sm">
                    <GitPullRequest className="w-4 h-4 mr-1.5" />
                    Proposals
                  </Button>
                </Link>
              </div>
            </div>
            <p className="text-sm text-slate-700 mt-1">
              Base de referencia interna de Evita: acabados, cubrecantos, herrajes, reglas de fabricación, proveedores y constantes del proyecto.
            </p>
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-600">
              <span>{categories.length} categorías</span>
              <span>·</span>
              <span>{suppliers.length} proveedores</span>
              <span>·</span>
              <span>{entries.length} entradas visibles</span>
              {needsEnrichmentCount > 0 && (
                <>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1 text-amber-700">
                    <AlertCircle className="w-3 h-3" /> {needsEnrichmentCount} necesitan enriquecimiento
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <KbSearchBar value={query} onChange={setQuery} />

      {isLoaded && categories.length > 0 && (
        <div className="flex flex-wrap gap-2 section-enter">
          <KbCategoryChip
            category={{
              id: '__all__',
              slug: '__all__',
              name: 'All',
              name_en: 'All',
              section_num: null,
              description: null,
              description_en: null,
              sort_order: -1,
              parent_id: null,
              created_at: '',
            }}
            active={categoryFilter === null}
            onClick={() => setCategoryFilter(null)}
          />
          {categories.map((cat) => (
            <KbCategoryChip
              key={cat.id}
              category={cat}
              active={categoryFilter === cat.id}
              onClick={() => setCategoryFilter(cat.id === categoryFilter ? null : cat.id)}
            />
          ))}
        </div>
      )}

      {error && (
        <div className="glass-white rounded-xl p-4 border border-red-200/70 text-sm text-red-700">
          Error: {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass-white rounded-xl h-24 skeleton-shimmer" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="glass-white rounded-2xl p-8 text-center text-slate-500">
          {query ? 'No hay resultados para tu búsqueda.' : 'No hay entradas todavía.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 section-enter">
          {entries.map((entry, i) => (
            <div key={entry.id} className={`stagger-${Math.min(i + 1, 12)}`}>
              <KbEntryCard entry={entry} category={categoriesById[entry.category_id]} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
