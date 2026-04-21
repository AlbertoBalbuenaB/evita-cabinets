import { useState, forwardRef, useImperativeHandle, useEffect } from 'react';
import { Send, Trash2, CornerDownRight, X, User, Users } from 'lucide-react';
import { useEditor, EditorContent, ReactRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Mention from '@tiptap/extension-mention';
import type { SuggestionProps, SuggestionKeyDownProps } from '@tiptap/suggestion';
import tippy from 'tippy.js';
import type { Instance as TippyInstance } from 'tippy.js';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { notifyMentions } from '../../lib/notifications';
import { useCurrentMember } from '../../lib/useCurrentMember';
import type { TeamMember, Department } from '../../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PurchaseCommentReply {
  id: string;
  comment_id: string;
  author_id: string | null;
  author_name: string;
  body: string;
  created_at: string;
}

export interface PurchaseComment {
  id: string;
  purchase_item_id: string;
  author_id: string | null;
  author_name: string;
  body: string;
  created_at: string;
  replies?: PurchaseCommentReply[];
}

// ---------------------------------------------------------------------------
// Mention suggestion (team members + departments) — same pattern as TaskComments
// ---------------------------------------------------------------------------

interface MentionItem {
  id: string;
  label: string;
  group: 'member' | 'department';
  subtitle?: string;
}

const GROUP_CONFIG = {
  member:     { label: 'Team Members', Icon: User,  iconColor: 'text-sky-600',     iconBg: 'bg-sky-100'     },
  department: { label: 'Departments',  Icon: Users, iconColor: 'text-emerald-600', iconBg: 'bg-emerald-100' },
} as const;

interface SuggestionListRef { onKeyDown: (props: SuggestionKeyDownProps) => boolean; }
interface SuggestionListProps { items: MentionItem[]; command: (item: MentionItem) => void; }

const MentionSuggestionList = forwardRef<SuggestionListRef, SuggestionListProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);
    useEffect(() => setSelectedIndex(0), [items]);

    useImperativeHandle(ref, () => ({
      onKeyDown({ event }: SuggestionKeyDownProps) {
        if (event.key === 'ArrowUp') { setSelectedIndex((i) => (i + items.length - 1) % Math.max(items.length, 1)); return true; }
        if (event.key === 'ArrowDown') { setSelectedIndex((i) => (i + 1) % Math.max(items.length, 1)); return true; }
        if (event.key === 'Enter') { if (items[selectedIndex]) command(items[selectedIndex]); return true; }
        return false;
      },
    }));

    if (!items.length) {
      return <div className="bg-surf-card border border-border-soft rounded-xl shadow-lg p-3 w-60 text-center"><p className="text-xs text-fg-400">No results</p></div>;
    }

    const groups: Partial<Record<MentionItem['group'], MentionItem[]>> = {};
    for (const item of items) {
      if (!groups[item.group]) groups[item.group] = [];
      groups[item.group]!.push(item);
    }
    let flatIdx = 0;

    return (
      <div className="bg-surf-card border border-border-soft rounded-xl shadow-lg overflow-hidden w-64 max-h-64 overflow-y-auto">
        {(Object.keys(groups) as MentionItem['group'][]).map((group) => {
          const cfg = GROUP_CONFIG[group];
          const { Icon } = cfg;
          return (
            <div key={group}>
              <div className="px-3 py-1 bg-surf-app border-b border-border-soft sticky top-0">
                <span className="text-[10px] font-semibold text-fg-500 uppercase tracking-wider flex items-center gap-1">
                  <Icon className={`h-3 w-3 ${cfg.iconColor}`} />
                  {cfg.label}
                </span>
              </div>
              {groups[group]!.map((item) => {
                const itemIdx = flatIdx++;
                const isSelected = itemIdx === selectedIndex;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => command(item)}
                    className={`w-full text-left px-3 py-2 text-sm transition-colors ${isSelected ? 'bg-blue-50 text-blue-900' : 'text-fg-700 hover:bg-surf-app'}`}
                  >
                    @{item.label}
                    {item.subtitle && <span className="text-xs text-fg-400 ml-1">{item.subtitle}</span>}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  }
);
MentionSuggestionList.displayName = 'MentionSuggestionList';

function buildMentionItems(teamMembers: TeamMember[], departments: Department[]): MentionItem[] {
  return [
    ...teamMembers.map((m) => ({ id: m.id, label: m.name, group: 'member' as const, subtitle: m.job_title || undefined })),
    ...departments.map((d) => ({ id: `dept:${d.id}`, label: d.name, group: 'department' as const })),
  ];
}

function buildMentionExtension(allItems: MentionItem[]) {
  return Mention.configure({
    HTMLAttributes: { class: 'mention text-blue-600 font-medium' },
    suggestion: {
      items: ({ query }: { query: string }) => {
        const q = query.toLowerCase();
        if (!q) return allItems.slice(0, 12);
        return allItems.filter((m) => m.label.toLowerCase().includes(q) || (m.subtitle?.toLowerCase().includes(q) ?? false)).slice(0, 12);
      },
      render: () => {
        let renderer: ReactRenderer<SuggestionListRef>;
        let popup: TippyInstance[];
        return {
          onStart: (props: SuggestionProps) => {
            renderer = new ReactRenderer(MentionSuggestionList, { props, editor: props.editor });
            if (!props.clientRect) return;
            popup = tippy('body', {
              getReferenceClientRect: props.clientRect as () => DOMRect,
              appendTo: () => document.body,
              content: renderer.element,
              showOnCreate: true,
              interactive: true,
              trigger: 'manual',
              placement: 'bottom-start',
            });
          },
          onUpdate: (props: SuggestionProps) => {
            renderer.updateProps(props);
            if (props.clientRect) popup[0]?.setProps({ getReferenceClientRect: props.clientRect as () => DOMRect });
          },
          onKeyDown: (props: SuggestionKeyDownProps) => {
            if (props.event.key === 'Escape') { popup[0]?.hide(); return true; }
            return renderer.ref?.onKeyDown(props) ?? false;
          },
          onExit: () => { popup[0]?.destroy(); renderer.destroy(); },
        };
      },
    },
  });
}

// ---------------------------------------------------------------------------
// Editor component
// ---------------------------------------------------------------------------

interface EditorProps {
  mentionItems: MentionItem[];
  placeholder?: string;
  onSubmit: (html: string, editorJson: unknown) => void;
  onCancel?: () => void;
  compact?: boolean;
}

function CommentEditor({ mentionItems, placeholder, onSubmit, onCancel, compact }: EditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false, blockquote: false, codeBlock: false }),
      Placeholder.configure({ placeholder: placeholder ?? 'Write a comment… use @ to mention people' }),
      buildMentionExtension(mentionItems),
    ],
    editorProps: {
      attributes: { class: 'prose prose-sm max-w-none focus:outline-none min-h-[52px] px-3 py-2 text-sm text-fg-700' },
    },
  });

  function submit() {
    if (!editor || editor.isEmpty) return;
    const json = editor.getJSON();
    onSubmit(editor.getHTML(), json);
    editor.commands.clearContent();
  }

  return (
    <div className="border border-border-soft rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
      <EditorContent editor={editor} />
      <div className="flex items-center justify-end gap-2 px-2 py-1.5 bg-surf-app border-t border-border-soft">
        {onCancel && <button onClick={onCancel} className="text-xs text-fg-400 hover:text-fg-600">Cancel</button>}
        <button
          onClick={submit}
          className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
        >
          <Send className="h-3 w-3" />
          {compact ? 'Reply' : 'Send'}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main PurchaseItemComments component
// ---------------------------------------------------------------------------

interface Props {
  purchaseItemId: string;
  projectId: string;
  teamMembers: TeamMember[];
}

export function PurchaseItemComments({ purchaseItemId, projectId, teamMembers }: Props) {
  const [comments, setComments] = useState<PurchaseComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const { member: currentMember } = useCurrentMember();

  useEffect(() => {
    supabase.from('departments').select('*').order('display_order')
      .then(({ data }) => setDepartments(data || []));
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from('purchase_item_comments' as any)
        .select('*, replies:purchase_item_comment_replies(*)')
        .eq('purchase_item_id', purchaseItemId)
        .order('created_at');
      setComments((data as unknown as PurchaseComment[]) || []);
      setLoading(false);
    }
    load();
  }, [purchaseItemId]);

  const mentionItems = buildMentionItems(teamMembers, departments);

  async function addComment(html: string, editorJson: unknown) {
    const authorId = currentMember?.id ?? null;
    const authorName = currentMember?.name ?? 'Anonymous';
    const { data } = await supabase
      .from('purchase_item_comments' as any)
      .insert({ purchase_item_id: purchaseItemId, author_id: authorId, author_name: authorName, body: html })
      .select()
      .single();
    if (data) {
      const dataAny = data as any;
      setComments((prev) => [...prev, { ...dataAny, replies: [] }]);
      const plainBody = html.replace(/<[^>]*>/g, '').trim().slice(0, 150);
      notifyMentions({
        content: editorJson,
        actorId: authorId,
        actorName: authorName,
        type: 'mention_purchase_comment',
        title: 'Mentioned you in a purchase comment',
        body: plainBody || null,
        projectId,
        referenceType: 'purchase_item_comment',
        referenceId: dataAny.id,
      }).catch(console.error);
    }
  }

  async function addReply(commentId: string, html: string, editorJson: unknown) {
    const authorId = currentMember?.id ?? null;
    const authorName = currentMember?.name ?? 'Anonymous';
    const { data } = await supabase
      .from('purchase_item_comment_replies' as any)
      .insert({ comment_id: commentId, author_id: authorId, author_name: authorName, body: html })
      .select()
      .single();
    if (data) {
      const dataAny = data as any;
      setComments((prev) =>
        prev.map((c) => c.id === commentId ? { ...c, replies: [...(c.replies ?? []), dataAny as PurchaseCommentReply] } : c)
      );
      setReplyingTo(null);
      const plainBody = html.replace(/<[^>]*>/g, '').trim().slice(0, 150);
      notifyMentions({
        content: editorJson,
        actorId: authorId,
        actorName: authorName,
        type: 'mention_purchase_comment_reply',
        title: 'Mentioned you in a purchase reply',
        body: plainBody || null,
        projectId,
        referenceType: 'purchase_item_comment_reply',
        referenceId: dataAny.id,
      }).catch(console.error);
    }
  }

  async function deleteComment(id: string) {
    await supabase.from('purchase_item_comments' as any).delete().eq('id', id);
    setComments((prev) => prev.filter((c) => c.id !== id));
  }

  async function deleteReply(commentId: string, replyId: string) {
    await supabase.from('purchase_item_comment_replies' as any).delete().eq('id', replyId);
    setComments((prev) =>
      prev.map((c) => c.id === commentId ? { ...c, replies: (c.replies ?? []).filter((r) => r.id !== replyId) } : c)
    );
  }

  if (loading) {
    return <div className="space-y-2">{[1, 2].map((i) => <div key={i} className="h-10 bg-surf-muted rounded-lg animate-pulse" />)}</div>;
  }

  return (
    <div className="space-y-3">
      {comments.length === 0 && (
        <p className="text-xs text-fg-400 text-center py-2">No comments yet. Be the first to comment.</p>
      )}

      {comments.map((comment) => (
        <div key={comment.id} className="space-y-2">
          <div className="flex items-start gap-2 group">
            <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
              {(comment.author_name || 'U').slice(0, 1).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 mb-0.5">
                <span className="text-xs font-semibold text-fg-700">{comment.author_name || 'Anonymous'}</span>
                <span className="text-[10px] text-fg-400">{format(new Date(comment.created_at), 'MMM d, HH:mm')}</span>
              </div>
              <div
                className="text-sm text-fg-700 prose prose-sm max-w-none [&_.mention]:text-blue-600 [&_.mention]:font-medium"
                dangerouslySetInnerHTML={{ __html: comment.body }}
              />
              <div className="flex items-center gap-3 mt-1">
                <button
                  onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                  className="text-[10px] text-fg-400 hover:text-blue-600 flex items-center gap-0.5 transition-colors"
                >
                  <CornerDownRight className="h-2.5 w-2.5" />
                  Reply
                </button>
                {(!comment.author_id || comment.author_id === currentMember?.id) && (
                  <button
                    onClick={() => deleteComment(comment.id)}
                    className="text-[10px] text-fg-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all flex items-center gap-0.5"
                  >
                    <Trash2 className="h-2.5 w-2.5" />
                    Delete
                  </button>
                )}
              </div>
            </div>
          </div>

          {(comment.replies ?? []).length > 0 && (
            <div className="ml-8 space-y-2 border-l-2 border-border-soft pl-3">
              {(comment.replies ?? []).map((reply) => (
                <div key={reply.id} className="flex items-start gap-2 group">
                  <div className="w-5 h-5 rounded-full bg-surf-muted text-fg-500 flex items-center justify-center text-[9px] font-bold flex-shrink-0 mt-0.5">
                    {(reply.author_name || 'U').slice(0, 1).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 mb-0.5">
                      <span className="text-xs font-semibold text-fg-600">{reply.author_name || 'Anonymous'}</span>
                      <span className="text-[10px] text-fg-400">{format(new Date(reply.created_at), 'MMM d, HH:mm')}</span>
                    </div>
                    <div
                      className="text-xs text-fg-700 prose prose-sm max-w-none [&_.mention]:text-blue-600"
                      dangerouslySetInnerHTML={{ __html: reply.body }}
                    />
                  </div>
                  {(!reply.author_id || reply.author_id === currentMember?.id) && (
                    <button
                      onClick={() => deleteReply(comment.id, reply.id)}
                      className="opacity-0 group-hover:opacity-100 text-fg-300 hover:text-red-500 transition-all mt-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {replyingTo === comment.id && (
            <div className="ml-8">
              <CommentEditor
                mentionItems={mentionItems}
                placeholder="Write a reply…"
                onSubmit={(html, json) => addReply(comment.id, html, json)}
                onCancel={() => setReplyingTo(null)}
                compact
              />
            </div>
          )}
        </div>
      ))}

      <CommentEditor mentionItems={mentionItems} onSubmit={addComment} />
    </div>
  );
}
