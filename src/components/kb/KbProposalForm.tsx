import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../Button';
import { Input } from '../Input';
import { useKbStore } from '../../lib/kb/kbStore';
import { createProposal } from '../../lib/kb/kbApi';
import type { KbEntry, KbEntryType } from '../../lib/kb/kbTypes';

interface KbProposalFormProps {
  mode: 'create' | 'edit';
  baseEntry?: KbEntry;
  authorId: string;
  onSubmitted?: (proposalId: string) => void;
}

const ENTRY_TYPES: KbEntryType[] = [
  'finish','edge_band','toe_kick','hardware','panel','shelf',
  'countertop','blind','cost_constant','rule','glossary','general',
];

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function KbProposalForm({ mode, baseEntry, authorId, onSubmitted }: KbProposalFormProps) {
  const navigate = useNavigate();
  const { categories } = useKbStore();
  const isEdit = mode === 'edit' && !!baseEntry;

  const [title, setTitle]           = useState(baseEntry?.title ?? '');
  const [slug, setSlug]             = useState(baseEntry?.slug ?? '');
  const [categoryId, setCategoryId] = useState(baseEntry?.category_id ?? categories[0]?.id ?? '');
  const [entryType, setEntryType]   = useState<KbEntryType>(baseEntry?.entry_type ?? 'general');
  const [bodyMd, setBodyMd]         = useState(baseEntry?.body_md ?? '');
  const [tagsCsv, setTagsCsv]       = useState((baseEntry?.tags ?? []).join(', '));
  const [summary, setSummary]       = useState('');
  const [description, setDescription] = useState('');
  const [submitAsDraft, setSubmitAsDraft] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const tags = tagsCsv.split(',').map((t) => t.trim()).filter(Boolean);

    try {
      const row = {
        kind: mode,
        target_entry_id: isEdit ? (baseEntry?.id ?? null) : null,
        base_version: isEdit ? (baseEntry?.current_version ?? null) : null,
        proposed_slug: slug || (title ? slugify(title) : null),
        proposed_title: title || null,
        proposed_category_id: categoryId || null,
        proposed_entry_type: entryType,
        proposed_body_md: bodyMd,
        proposed_tags: tags,
        summary: summary || (isEdit ? `Edit: ${baseEntry?.title}` : `Create: ${title}`),
        description_md: description || null,
        state: submitAsDraft ? 'draft' : 'open',
        author_id: authorId,
      };
      const proposal = await createProposal(row);
      if (onSubmitted) onSubmitted(proposal.id);
      else navigate(`/kb/proposals/${proposal.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed');
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="glass-white rounded-2xl p-4 sm:p-5 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Title"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (!isEdit && !slug) setSlug(slugify(e.target.value));
            }}
            required
          />
          <Input
            label="Slug"
            value={slug}
            onChange={(e) => setSlug(slugify(e.target.value))}
            required
            disabled={isEdit}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full rounded-lg glass-white border border-white/80 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/60"
              required
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.section_num ? `${c.section_num} · ` : ''}
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Entry type</label>
            <select
              value={entryType}
              onChange={(e) => setEntryType(e.target.value as KbEntryType)}
              className="w-full rounded-lg glass-white border border-white/80 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/60"
              required
            >
              {ENTRY_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        <Input
          label="Tags (comma-separated)"
          value={tagsCsv}
          onChange={(e) => setTagsCsv(e.target.value)}
          placeholder="rule, edgeband, waste"
        />
      </div>

      <div className="glass-white rounded-2xl p-4 sm:p-5">
        <label className="block text-sm font-medium text-slate-700 mb-1">Body (Markdown)</label>
        <textarea
          value={bodyMd}
          onChange={(e) => setBodyMd(e.target.value)}
          rows={14}
          className="w-full rounded-lg glass-white border border-white/80 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400/60"
          placeholder="Markdown content — supports tables, code blocks, blockquotes, and [[kb:slug|Name]] cross-links."
        />
        <p className="text-xs text-slate-500 mt-1">
          Cross-links: <code className="font-mono">[[kb:slug|Name]]</code>, <code className="font-mono">[[supplier:slug|Name]]</code>, <code className="font-mono">[[material:uuid|Name]]</code>.
        </p>
      </div>

      <div className="glass-white rounded-2xl p-4 sm:p-5 space-y-3">
        <Input
          label="Proposal summary (PR title)"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder={isEdit ? `Edit: ${baseEntry?.title}` : `Create: ${title || 'new entry'}`}
        />
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Description (optional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full rounded-lg glass-white border border-white/80 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/60"
            placeholder="Context / rationale for reviewers."
          />
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={submitAsDraft}
            onChange={(e) => setSubmitAsDraft(e.target.checked)}
            className="rounded border-slate-300"
          />
          Save as draft (not submitted for review)
        </label>
      </div>

      {error && (
        <div className="glass-white rounded-xl p-3 border border-red-200/70 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="ghost" onClick={() => navigate(-1)}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={submitting}>
          {submitting ? 'Submitting…' : submitAsDraft ? 'Save draft' : 'Submit proposal'}
        </Button>
      </div>
    </form>
  );
}
