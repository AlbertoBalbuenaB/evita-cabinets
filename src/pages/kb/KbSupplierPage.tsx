import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Building2, ExternalLink } from 'lucide-react';
import { useKbStore } from '../../lib/kb/kbStore';
import {
  fetchEntriesBySupplierId,
  fetchSupplierBySlug,
} from '../../lib/kb/kbApi';
import { KbMarkdownViewer } from '../../components/kb/KbMarkdownViewer';
import { KbEntryCard } from '../../components/kb/KbEntryCard';
import type { KbEntryListItem, KbSupplier } from '../../lib/kb/kbTypes';
import { pickText, useLocaleStore } from '../../lib/localeStore';

export function KbSupplierPage() {
  const { slug } = useParams<{ slug: string }>();
  const { categories, fetchTaxonomy } = useKbStore();
  const { locale } = useLocaleStore();
  const [supplier, setSupplier] = useState<KbSupplier | null>(null);
  const [entries, setEntries]   = useState<KbEntryListItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    fetchTaxonomy();
  }, [fetchTaxonomy]);

  useEffect(() => {
    if (!slug) return;
    let active = true;
    setLoading(true);
    setError(null);
    fetchSupplierBySlug(slug)
      .then(async (row) => {
        if (!active) return;
        if (!row) {
          setError('Proveedor no encontrado.');
          return;
        }
        setSupplier(row);
        const es = await fetchEntriesBySupplierId(row.id).catch(() => []);
        if (active) setEntries(es);
      })
      .catch((err: Error) => active && setError(err.message ?? 'Fetch failed'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [slug]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
        <div className="glass-indigo rounded-2xl h-24 skeleton-shimmer" />
        <div className="glass-white rounded-2xl h-64 skeleton-shimmer" />
      </div>
    );
  }

  if (error || !supplier) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="glass-white rounded-2xl p-6 text-center text-fg-700">
          {error ?? 'Proveedor no disponible.'}
          <div className="mt-3">
            <Link to="/kb" className="text-accent-text hover:text-indigo-800 text-sm">
              ← Knowledge Base
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const categoriesById = Object.fromEntries(categories.map((c) => [c.id, c]));

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5 page-enter">
      <Link to="/kb" className="inline-flex items-center gap-1 text-sm text-accent-text hover:text-indigo-800">
        <ArrowLeft className="w-4 h-4" /> Knowledge Base
      </Link>

      <div className="glass-indigo rounded-2xl p-5 sm:p-6 hero-enter">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="inline-flex items-center gap-2 mb-2">
              <Building2 className="w-5 h-5 text-status-emerald-fg" />
              <span className="text-xs uppercase tracking-wide text-fg-600 font-semibold">Supplier</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-fg-900">{pickText(supplier, 'name', locale)}</h1>
            {supplier.categories && supplier.categories.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {supplier.categories.map((c) => (
                  <span key={c} className="px-2 py-0.5 rounded bg-surf-card text-[11px] text-fg-700 font-mono">
                    {c}
                  </span>
                ))}
              </div>
            )}
          </div>
          {supplier.ops_supplier_id && (
            <Link
              to={`/suppliers/${supplier.ops_supplier_id}`}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg glass-white text-sm text-accent-text hover:text-indigo-800"
            >
              Ops record <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      </div>

      {(() => {
        const notes = pickText(supplier, 'notes_md', locale);
        return notes && notes.trim().length > 0 ? (
          <div className="glass-white rounded-2xl p-5 sm:p-6 section-enter">
            <KbMarkdownViewer source={notes} />
          </div>
        ) : null;
      })()}

      <div>
        <h3 className="text-sm font-semibold text-fg-700 uppercase tracking-wide mb-2">
          Referenced by {entries.length} entrie{entries.length === 1 ? '' : 's'}
        </h3>
        {entries.length === 0 ? (
          <div className="glass-white rounded-2xl p-6 text-center text-fg-500 text-sm">
            Este proveedor aún no está referenciado por ninguna entrada del KB.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 section-enter">
            {entries.map((e) => (
              <KbEntryCard key={e.id} entry={e} category={categoriesById[e.category_id]} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
