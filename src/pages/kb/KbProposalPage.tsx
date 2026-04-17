import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, GitMerge, MessageSquareWarning, XCircle, CornerUpLeft } from 'lucide-react';
import { Button } from '../../components/Button';
import { useKbStore } from '../../lib/kb/kbStore';
import { useCurrentMember } from '../../lib/useCurrentMember';
import { KbProposalStateBadge } from '../../components/kb/KbProposalStateBadge';
import { KbDiffViewer } from '../../components/kb/KbDiffViewer';
import { KbCommentThread } from '../../components/kb/KbCommentThread';
import { KbMarkdownViewer } from '../../components/kb/KbMarkdownViewer';
import {
  fetchEntryBySlug,
  fetchMemberNames,
  fetchProposal,
  mergeProposal,
  transitionProposal,
} from '../../lib/kb/kbApi';
import type { KbEntry, KbProposal } from '../../lib/kb/kbTypes';

export function KbProposalPage() {
  const { id } = useParams<{ id: string }>();
  const { member } = useCurrentMember();
  const { categories, fetchTaxonomy } = useKbStore();
  const [proposal, setProposal] = useState<KbProposal | null>(null);
  const [target, setTarget]     = useState<KbEntry | null>(null);
  const [members, setMembers]   = useState<Record<string, string>>({});
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [reviewNote, setReviewNote] = useState('');
  const [diffMode, setDiffMode]     = useState<'line' | 'word'>('line');

  useEffect(() => {
    fetchTaxonomy();
    fetchMemberNames().then(setMembers).catch(() => {});
  }, [fetchTaxonomy]);

  async function loadAll() {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const p = await fetchProposal(id);
      if (!p) {
        setError('Propuesta no encontrada.');
        return;
      }
      setProposal(p);
      if (p.kind !== 'create' && p.proposed_slug) {
        const t = await fetchEntryBySlug(p.proposed_slug);
        setTarget(t);
      } else if (p.target_entry_id) {
        // For edit proposals we need to find the entry via id — fetch by id
        const res = await (await import('../../lib/supabase')).supabase
          .from('kb_entries')
          .select('*')
          .eq('id', p.target_entry_id)
          .maybeSingle();
        setTarget(res.data ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fetch failed');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const isAdmin = member?.role === 'admin';
  const isAuthor = proposal?.author_id === member?.id;

  const category = useMemo(
    () => categories.find((c) => c.id === proposal?.proposed_category_id) ?? null,
    [categories, proposal],
  );

  const diffBody = useMemo(() => {
    if (!proposal) return { before: '', after: '' };
    return {
      before: target?.body_md ?? '',
      after: proposal.proposed_body_md ?? '',
    };
  }, [proposal, target]);

  async function handleTransition(nextState: string) {
    if (!proposal || actionBusy) return;
    setActionBusy(true);
    try {
      await transitionProposal(proposal.id, nextState, reviewNote || undefined);
      await loadAll();
      setReviewNote('');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActionBusy(false);
    }
  }

  async function handleMerge() {
    if (!proposal || actionBusy) return;
    if (!confirm('¿Mergear esta propuesta al KB?')) return;
    setActionBusy(true);
    try {
      await mergeProposal(proposal.id, reviewNote || undefined);
      await loadAll();
      setReviewNote('');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Merge failed');
    } finally {
      setActionBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
        <div className="glass-indigo rounded-2xl h-24 skeleton-shimmer" />
        <div className="glass-white rounded-2xl h-64 skeleton-shimmer" />
      </div>
    );
  }

  if (error || !proposal) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="glass-white rounded-2xl p-6 text-center text-slate-700">
          {error ?? 'Propuesta no disponible.'}
          <div className="mt-3">
            <Link to="/kb/proposals" className="text-indigo-600 hover:text-indigo-800 text-sm">
              ← Back to proposals
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const canAuthorAct = isAuthor && ['draft', 'open', 'changes_requested'].includes(proposal.state);
  const canAdminReview = isAdmin && ['open', 'changes_requested', 'draft'].includes(proposal.state);
  const canMerge = isAdmin && proposal.state === 'approved';

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5 page-enter">
      <Link to="/kb/proposals" className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800">
        <ArrowLeft className="w-4 h-4" /> Proposals
      </Link>

      <div className="glass-indigo rounded-2xl p-5 sm:p-6 hero-enter">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <KbProposalStateBadge state={proposal.state} />
              <span className="text-xs font-mono text-slate-600 bg-white/60 px-1.5 py-0.5 rounded">
                {proposal.kind}
              </span>
              {category && (
                <span className="text-xs text-slate-600">
                  {category.section_num && <span className="font-mono mr-1">{category.section_num}</span>}
                  {category.name}
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{proposal.summary}</h1>
            <p className="text-xs text-slate-600 mt-2">
              {members[proposal.author_id] ?? 'Unknown'} · {new Date(proposal.created_at).toLocaleString()}
              {proposal.base_version != null && (
                <span className="ml-2 text-slate-500">base v{proposal.base_version}</span>
              )}
            </p>
          </div>
        </div>

        {proposal.description_md && (
          <div className="mt-4 glass-white rounded-xl p-3">
            <KbMarkdownViewer source={proposal.description_md} />
          </div>
        )}

        {proposal.review_note && (
          <div className="mt-3 text-xs text-slate-700 glass-white rounded-lg p-2 border border-slate-200/60">
            <strong>Review note:</strong> {proposal.review_note}
            {proposal.reviewer_id && (
              <span className="text-slate-500 ml-2">— {members[proposal.reviewer_id] ?? 'reviewer'}</span>
            )}
          </div>
        )}
      </div>

      {(canAdminReview || canMerge || canAuthorAct) && (
        <div className="glass-white rounded-2xl p-4 sm:p-5 space-y-3">
          {(canAdminReview || canMerge) && (
            <>
              <label className="block text-sm font-medium text-slate-700">Review note (optional)</label>
              <textarea
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                rows={2}
                className="w-full rounded-lg glass-white border border-white/80 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/60"
                placeholder="Contexto para el autor…"
              />
            </>
          )}
          <div className="flex gap-2 flex-wrap justify-end">
            {canAuthorAct && proposal.state === 'draft' && (
              <Button variant="primary" size="sm" onClick={() => handleTransition('open')} disabled={actionBusy}>
                Submit for review
              </Button>
            )}
            {canAuthorAct && proposal.state === 'changes_requested' && (
              <Button variant="primary" size="sm" onClick={() => handleTransition('open')} disabled={actionBusy}>
                Resubmit
              </Button>
            )}
            {canAuthorAct && ['open', 'changes_requested'].includes(proposal.state) && (
              <Button variant="ghost" size="sm" onClick={() => handleTransition('withdrawn')} disabled={actionBusy}>
                <CornerUpLeft className="w-4 h-4 mr-1" /> Withdraw
              </Button>
            )}
            {canAdminReview && (
              <>
                <Button variant="secondary" size="sm" onClick={() => handleTransition('changes_requested')} disabled={actionBusy}>
                  <MessageSquareWarning className="w-4 h-4 mr-1" /> Request changes
                </Button>
                <Button variant="danger" size="sm" onClick={() => handleTransition('rejected')} disabled={actionBusy}>
                  <XCircle className="w-4 h-4 mr-1" /> Reject
                </Button>
                <Button variant="primary" size="sm" onClick={() => handleTransition('approved')} disabled={actionBusy}>
                  <CheckCircle2 className="w-4 h-4 mr-1" /> Approve
                </Button>
              </>
            )}
            {canMerge && (
              <Button variant="primary" size="sm" onClick={handleMerge} disabled={actionBusy}>
                <GitMerge className="w-4 h-4 mr-1" /> Merge to KB
              </Button>
            )}
          </div>
        </div>
      )}

      {(proposal.proposed_body_md !== null || target) && (
        <div className="glass-white rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">Diff — body</h3>
            <div className="inline-flex rounded-lg border border-slate-200/70 overflow-hidden text-xs font-medium">
              <button
                type="button"
                onClick={() => setDiffMode('line')}
                className={`px-2.5 py-1 ${diffMode === 'line' ? 'bg-indigo-600 text-white' : 'text-slate-700 hover:bg-slate-100'}`}
              >
                Line
              </button>
              <button
                type="button"
                onClick={() => setDiffMode('word')}
                className={`px-2.5 py-1 ${diffMode === 'word' ? 'bg-indigo-600 text-white' : 'text-slate-700 hover:bg-slate-100'}`}
              >
                Word
              </button>
            </div>
          </div>
          <KbDiffViewer
            before={diffBody.before}
            after={diffBody.after}
            mode={diffMode}
            label={{
              before: proposal.kind === 'create' ? '(nuevo)' : `current v${target?.current_version ?? '?'}`,
              after: `proposed`,
            }}
          />
        </div>
      )}

      {proposal.proposed_structured_data && (
        <div className="glass-white rounded-2xl p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-3 uppercase tracking-wide">Diff — structured data</h3>
          <KbDiffViewer
            before={JSON.stringify(target?.structured_data ?? {}, null, 2)}
            after={JSON.stringify(proposal.proposed_structured_data ?? {}, null, 2)}
            mode="line"
            label={{ before: 'current', after: 'proposed' }}
          />
        </div>
      )}

      {member && (
        <KbCommentThread
          proposalId={proposal.id}
          authorId={member.id}
          memberNames={members}
        />
      )}
    </div>
  );
}
