import { useState, forwardRef, useImperativeHandle, useEffect, useRef } from 'react';
import { Send, Trash2, CornerDownRight, X, User, Users } from 'lucide-react';
import { useEditor, EditorContent, ReactRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Mention from '@tiptap/extension-mention';
import LinkExt from '@tiptap/extension-link';
import type { SuggestionProps, SuggestionKeyDownProps } from '@tiptap/suggestion';
import tippy from 'tippy.js';
import type { Instance as TippyInstance } from 'tippy.js';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabase';
import type { TaskComment, TaskCommentReply, TeamMember, Department } from '../../types';
import { extractMentionIds, notifyMentions } from '../../lib/notifications';
import { useCurrentMember } from '../../lib/useCurrentMember';

// ---------------------------------------------------------------------------
// Mention suggestion (team members + departments)
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

interface SuggestionListRef {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
}

interface SuggestionListProps {
  items: MentionItem[];
  command: (item: MentionItem) => void;
}

const MentionSuggestionList = forwardRef<SuggestionListRef, SuggestionListProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);
    useEffect(() => setSelectedIndex(0), [items]);

    useImperativeHandle(ref, () => ({
      onKeyDown({ event }: SuggestionKeyDownProps) {
        if (event.key === 'ArrowUp') {
          setSelectedIndex((i) => (i + items.length - 1) % Math.max(items.length, 1));
          return true;
        }
        if (event.key === 'ArrowDown') {
          setSelectedIndex((i) => (i + 1) % Math.max(items.length, 1));
          return true;
        }
        if (event.key === 'Enter') {
          if (items[selectedIndex]) command(items[selectedIndex]);
          return true;
        }
        return false;
      },
    }));

    if (!items.length) {
      return (
        <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 w-60 text-center">
          <p className="text-xs text-slate-400">No results</p>
        </div>
      );
    }

    // Group by type
    const groups: Partial<Record<MentionItem['group'], MentionItem[]>> = {};
    for (const item of items) {
      if (!groups[item.group]) groups[item.group] = [];
      groups[item.group]!.push(item);
    }

    let flatIdx = 0;

    return (
      <div className="bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden w-64 max-h-64 overflow-y-auto">
        {(Object.keys(groups) as MentionItem['group'][]).map((group) => {
          const cfg = GROUP_CONFIG[group];
          const { Icon } = cfg;
          return (
            <div key={group}>
              <div className="px-3 py-1 bg-slate-50 border-b border-slate-100 sticky top-0">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
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
                    className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                      isSelected ? 'bg-blue-50 text-blue-900' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    @{item.label}
                    {item.subtitle && <span className="text-xs text-slate-400 ml-1">{item.subtitle}</span>}
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
    ...teamMembers.map((m) => ({
      id: m.id,
      label: m.name,
      group: 'member' as const,
      subtitle: m.job_title || undefined,
    })),
    ...departments.map((d) => ({
      id: `dept:${d.id}`,
      label: d.name,
      group: 'department' as const,
    })),
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
            if (props.clientRect) {
              popup[0]?.setProps({ getReferenceClientRect: props.clientRect as () => DOMRect });
            }
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
// Comment editor
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
      LinkExt.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: placeholder ?? 'Write a comment… use @ to mention people or teams' }),
      buildMentionExtension(mentionItems),
    ],
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[60px] px-3 py-2 text-sm text-slate-700',
      },
    },
  });

  function submit() {
    if (!editor || editor.isEmpty) return;
    const json = editor.getJSON();
    onSubmit(editor.getHTML(), json);
    editor.commands.clearContent();
  }

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
      <EditorContent editor={editor} />
      <div className="flex items-center justify-end gap-2 px-2 py-1.5 bg-slate-50 border-t border-slate-100">
        {onCancel && (
          <button onClick={onCancel} className="text-xs text-slate-400 hover:text-slate-600">Cancel</button>
        )}
        <button
          onClick={submit}
          className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 disabled:text-slate-300"
        >
          <Send className="h-3 w-3" />
          {compact ? 'Reply' : 'Comment'}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main TaskComments component
// ---------------------------------------------------------------------------

interface Props {
  taskId: string;
  projectId: string;
  comments: TaskComment[];
  teamMembers: TeamMember[];
  onChange: (comments: TaskComment[]) => void;
}

export function TaskComments({ taskId, projectId, comments, teamMembers, onChange }: Props) {
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const { member: currentMember } = useCurrentMember();
  const [authorName, setAuthorName] = useState(() => localStorage.getItem('task_comment_author') || '');
  const [showAuthorInput, setShowAuthorInput] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);

  useEffect(() => {
    supabase.from('departments').select('*').order('display_order')
      .then(({ data }) => setDepartments(data || []));
  }, []);

  const mentionItems = buildMentionItems(teamMembers, departments);

  // Pick an author member id if name matches
  function getAuthorId(): string | null {
    const match = teamMembers.find((m) => m.name.toLowerCase() === authorName.trim().toLowerCase());
    return match?.id ?? null;
  }

  async function addComment(html: string, editorJson: unknown) {
    const authorId = currentMember?.id ?? getAuthorId();
    const authorName_ = currentMember?.name ?? authorName;
    const { data } = await supabase
      .from('task_comments')
      .insert({
        task_id: taskId,
        author_id: authorId,
        body: html,
      })
      .select()
      .single();

    if (data) {
      const newComment: TaskComment = {
        ...data,
        author_name: authorId
          ? teamMembers.find((m) => m.id === authorId)?.name
          : authorName || undefined,
        replies: [],
      };
      onChange([...comments, newComment]);

      // Notify mentioned users/departments
      notifyMentions({
        content: editorJson,
        actorId: authorId,
        actorName: authorName_,
        type: 'mention_task_comment',
        title: 'Mentioned you in a task comment',
        projectId,
        referenceType: 'task_comment',
        referenceId: data.id,
      }).catch(console.error);
    }
  }

  async function addReply(commentId: string, html: string, editorJson: unknown) {
    const authorId = currentMember?.id ?? getAuthorId();
    const authorName_ = currentMember?.name ?? authorName;
    const { data } = await supabase
      .from('task_comment_replies')
      .insert({
        comment_id: commentId,
        author_id: authorId,
        body: html,
      })
      .select()
      .single();

    if (data) {
      const newReply: TaskCommentReply = {
        ...data,
        author_name: authorId
          ? teamMembers.find((m) => m.id === authorId)?.name
          : authorName || undefined,
      };
      onChange(
        comments.map((c) =>
          c.id === commentId ? { ...c, replies: [...(c.replies ?? []), newReply] } : c
        )
      );
      setReplyingTo(null);

      notifyMentions({
        content: editorJson,
        actorId: authorId,
        actorName: authorName_,
        type: 'mention_task_comment_reply',
        title: 'Mentioned you in a task reply',
        projectId,
        referenceType: 'task_comment_reply',
        referenceId: data.id,
      }).catch(console.error);
    }
  }

  async function deleteComment(id: string) {
    await supabase.from('task_comments').delete().eq('id', id);
    onChange(comments.filter((c) => c.id !== id));
  }

  async function deleteReply(commentId: string, replyId: string) {
    await supabase.from('task_comment_replies').delete().eq('id', replyId);
    onChange(
      comments.map((c) =>
        c.id === commentId
          ? { ...c, replies: (c.replies ?? []).filter((r) => r.id !== replyId) }
          : c
      )
    );
  }

  function saveAuthor(name: string) {
    setAuthorName(name);
    localStorage.setItem('task_comment_author', name);
    setShowAuthorInput(false);
  }

  return (
    <div className="space-y-3">
      {/* Author selector */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-slate-400">Commenting as:</span>
        {showAuthorInput ? (
          <div className="flex items-center gap-1">
            <input
              type="text"
              defaultValue={authorName}
              onBlur={(e) => saveAuthor(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveAuthor((e.target as HTMLInputElement).value); }}
              autoFocus
              className="text-xs border border-slate-200 rounded px-2 py-0.5 w-32 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        ) : (
          <button
            onClick={() => setShowAuthorInput(true)}
            className="text-xs font-medium text-blue-600 hover:text-blue-700"
          >
            {authorName || 'Set your name'}
          </button>
        )}
      </div>

      {/* Existing comments */}
      {comments.map((comment) => (
        <div key={comment.id} className="space-y-2">
          {/* Comment bubble */}
          <div className="flex items-start gap-2 group">
            <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
              {(comment.author_name || 'U').slice(0, 1).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-xs font-semibold text-slate-700">
                  {comment.author_name || 'Anonymous'}
                </span>
                <span className="text-[10px] text-slate-400">
                  {format(new Date(comment.created_at), 'MMM d, HH:mm')}
                </span>
              </div>
              <div
                className="text-sm text-slate-700 prose prose-sm max-w-none [&_.mention]:text-blue-600 [&_.mention]:font-medium"
                dangerouslySetInnerHTML={{ __html: comment.body }}
              />
              <div className="flex items-center gap-3 mt-1">
                <button
                  onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                  className="text-[10px] text-slate-400 hover:text-blue-600 flex items-center gap-0.5 transition-colors"
                >
                  <CornerDownRight className="h-2.5 w-2.5" />
                  Reply
                </button>
                <button
                  onClick={() => deleteComment(comment.id)}
                  className="text-[10px] text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all flex items-center gap-0.5"
                >
                  <Trash2 className="h-2.5 w-2.5" />
                  Delete
                </button>
              </div>
            </div>
          </div>

          {/* Replies */}
          {(comment.replies ?? []).length > 0 && (
            <div className="ml-8 space-y-2 border-l-2 border-slate-100 pl-3">
              {(comment.replies ?? []).map((reply) => (
                <div key={reply.id} className="flex items-start gap-2 group">
                  <div className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-[9px] font-bold flex-shrink-0 mt-0.5">
                    {(reply.author_name || 'U').slice(0, 1).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 mb-0.5">
                      <span className="text-xs font-semibold text-slate-600">
                        {reply.author_name || 'Anonymous'}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {format(new Date(reply.created_at), 'MMM d, HH:mm')}
                      </span>
                    </div>
                    <div
                      className="text-xs text-slate-700 prose prose-sm max-w-none [&_.mention]:text-blue-600"
                      dangerouslySetInnerHTML={{ __html: reply.body }}
                    />
                  </div>
                  <button
                    onClick={() => deleteReply(comment.id, reply.id)}
                    className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all mt-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Reply editor */}
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

      {/* New comment editor */}
      <CommentEditor
        mentionItems={mentionItems}
        onSubmit={addComment}
      />
    </div>
  );
}
