import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, AlertCircle, Package, Pencil } from 'lucide-react';
import { Button } from '../../components/Button';
import {
  fetchEntryBySlug,
  fetchEntryVersions,
  fetchMemberNames,
} from '../../lib/kb/kbApi';
import { useKbStore } from '../../lib/kb/kbStore';
import { KbMarkdownViewer } from '../../components/kb/KbMarkdownViewer';
import { KbStructuredPanel } from '../../components/kb/KbStructuredPanel';
import { KbSupplierChip } from '../../components/kb/KbSupplierChip';
import { KbVersionTimeline } from '../../components/kb/KbVersionTimeline';
import type { KbEntry, KbEntryVersion } from '../../lib/kb/kbTypes';

export function KbEntryPage() {
  const { slug } = useParams<{ slug: string }>();
  const { categories, suppliers, fetchTaxonomy } = useKbStore();
  const [entry, setEntry] = useState<KbEntry | null>(null);
  const [versions, setVersions] = useState<KbEntryVersion[]>([]);
  const [memberNames, setMemberNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTaxonomy();
    fetchMemberNames().then(setMemberNames).catch(() => {});
  }, [fetchTaxonomy]);

  useEffect(() => {
    if (!slug) return;
    let active = true;
    setLoading(true);
    setError(null);
    fetchEntryBySlug(slug)
      .then(async (row) => {
        if (!active) return;
        if (!row) {
          setError('Entrada no encontrada.');
          return;
        }
        setEntry(row);
        const vs = await fetchEntryVersions(row.id).catch(() => []);
        if (active) setVersions(vs);
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

  if (error || !entry) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="glass-white rounded-2xl p-6 text-center">
          <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-3" />
          <p className="text-slate-700">{error ?? 'Entrada no disponible.'}</p>
          <Link to="/kb" className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 mt-3 text-sm">
            <ArrowLeft className="w-4 h-4" /> Volver al KB
          </Link>
        </div>
      </div>
    );
  }

  const category = categories.find((c) => c.id === entry.category_id);
  const entrySuppliers = suppliers.filter((s) => entry.supplier_ids.includes(s.id));

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5 page-enter">
      <div className="flex items-center gap-2 text-sm">
        <Link to="/kb" className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800">
          <ArrowLeft className="w-4 h-4" /> Knowledge Base
        </Link>
        {category && (
          <>
            <span className="text-slate-400">/</span>
            <span className="text-slate-600">
              {category.section_num && <span className="font-mono mr-1">{category.section_num}</span>}
              {category.name}
            </span>
          </>
        )}
      </div>

      <div className="glass-indigo rounded-2xl p-5 sm:p-6 hero-enter">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">{entry.title}</h1>
            <div className="mt-2 flex items-center gap-2 flex-wrap text-xs text-slate-600">
              <span className="font-mono px-2 py-0.5 rounded bg-indigo-100/70 text-indigo-800">{entry.entry_type}</span>
              <span>·</span>
              <span className="font-mono">v{entry.current_version}</span>
              <span>·</span>
              <span>Actualizado {new Date(entry.updated_at).toLocaleDateString()}</span>
            </div>
            {entry.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {entry.tags.map((t) => (
                  <span key={t} className="px-1.5 py-0.5 rounded bg-white/60 text-[11px] text-slate-700 font-mono">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
          <Link to={`/kb/new?edit=${encodeURIComponent(entry.slug)}`}>
            <Button variant="secondary" size="sm">
              <Pencil className="w-4 h-4 mr-1.5" />
              Propose edit
            </Button>
          </Link>
        </div>

        {entry.needs_enrichment && (
          <div className="mt-4 flex items-start gap-2 glass-white rounded-xl p-3 border border-amber-200/60">
            <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-slate-700">
              <strong className="text-amber-700">Esta entrada necesita enriquecimiento.</strong>
              {entry.enrichment_notes && <> {entry.enrichment_notes}</>}
            </div>
          </div>
        )}
      </div>

      {entrySuppliers.length > 0 && (
        <div className="glass-white rounded-2xl p-4 sm:p-5 section-enter">
          <h3 className="text-sm font-semibold text-slate-900 mb-3 uppercase tracking-wide">Proveedores</h3>
          <div className="flex flex-wrap gap-2">
            {entrySuppliers.map((s) => (
              <KbSupplierChip key={s.id} supplier={s} />
            ))}
          </div>
        </div>
      )}

      {(entry.product_refs.length > 0 || entry.price_item_refs.length > 0) && (
        <div className="glass-white rounded-2xl p-4 sm:p-5 section-enter">
          <h3 className="text-sm font-semibold text-slate-900 mb-3 uppercase tracking-wide">Referencias</h3>
          <div className="space-y-2">
            {entry.product_refs.length > 0 && (
              <div className="flex items-start gap-2 text-sm">
                <Package className="w-4 h-4 text-slate-500 mt-0.5" />
                <div>
                  <span className="text-slate-600">products_catalog: </span>
                  {entry.product_refs.map((id) => (
                    <Link
                      key={id}
                      to={`/products/${id}`}
                      className="font-mono text-xs text-indigo-600 hover:text-indigo-800 mr-2"
                    >
                      {id.slice(0, 8)}
                    </Link>
                  ))}
                </div>
              </div>
            )}
            {entry.price_item_refs.length > 0 && (
              <div className="flex items-start gap-2 text-sm">
                <Package className="w-4 h-4 text-slate-500 mt-0.5" />
                <div>
                  <span className="text-slate-600">price_list: </span>
                  {entry.price_item_refs.map((id) => (
                    <Link
                      key={id}
                      to={`/prices/${id}`}
                      className="font-mono text-xs text-indigo-600 hover:text-indigo-800 mr-2"
                    >
                      {id.slice(0, 8)}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="glass-white rounded-2xl p-5 sm:p-6 section-enter">
        <KbMarkdownViewer source={entry.body_md} />
      </div>

      <KbStructuredPanel data={entry.structured_data} />

      {versions.length > 0 && (
        <KbVersionTimeline
          versions={versions}
          currentVersion={entry.current_version}
          memberNames={memberNames}
        />
      )}
    </div>
  );
}
