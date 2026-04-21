import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../Button';
import { Input } from '../Input';
import { useWikiStore } from '../../lib/wiki/wikiStore';
import { createWikiProposal } from '../../lib/wiki/wikiApi';
import type { WikiArticle } from '../../lib/wiki/wikiTypes';

interface WikiProposalFormProps {
  mode: 'create' | 'edit';
  baseArticle?: WikiArticle;
  authorId: string;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function estimateReadingTime(body: string): number {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

export function WikiProposalForm({ mode, baseArticle, authorId }: WikiProposalFormProps) {
  const navigate = useNavigate();
  const { categories } = useWikiStore();
  const isEdit = mode === 'edit' && !!baseArticle;

  const [title, setTitle]           = useState(baseArticle?.title ?? '');
  const [slug, setSlug]             = useState(baseArticle?.slug ?? '');
  const [summary, setSummary]       = useState(baseArticle?.summary ?? '');
  const [categoryId, setCategoryId] = useState(baseArticle?.category_id ?? categories[0]?.id ?? '');
  const [bodyMd, setBodyMd]         = useState(baseArticle?.body_md ?? '');
  const [tagsCsv, setTagsCsv]       = useState((baseArticle?.tags ?? []).join(', '));
  const [readingOverride, setReadingOverride] = useState<string>(
    baseArticle?.reading_time_min != null ? String(baseArticle.reading_time_min) : '',
  );
  const [pSummary, setPSummary]     = useState('');
  const [description, setDescription] = useState('');
  const [submitAsDraft, setSubmitAsDraft] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const tags = tagsCsv.split(',').map((t) => t.trim()).filter(Boolean);
    const readingTime = readingOverride.trim()
      ? Math.max(1, parseInt(readingOverride, 10) || 1)
      : estimateReadingTime(bodyMd);
    try {
      const row = {
        kind: mode,
        target_article_id: isEdit ? (baseArticle?.id ?? null) : null,
        base_version: isEdit ? (baseArticle?.current_version ?? null) : null,
        proposed_slug: slug || (title ? slugify(title) : null),
        proposed_title: title || null,
        proposed_summary: summary || null,
        proposed_category_id: categoryId || null,
        proposed_body_md: bodyMd,
        proposed_tags: tags,
        proposed_reading_time_min: readingTime,
        summary: pSummary || (isEdit ? `Edit: ${baseArticle?.title}` : `Create: ${title}`),
        description_md: description || null,
        state: submitAsDraft ? 'draft' : 'open',
        author_id: authorId,
      };
      const prop = await createWikiProposal(row);
      navigate(`/wiki/proposals/${prop.id}`);
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
        <Input
          label="Summary (one-line)"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="Resumen corto que aparece en la tarjeta."
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-fg-700 mb-1">Category</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full rounded-lg glass-white border border-white/80 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/60"
              required
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <Input
            label="Reading time (min, leave blank for auto)"
            value={readingOverride}
            onChange={(e) => setReadingOverride(e.target.value.replace(/[^0-9]/g, ''))}
            placeholder="auto"
          />
        </div>
        <Input
          label="Tags (comma-separated)"
          value={tagsCsv}
          onChange={(e) => setTagsCsv(e.target.value)}
          placeholder="assembly, slides, soft-close"
        />
      </div>

      <div className="glass-white rounded-2xl p-4 sm:p-5">
        <label className="block text-sm font-medium text-fg-700 mb-1">Body (Markdown)</label>
        <textarea
          value={bodyMd}
          onChange={(e) => setBodyMd(e.target.value)}
          rows={18}
          className="w-full rounded-lg glass-white border border-white/80 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-400/60"
          placeholder="Markdown — supports tables, checklists, blockquotes, and cross-links."
        />
        <p className="text-xs text-fg-500 mt-1">
          Cross-links: <code className="font-mono">[[kb:slug|Name]]</code>, <code className="font-mono">[[supplier:slug|Name]]</code>, <code className="font-mono">[[wiki:slug|Title]]</code>, <code className="font-mono">[[material:uuid|Name]]</code>.
        </p>
      </div>

      <div className="glass-white rounded-2xl p-4 sm:p-5 space-y-3">
        <Input
          label="Proposal summary (PR title)"
          value={pSummary}
          onChange={(e) => setPSummary(e.target.value)}
          placeholder={isEdit ? `Edit: ${baseArticle?.title}` : `Create: ${title || 'new article'}`}
        />
        <div>
          <label className="block text-sm font-medium text-fg-700 mb-1">Description (optional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full rounded-lg glass-white border border-white/80 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/60"
            placeholder="Context / rationale for reviewers."
          />
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-fg-700">
          <input
            type="checkbox"
            checked={submitAsDraft}
            onChange={(e) => setSubmitAsDraft(e.target.checked)}
            className="rounded border-border-solid"
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
