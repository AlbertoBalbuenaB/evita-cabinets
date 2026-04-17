import { Link } from 'react-router-dom';
import { FileText, Clock } from 'lucide-react';
import type { WikiArticleListItem, WikiCategory } from '../../lib/wiki/wikiTypes';
import { pickText, useLocaleStore } from '../../lib/localeStore';

interface WikiArticleCardProps {
  article: WikiArticleListItem;
  category?: WikiCategory;
}

export function WikiArticleCard({ article, category }: WikiArticleCardProps) {
  const { locale } = useLocaleStore();
  const title = pickText(article, 'title', locale);
  const summary = pickText(article, 'summary', locale);
  const categoryName = category ? pickText(category, 'name', locale) : '';
  return (
    <Link
      to={`/wiki/${article.slug}`}
      className="glass-white rounded-xl p-4 block transition hover:bg-violet-50/30 hover:shadow-md card-enter"
    >
      <div className="flex items-start gap-2 mb-2">
        <FileText className="w-4 h-4 text-violet-500 flex-shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          {summary && (
            <p className="text-xs text-slate-600 mt-1 line-clamp-2">{summary}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs text-slate-500 mt-2 flex-wrap">
        {categoryName && <span>{categoryName}</span>}
        {article.reading_time_min != null && (
          <>
            <span className="text-slate-400">·</span>
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {article.reading_time_min} min
            </span>
          </>
        )}
      </div>
      {article.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {article.tags.slice(0, 5).map((t) => (
            <span key={t} className="px-1.5 py-0.5 rounded bg-slate-100/70 text-[10px] text-slate-600 font-mono">
              {t}
            </span>
          ))}
          {article.tags.length > 5 && (
            <span className="text-[10px] text-slate-400">+{article.tags.length - 5}</span>
          )}
        </div>
      )}
    </Link>
  );
}
