import { useState } from 'react';
import { Modal } from '../Modal';
import { Button } from '../Button';
import { useTakeoffStore } from '../../hooks/useTakeoffStore';
import { addRootCommentToSupabase } from '../../lib/takeoff/supabase';

// Modal for posting a *new* root comment. Pre-condition: caller has set
// pendingCommentPos and showCommentInput in the store via the Comment tool.
export function CommentInputModal() {
  const {
    showCommentInput, pendingCommentPos, currentSessionId, currentPage,
    setShowCommentInput, setPendingCommentPos, upsertCommentLocal, setOpenComment,
  } = useTakeoffStore();

  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setShowCommentInput(false);
    setPendingCommentPos(null);
    setText('');
    setError(null);
  };

  const submit = async () => {
    const trimmed = text.trim();
    if (!trimmed || !pendingCommentPos || !currentSessionId) return;
    setSubmitting(true);
    setError(null);
    try {
      const comment = await addRootCommentToSupabase({
        sessionId: currentSessionId,
        text: trimmed,
        positionX: pendingCommentPos.x,
        positionY: pendingCommentPos.y,
        page: currentPage,
      });
      upsertCommentLocal(comment);
      setOpenComment(comment.id);
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (!showCommentInput || !pendingCommentPos) return null;

  return (
    <Modal isOpen onClose={close} title="Add comment" size="sm">
      <div className="space-y-3">
        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit();
            if (e.key === 'Escape') close();
          }}
          rows={4}
          placeholder="What did you find? e.g. 'Confirm these base widths are 36&quot;'"
          className="w-full text-sm border border-border-soft rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus-visible:ring-focus resize-none"
        />
        <p className="text-[10px] text-fg-400">Tip: ⌘↵ / Ctrl+↵ to post.</p>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={close} disabled={submitting}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={submit} disabled={submitting || !text.trim()}>
            {submitting ? 'Posting…' : 'Post'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
