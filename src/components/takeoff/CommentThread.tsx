import { useState } from 'react';
import { Modal } from '../Modal';
import { Button } from '../Button';
import { CheckCircle2, Circle, Trash2, Loader2 } from 'lucide-react';
import { useTakeoffStore } from '../../hooks/useTakeoffStore';
import {
  addReplyToSupabase,
  setCommentResolved,
  deleteCommentFromSupabase,
  type TakeoffComment,
} from '../../lib/takeoff/supabase';

// Modal showing the full thread for a root comment: the root text, author,
// timestamp, resolve toggle, all replies, and a reply input. Opens when the
// user clicks an existing comment pin (openCommentId in the store).
export function CommentThread() {
  const { openCommentId, comments, setOpenComment, upsertCommentLocal, removeCommentLocal, currentSessionId } = useTakeoffStore();
  const [replyText, setReplyText] = useState('');
  const [busy, setBusy] = useState<'reply' | 'resolve' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const root = openCommentId ? comments.find((c) => c.id === openCommentId) ?? null : null;
  const replies = root ? comments.filter((c) => c.parentCommentId === root.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt)) : [];

  const close = () => {
    setOpenComment(null);
    setReplyText('');
    setError(null);
  };

  const postReply = async () => {
    const trimmed = replyText.trim();
    if (!trimmed || !root || !currentSessionId) return;
    setBusy('reply');
    setError(null);
    try {
      const reply = await addReplyToSupabase({
        sessionId: currentSessionId,
        parentCommentId: root.id,
        text: trimmed,
      });
      upsertCommentLocal(reply);
      setReplyText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const toggleResolve = async () => {
    if (!root) return;
    setBusy('resolve');
    setError(null);
    try {
      const updated = await setCommentResolved(root.id, !root.resolved);
      upsertCommentLocal(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const deleteThread = async () => {
    if (!root) return;
    if (!window.confirm('Delete this comment and all its replies?')) return;
    setBusy('delete');
    setError(null);
    try {
      await deleteCommentFromSupabase(root.id);
      // Cascade locally: the cascade FK handles it in the DB but we still need
      // to clear the local store so the pin disappears immediately.
      replies.forEach((r) => removeCommentLocal(r.id));
      removeCommentLocal(root.id);
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  if (!root) return null;

  return (
    <Modal isOpen onClose={close} title={root.resolved ? 'Comment (resolved)' : 'Comment'} size="md">
      <div className="space-y-3">
        <CommentBlock comment={root} isRoot />
        {replies.length > 0 && (
          <div className="border-l-2 border-slate-200 pl-3 space-y-2">
            {replies.map((r) => <CommentBlock key={r.id} comment={r} />)}
          </div>
        )}

        {!root.resolved && (
          <div>
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) postReply(); }}
              rows={2}
              placeholder="Write a reply…"
              className="w-full text-sm border border-slate-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
            />
            <p className="text-[10px] text-slate-400 mt-0.5">⌘↵ / Ctrl+↵ to post</p>
          </div>
        )}

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
          <button
            onClick={deleteThread}
            disabled={busy !== null}
            className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-red-600 disabled:opacity-40"
            title="Delete comment"
          >
            {busy === 'delete' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            Delete
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleResolve}
              disabled={busy !== null}
              className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded ${
                root.resolved
                  ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              } disabled:opacity-40`}
            >
              {busy === 'resolve' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : root.resolved ? (
                <Circle className="h-3.5 w-3.5" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              {root.resolved ? 'Reopen' : 'Mark resolved'}
            </button>
            {!root.resolved && (
              <Button variant="primary" size="sm" onClick={postReply} disabled={busy !== null || !replyText.trim()}>
                {busy === 'reply' ? 'Posting…' : 'Reply'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function CommentBlock({ comment, isRoot }: { comment: TakeoffComment; isRoot?: boolean }) {
  return (
    <div className={isRoot ? 'bg-slate-50/80 rounded-lg p-3' : ''}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-semibold text-slate-800">{comment.authorName ?? 'Team member'}</span>
        <span className="text-[10px] text-slate-400">{formatDate(comment.createdAt)}</span>
        {comment.resolved && isRoot && (
          <span className="text-[10px] bg-emerald-100 text-emerald-700 rounded px-1.5 py-0.5 ml-auto">resolved</span>
        )}
      </div>
      <p className="text-sm text-slate-700 whitespace-pre-wrap">{comment.text}</p>
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const diffMin = Math.round((now - d.getTime()) / 60_000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
