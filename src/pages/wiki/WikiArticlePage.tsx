import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, AlertCircle, Clock, Library, Pencil } from 'lucide-react';
import { useWikiStore } from '../../lib/wiki/wikiStore';
import { fetchWikiArticleBySlug, fetchWikiArticleVersions } from '../../lib/wiki/wikiApi';
import { fetchMemberNames } from '../../lib/kb/kbApi';
import { History } from 'lucide-react';
import { KbMarkdownViewer } from '../../components/kb/KbMarkdownViewer';
import { Button } from '../../components/Button';
import { pickText, useLocaleStore } from '../../lib/localeStore';
import type { WikiArticle, WikiArticleVersion } from '../../lib/wiki/wikiTypes';

export function WikiArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const { categories, fetchTaxonomy } = useWikiStore();
  const { locale } = useLocaleStore();
  const [article, setArticle] = useState<WikiArticle | null>(null);
  const [versions, setVersions] = useState<WikiArticleVersion[]>([]);
  const [memberNames, setMemberNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    fetchTaxonomy();
    fetchMemberNames().then(setMemberNames).catch(() => {});
  }, [fetchTaxonomy]);

  useEffect(() => {
    if (!slug) return;
    let active = true;
    setLoading(true);
    setError(null);
    fetchWikiArticleBySlug(slug)
      .then(async (row) => {
        if (!active) return;
        if (!row) {
          setError('Artículo no encontrado.');
          return;
        }
        setArticle(row);
        const vs = await fetchWikiArticleVersions(row.id).catch(() => []);
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

  if (error || !article) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="glass-white rounded-2xl p-6 text-center">
          <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-3" />
          <p className="text-fg-700">{error ?? 'Artículo no disponible.'}</p>
          <Link to="/wiki" className="inline-flex items-center gap-1 text-violet-600 hover:text-violet-800 mt-3 text-sm">
            <ArrowLeft className="w-4 h-4" /> Volver al Wiki
          </Link>
        </div>
      </div>
    );
  }

  const category = categories.find((c) => c.id === article.category_id);
  const title = pickText(article, 'title', locale);
  const summary = pickText(article, 'summary', locale);
  const body = pickText(article, 'body_md', locale);
  const categoryName = category ? pickText(category, 'name', locale) : '';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5 page-enter">
      <div className="flex items-center gap-2 text-sm">
        <Link to="/wiki" className="inline-flex items-center gap-1 text-violet-600 hover:text-violet-800">
          <ArrowLeft className="w-4 h-4" /> Wiki
        </Link>
        {category && (
          <>
            <span className="text-fg-400">/</span>
            <span className="text-fg-600">{categoryName}</span>
          </>
        )}
      </div>

      <div className="glass-indigo rounded-2xl p-5 sm:p-6 hero-enter">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="inline-flex items-center gap-2 mb-2">
              <Library className="w-5 h-5 text-violet-600" />
              <span className="text-xs uppercase tracking-wide text-fg-600 font-semibold">Wiki article</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-fg-900">{title}</h1>
          </div>
          <Link to={`/wiki/new?edit=${encodeURIComponent(article.slug)}`}>
            <Button variant="secondary" size="sm">
              <Pencil className="w-4 h-4 mr-1.5" />
              Propose edit
            </Button>
          </Link>
        </div>
        {summary && (
          <p className="text-sm text-fg-700 mt-2">{summary}</p>
        )}
        <div className="mt-3 flex items-center gap-2 flex-wrap text-xs text-fg-600">
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
              <span key={t} className="px-1.5 py-0.5 rounded bg-surf-card text-[11px] text-fg-700 font-mono">
                {t}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="glass-white rounded-2xl p-5 sm:p-6 section-enter">
        <KbMarkdownViewer source={body} />
      </div>

      {versions.length > 0 && (
        <div className="glass-white rounded-2xl p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-fg-900 mb-3 uppercase tracking-wide flex items-center gap-2">
            <History className="w-4 h-4 text-violet-500" />
            Version history
          </h3>
          <ul className="space-y-2">
            {versions.map((v) => {
              const isCurrent = v.version_num === article.current_version;
              const editor = v.edited_by ? memberNames[v.edited_by] ?? 'Unknown' : 'System';
              return (
                <li
                  key={v.id}
                  className={`flex items-start gap-3 p-2 rounded-lg ${
                    isCurrent ? 'bg-violet-50/60 border border-violet-200/60' : ''
                  }`}
                >
                  <span className="font-mono text-xs text-violet-700 font-semibold w-10">v{v.version_num}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-fg-800 truncate">{v.edit_summary ?? 'No summary'}</p>
                    <p className="text-xs text-fg-500 mt-0.5">
                      {editor} · {new Date(v.created_at).toLocaleString()}
                      {isCurrent && <span className="ml-2 text-violet-700 font-medium">current</span>}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
