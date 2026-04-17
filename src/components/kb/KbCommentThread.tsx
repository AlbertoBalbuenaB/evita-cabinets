import { useEffect, useState } from 'react';
import { MessageCircle, Send } from 'lucide-react';
import { Button } from '../Button';
import {
  createComment,
  fetchComments,
  plainTextToTiptap,
  tiptapToPlainText,
} from '../../lib/kb/kbApi';
import type { KbComment } from '../../lib/kb/kbTypes';

interface KbCommentThreadProps {
  proposalId?: string;
  entryId?: string;
  authorId: string;
  memberNames: Record<string, string>;
}

export function KbCommentThread({ proposalId, entryId, authorId, memberNames }: KbCommentThreadProps) {
  const [comments, setComments] = useState<KbComment[]>([]);
  const [loading, setLoading]   = useState(true);
  const [text, setText]         = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchComments({ proposalId, entryId })
      .then((rows) => {
        if (active) setComments(rows);
      })
      .catch((err) => {
        if (active) setError(err.message ?? 'Fetch failed');
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [proposalId, entryId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const row = await createComment({
        proposal_id: proposalId ?? null,
        entry_id: entryId ?? null,
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
      <h3 className="text-sm font-semibold text-slate-900 mb-3 uppercase tracking-wide flex items-center gap-2">
        <MessageCircle className="w-4 h-4 text-indigo-500" />
        Comments {comments.length > 0 && <span className="text-slate-500 font-normal">({comments.length})</span>}
      </h3>

      {loading ? (
        <div className="space-y-2">
          <div className="h-12 rounded-xl skeleton-shimmer" />
          <div className="h-12 rounded-xl skeleton-shimmer" />
        </div>
      ) : comments.length === 0 ? (
        <p className="text-sm text-slate-500 italic mb-3">Sin comentarios todavía. Sé el primero.</p>
      ) : (
        <ul className="space-y-3 mb-4">
          {comments.map((c) => {
            const text = tiptapToPlainText(c.body_tiptap);
            const authorName = memberNames[c.author_id] ?? 'Unknown';
            return (
              <li key={c.id} className="glass-white rounded-xl p-3 border border-slate-200/60 row-enter">
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <span className="text-sm font-semibold text-slate-800">{authorName}</span>
                  <span className="text-xs text-slate-500">{new Date(c.created_at).toLocaleString()}</span>
                </div>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{text}</p>
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
          className="w-full rounded-lg glass-white border border-white/80 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/60"
        />
        {error && <div className="text-xs text-red-700">{error}</div>}
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
