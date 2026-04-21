import { useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useKbStore } from '../../lib/kb/kbStore';
import { useCurrentMember } from '../../lib/useCurrentMember';
import { fetchEntryBySlug } from '../../lib/kb/kbApi';
import { KbProposalForm } from '../../components/kb/KbProposalForm';
import { useState } from 'react';
import type { KbEntry } from '../../lib/kb/kbTypes';

export function KbNew() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const editSlug = params.get('edit');
  const { member, loading: memberLoading } = useCurrentMember();
  const { fetchTaxonomy, isLoaded } = useKbStore();
  const [baseEntry, setBaseEntry] = useState<KbEntry | null>(null);
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
    fetchEntryBySlug(editSlug)
      .then((row) => active && setBaseEntry(row))
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

  const mode: 'create' | 'edit' = baseEntry ? 'edit' : 'create';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5 page-enter">
      <Link to="/kb" className="inline-flex items-center gap-1 text-sm text-accent-text hover:text-indigo-800">
        <ArrowLeft className="w-4 h-4" /> Knowledge Base
      </Link>

      <div className="glass-indigo rounded-2xl p-5 sm:p-6 hero-enter">
        <h1 className="text-xl sm:text-2xl font-bold text-fg-900">
          {mode === 'edit' ? `Propose edit — ${baseEntry?.title}` : 'Propose new entry'}
        </h1>
        <p className="text-sm text-fg-700 mt-1">
          Tu propuesta entra en estado <strong>open</strong> y un admin la revisará antes de mergear al KB.
        </p>
      </div>

      <KbProposalForm mode={mode} baseEntry={baseEntry ?? undefined} authorId={member.id} />
    </div>
  );
}
