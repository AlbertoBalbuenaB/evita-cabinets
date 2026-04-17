import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, AlertCircle, Clock, Library } from 'lucide-react';
import { useWikiStore } from '../../lib/wiki/wikiStore';
import { fetchWikiArticleBySlug } from '../../lib/wiki/wikiApi';
import { KbMarkdownViewer } from '../../components/kb/KbMarkdownViewer';
import type { WikiArticle } from '../../lib/wiki/wikiTypes';

export function WikiArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const { categories, fetchTaxonomy } = useWikiStore();
  const [article, setArticle] = useState<WikiArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    fetchTaxonomy();
  }, [fetchTaxonomy]);

  useEffect(() => {
    if (!slug) return;
    let active = true;
    setLoading(true);
    setError(null);
    fetchWikiArticleBySlug(slug)
      .then((row) => {
        if (!active) return;
        if (!row) setError('Artículo no encontrado.');
        else setArticle(row);
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

  if (error || !article) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="glass-white rounded-2xl p-6 text-center">
          <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-3" />
          <p className="text-slate-700">{error ?? 'Artículo no disponible.'}</p>
          <Link to="/wiki" className="inline-flex items-center gap-1 text-violet-600 hover:text-violet-800 mt-3 text-sm">
            <ArrowLeft className="w-4 h-4" /> Volver al Wiki
          </Link>
        </div>
      </div>
    );
  }

  const category = categories.find((c) => c.id === article.category_id);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5 page-enter">
      <div className="flex items-center gap-2 text-sm">
        <Link to="/wiki" className="inline-flex items-center gap-1 text-violet-600 hover:text-violet-800">
          <ArrowLeft className="w-4 h-4" /> Wiki
        </Link>
        {category && (
          <>
            <span className="text-slate-400">/</span>
            <span className="text-slate-600">{category.name}</span>
          </>
        )}
      </div>

      <div className="glass-indigo rounded-2xl p-5 sm:p-6 hero-enter">
        <div className="inline-flex items-center gap-2 mb-2">
          <Library className="w-5 h-5 text-violet-600" />
          <span className="text-xs uppercase tracking-wide text-slate-600 font-semibold">Wiki article</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">{article.title}</h1>
        {article.summary && (
          <p className="text-sm text-slate-700 mt-2">{article.summary}</p>
        )}
        <div className="mt-3 flex items-center gap-2 flex-wrap text-xs text-slate-600">
          <span className="font-mono">v{article.current_version}</span>
          <span>·</span>
          <span>Actualizado {new Date(article.updated_at).toLocaleDateString()}</span>
          {article.reading_time_min != null && (
            <>
              <span>·</span>
              <span className="inline-flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {article.reading_time_min} min
              </span>
            </>
          )}
        </div>
        {article.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {article.tags.map((t) => (
              <span key={t} className="px-1.5 py-0.5 rounded bg-white/60 text-[11px] text-slate-700 font-mono">
                {t}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="glass-white rounded-2xl p-5 sm:p-6 section-enter">
        <KbMarkdownViewer source={article.body_md} />
      </div>
    </div>
  );
}
