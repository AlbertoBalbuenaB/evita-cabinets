import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useWikiStore } from '../../lib/wiki/wikiStore';
import { useCurrentMember } from '../../lib/useCurrentMember';
import { fetchWikiArticleBySlug } from '../../lib/wiki/wikiApi';
import { WikiProposalForm } from '../../components/wiki/WikiProposalForm';
import type { WikiArticle } from '../../lib/wiki/wikiTypes';

export function WikiNew() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const editSlug = params.get('edit');
  const { member, loading: memberLoading } = useCurrentMember();
  const { fetchTaxonomy, isLoaded } = useWikiStore();
  const [baseArticle, setBaseArticle] = useState<WikiArticle | null>(null);
  const [loading, setLoading] = useState(!!editSlug);

  useEffect(() => {
    fetchTaxonomy();
  }, [fetchTaxonomy]);

  useEffect(() => {
    if (!editSlug) {
      setLoading(false);
      return;
    }
    let active = true;
    fetchWikiArticleBySlug(editSlug)
      .then((row) => active && setBaseArticle(row))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [editSlug]);

  if (memberLoading || loading || !isLoaded) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="glass-indigo rounded-2xl h-24 skeleton-shimmer" />
      </div>
    );
  }
  if (!member) {
    navigate('/');
    return null;
  }

  const mode: 'create' | 'edit' = baseArticle ? 'edit' : 'create';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5 page-enter">
      <Link to="/wiki" className="inline-flex items-center gap-1 text-sm text-violet-600 hover:text-violet-800">
        <ArrowLeft className="w-4 h-4" /> Wiki
      </Link>
      <div className="glass-indigo rounded-2xl p-5 sm:p-6 hero-enter">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
          {mode === 'edit' ? `Propose edit — ${baseArticle?.title}` : 'Propose new article'}
        </h1>
        <p className="text-sm text-slate-700 mt-1">
          Tu propuesta entra en estado <strong>open</strong> y un admin la revisará antes de mergear.
        </p>
      </div>
      <WikiProposalForm mode={mode} baseArticle={baseArticle ?? undefined} authorId={member.id} />
    </div>
  );
}
