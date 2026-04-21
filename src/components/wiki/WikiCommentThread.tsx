import { useEffect, useState } from 'react';
import { MessageCircle, Send } from 'lucide-react';
import { Button } from '../Button';
import {
  createWikiComment,
  fetchWikiComments,
} from '../../lib/wiki/wikiApi';
import {
  plainTextToTiptap,
  tiptapToPlainText,
} from '../../lib/kb/kbApi';
import type { WikiComment } from '../../lib/wiki/wikiTypes';

interface WikiCommentThreadProps {
  proposalId?: string;
  articleId?: string;
  authorId: string;
  memberNames: Record<string, string>;
}

export function WikiCommentThread({ proposalId, articleId, authorId, memberNames }: WikiCommentThreadProps) {
  const [comments, setComments] = useState<WikiComment[]>([]);
  const [loading, setLoading]   = useState(true);
  const [text, setText]         = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchWikiComments({ proposalId, articleId })
      .then((rows) => active && setComments(rows))
      .catch((err) => active && setError(err.message ?? 'Fetch failed'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [proposalId, articleId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const row = await createWikiComment({
        proposal_id: proposalId ?? null,
        article_id: articleId ?? null,
        author_id: authorId,
        body_tiptap: plainTextToTiptap(text) as never,
      });
      setComments((cs) => [...cs, row]);
      setText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Post failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="glass-white rounded-2xl p-4 sm:p-5">
      <h3 className="text-sm font-semibold text-fg-900 mb-3 uppercase tracking-wide flex items-center gap-2">
        <MessageCircle className="w-4 h-4 text-violet-500" />
        Comments {comments.length > 0 && <span className="text-fg-500 font-normal">({comments.length})</span>}
      </h3>

      {loading ? (
        <div className="space-y-2">
          <div className="h-12 rounded-xl skeleton-shimmer" />
          <div className="h-12 rounded-xl skeleton-shimmer" />
        </div>
      ) : comments.length === 0 ? (
        <p className="text-sm text-fg-500 italic mb-3">Sin comentarios todavía.</p>
      ) : (
        <ul className="space-y-3 mb-4">
          {comments.map((c) => {
            const body = tiptapToPlainText(c.body_tiptap);
            const authorName = memberNames[c.author_id] ?? 'Unknown';
            return (
              <li key={c.id} className="glass-white rounded-xl p-3 border border-border-soft row-enter">
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <span className="text-sm font-semibold text-fg-800">{authorName}</span>
                  <span className="text-xs text-fg-500">{new Date(c.created_at).toLocaleString()}</span>
                </div>
                <p className="text-sm text-fg-700 whitespace-pre-wrap">{body}</p>
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={handleSubmit} className="space-y-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          placeholder="Escribe un comentario…"
          className="w-full rounded-lg glass-white border border-white/80 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/60"
        />
        {error && <div className="text-xs text-status-red-fg">{error}</div>}
        <div className="flex justify-end">
          <Button type="submit" variant="primary" size="sm" disabled={!text.trim() || submitting}>
            <Send className="w-3.5 h-3.5 mr-1.5" />
            {submitting ? 'Enviando…' : 'Comentar'}
          </Button>
        </div>
      </form>
    </div>
  );
}
