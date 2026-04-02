import { useState, useEffect, useRef, useMemo, forwardRef, useImperativeHandle } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCurrentMember } from '../lib/useCurrentMember';
import {
  ScrollText, Trash2, Pencil, X, Check, Bold, Italic, Underline as UnderlineIcon,
  List, ListOrdered, AlertTriangle, RefreshCw, CheckCircle, XCircle, Trophy, Radio,
  Filter, Clock, Folder, FileText, Package, DollarSign, Users,
  Heading1, Heading2, Heading3, Type, Link2, Link2Off, User,
  CornerDownRight, MessageSquare
} from 'lucide-react';
import { useEditor, EditorContent, ReactRenderer } from '@tiptap/react';
import { generateHTML, mergeAttributes } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import UnderlineExt from '@tiptap/extension-underline';
import { Color } from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import LinkExt from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Mention from '@tiptap/extension-mention';
import type { SuggestionProps, SuggestionKeyDownProps } from '@tiptap/suggestion';
import tippy from 'tippy.js';
import type { Instance as TippyInstance } from 'tippy.js';
import { supabase } from '../lib/supabase';
import { Button } from './Button';
import { format } from 'date-fns';
import type { ProjectLog, ProjectLogReply, TeamMember } from '../types';


// ---------------------------------------------------------------------------
// Log type system
// ---------------------------------------------------------------------------

type LogType = 'note' | 'change' | 'decision' | 'risk' | 'issue' | 'milestone' | 'update';

interface LogTypeConfig {
  label: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Icon: any;
  color: string;
  bg: string;
  border: string;
  badgeBg: string;
}

const LOG_TYPES: Record<LogType, LogTypeConfig> = {
  note:      { label: 'Note',      Icon: FileText,       color: 'text-slate-600',  bg: 'bg-slate-50',   border: 'border-slate-300',  badgeBg: 'bg-slate-100'  },
  change:    { label: 'Change',    Icon: RefreshCw,      color: 'text-amber-600',  bg: 'bg-amber-50',   border: 'border-amber-400',  badgeBg: 'bg-amber-100'  },
  decision:  { label: 'Decision',  Icon: CheckCircle,    color: 'text-blue-600',   bg: 'bg-blue-50',    border: 'border-blue-400',   badgeBg: 'bg-blue-100'   },
  risk:      { label: 'Risk',      Icon: AlertTriangle,  color: 'text-orange-600', bg: 'bg-orange-50',  border: 'border-orange-400', badgeBg: 'bg-orange-100' },
  issue:     { label: 'Issue',     Icon: XCircle,        color: 'text-red-600',    bg: 'bg-red-50',     border: 'border-red-400',    badgeBg: 'bg-red-100'    },
  milestone: { label: 'Milestone', Icon: Trophy,         color: 'text-green-600',  bg: 'bg-green-50',   border: 'border-green-400',  badgeBg: 'bg-green-100'  },
  update:    { label: 'Update',    Icon: Radio,          color: 'text-purple-600', bg: 'bg-purple-50',  border: 'border-purple-400', badgeBg: 'bg-purple-100' },
};

const LOG_TYPE_ORDER: LogType[] = ['note', 'change', 'decision', 'risk', 'issue', 'milestone', 'update'];

// ---------------------------------------------------------------------------
// Mention item types
// ---------------------------------------------------------------------------

interface MentionItem {
  id: string;
  label: string;
  type: 'project' | 'quotation' | 'cabinet' | 'price_item' | 'department' | 'team_member';
  subtitle?: string;
}

const MENTION_TYPE_CONFIG = {
  project:    { groupLabel: 'Projects',   Icon: Folder,    iconColor: 'text-violet-600', iconBg: 'bg-violet-100' },
  quotation:  { groupLabel: 'Quotations', Icon: FileText,  iconColor: 'text-blue-600',   iconBg: 'bg-blue-100'   },
  cabinet:    { groupLabel: 'Cabinets',   Icon: Package,   iconColor: 'text-amber-600',  iconBg: 'bg-amber-100'  },
  price_item:  { groupLabel: 'Price List',  Icon: DollarSign, iconColor: 'text-green-600',   iconBg: 'bg-green-100'   },
  department:   { groupLabel: 'Departments', Icon: Users,      iconColor: 'text-emerald-600', iconBg: 'bg-emerald-100' },
  team_member:  { groupLabel: 'Team Members',Icon: User,       iconColor: 'text-sky-600',     iconBg: 'bg-sky-100'     },
} as const;

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

function mentionToUrl(id: string): string {
  const parts = id.split(':');
  const type = parts[0];
  if (type === 'project')     return `/projects/${parts[1]}`;
  if (type === 'quotation')   return `/projects/${parts[1]}/quotations/${parts[2]}`;
  if (type === 'cabinet')     return isUuid(parts[1]) ? `/products/${parts[1]}` : '/products';
  if (type === 'price_item')    return `/prices/${parts[1]}`;
  if (type === 'department')    return '#';
  if (type === 'team_member')   return '#';
  return '#';
}

// ---------------------------------------------------------------------------
// Rich-text helpers
// ---------------------------------------------------------------------------

function isRichContent(comment: string): boolean {
  try {
    const parsed = JSON.parse(comment);
    return parsed && parsed.type === 'doc';
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Mention suggestion list component (rendered by tippy)
// ---------------------------------------------------------------------------

interface SuggestionListRef {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
}

interface SuggestionListProps {
  items: MentionItem[];
  command: (item: MentionItem) => void;
}

const SuggestionList = forwardRef<SuggestionListRef, SuggestionListProps>(
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
        <div className="bg-white border border-slate-200 rounded-xl shadow-xl p-4 w-72 text-center">
          <p className="text-xs text-slate-500 font-medium">No results</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Keep typing to search…</p>
        </div>
      );
    }

    // Group by type
    const groups: Partial<Record<MentionItem['type'], MentionItem[]>> = {};
    for (const item of items) {
      if (!groups[item.type]) groups[item.type] = [];
      groups[item.type]!.push(item);
    }

    let flatIdx = 0;

    return (
      <div className="bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden w-80 max-h-80 overflow-y-auto">
        {(Object.keys(groups) as MentionItem['type'][]).map((type) => {
          const cfg = MENTION_TYPE_CONFIG[type];
          const { Icon } = cfg;
          return (
            <div key={type}>
              <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-100 sticky top-0">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                  {cfg.groupLabel}
                </span>
              </div>
              {groups[type]!.map((item) => {
                const itemIdx = flatIdx++;
                const isSelected = itemIdx === selectedIndex;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => command(item)}
                    className={`w-full text-left px-3 py-2.5 flex items-center gap-3 transition-colors ${
                      isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-lg ${cfg.iconBg} flex items-center justify-center flex-shrink-0`}>
                      <Icon className={`h-3.5 w-3.5 ${cfg.iconColor}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-medium truncate ${isSelected ? 'text-blue-900' : 'text-slate-800'}`}>
                        {item.label}
                      </p>
                      {item.subtitle && (
                        <p className="text-xs text-slate-400 truncate">{item.subtitle}</p>
                      )}
                    </div>
                    {isSelected && <span className="text-slate-400 text-xs flex-shrink-0">↵</span>}
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
SuggestionList.displayName = 'SuggestionList';

// ---------------------------------------------------------------------------
// Build TipTap mention suggestion config
// ---------------------------------------------------------------------------

function buildMentionSuggestion(getItems: () => MentionItem[]) {
  return {
    items: ({ query }: { query: string }) => {
      const q = query.toLowerCase().trim();
      const all = getItems();
      if (!q) return all.slice(0, 12);
      return all
        .filter(
          (item) =>
            item.label.toLowerCase().includes(q) ||
            (item.subtitle?.toLowerCase().includes(q) ?? false)
        )
        .slice(0, 12);
    },

    render: () => {
      let reactRenderer: ReactRenderer<SuggestionListRef>;
      let popup: TippyInstance[];

      return {
        onStart: (props: SuggestionProps) => {
          reactRenderer = new ReactRenderer(SuggestionList, {
            props,
            editor: props.editor,
          });

          if (!props.clientRect) return;

          popup = tippy('body', {
            getReferenceClientRect: props.clientRect as () => DOMRect,
            appendTo: () => document.body,
            content: reactRenderer.element,
            showOnCreate: true,
            interactive: true,
            trigger: 'manual',
            placement: 'bottom-start',
          });
        },

        onUpdate: (props: SuggestionProps) => {
          reactRenderer.updateProps(props);
          if (!props.clientRect) return;
          popup[0].setProps({
            getReferenceClientRect: props.clientRect as () => DOMRect,
          });
        },

        onKeyDown: (props: SuggestionKeyDownProps) => {
          if (props.event.key === 'Escape') {
            popup[0].hide();
            return true;
          }
          return reactRenderer.ref?.onKeyDown(props) ?? false;
        },

        onExit: () => {
          popup[0].destroy();
          reactRenderer.destroy();
        },
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Custom Mention extension with link rendering in view mode
// ---------------------------------------------------------------------------

// For edit mode: pass a getter so the suggestion always reads fresh data from a ref.
// For view mode (generateHTML): pass null — suggestion is not used.
function buildMentionExtension(getItems: (() => MentionItem[]) | null) {
  return Mention.configure({
    HTMLAttributes: { class: 'mention' },
    renderHTML({ node }) {
      const id = node.attrs.id as string;
      const label = node.attrs.label as string;
      return ['span', { class: 'mention', 'data-mention-id': id }, `@${label}`];
    },
    suggestion: buildMentionSuggestion(getItems ?? (() => [])),
  });
}

// View-only mention extension used inside generateHTML.
// Must use .extend() to actually override the node's renderHTML —
// Mention.configure() only sets options and does NOT override the render method.
const MENTION_VIEW_EXTENSION = Mention.extend({
  renderHTML({ node, HTMLAttributes }) {
    const id = (node.attrs.id as string) ?? '';
    const label = (node.attrs.label as string) ?? node.attrs.id ?? '';
    const url = mentionToUrl(id);
    return [
      'a',
      mergeAttributes(HTMLAttributes, {
        href: url,
        class: 'mention-link',
        'data-mention-id': id,
      }),
      `@${label}`,
    ];
  },
});

function renderContent(comment: string): string {
  if (!isRichContent(comment)) {
    return comment
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');
  }
  try {
    return generateHTML(JSON.parse(comment), [
      StarterKit,
      UnderlineExt,
      TextStyle,
      Color,
      LinkExt.configure({ openOnClick: false }),
      MENTION_VIEW_EXTENSION,
    ]);
  } catch {
    return `<p>${comment}</p>`;
  }
}

// ---------------------------------------------------------------------------
// Toolbar
// ---------------------------------------------------------------------------

const TEXT_COLORS = [
  { label: 'Default', value: null,      display: '#64748b' },
  { label: 'Red',     value: '#ef4444', display: '#ef4444' },
  { label: 'Orange',  value: '#f97316', display: '#f97316' },
  { label: 'Amber',   value: '#f59e0b', display: '#f59e0b' },
  { label: 'Green',   value: '#22c55e', display: '#22c55e' },
  { label: 'Blue',    value: '#3b82f6', display: '#3b82f6' },
  { label: 'Indigo',  value: '#6366f1', display: '#6366f1' },
  { label: 'Violet',  value: '#8b5cf6', display: '#8b5cf6' },
  { label: 'Pink',    value: '#ec4899', display: '#ec4899' },
  { label: 'Gray',    value: '#475569', display: '#475569' },
];

interface ToolbarProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  editor: any;
}

function Toolbar({ editor }: ToolbarProps) {
  const [colorOpen, setColorOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');

  if (!editor) return null;

  const currentColor: string | undefined = editor.getAttributes('textStyle').color;

  // Use onMouseDown + preventDefault on all toolbar buttons so the editor never loses focus
  function tbBtn(active: boolean, onMouseDown: () => void, Icon: React.ElementType, title: string) {
    return (
      <button
        type="button"
        title={title}
        onMouseDown={(e) => { e.preventDefault(); onMouseDown(); }}
        className={`p-1.5 rounded transition-colors ${
          active ? 'bg-slate-200 text-slate-900' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
        }`}
      >
        <Icon className="h-3.5 w-3.5" />
      </button>
    );
  }

  function applyColor(value: string | null) {
    if (value === null) editor.chain().focus().unsetColor().run();
    else editor.chain().focus().setColor(value).run();
    setColorOpen(false);
  }

  function openLink() {
    const existing = editor.getAttributes('link').href as string | undefined;
    setLinkUrl(existing ?? '');
    setLinkOpen(true);
    setColorOpen(false);
  }

  function applyLink() {
    const url = linkUrl.trim();
    if (!url) {
      editor.chain().focus().unsetLink().run();
    } else {
      const href = url.startsWith('http') ? url : `https://${url}`;
      editor.chain().focus().setLink({ href, target: '_blank', rel: 'noopener noreferrer' }).run();
    }
    setLinkOpen(false);
    setLinkUrl('');
  }

  const sep = <div className="w-px h-4 bg-slate-200 mx-0.5 flex-shrink-0" />;

  return (
    <div className="flex items-center flex-wrap gap-0.5 px-2 py-1.5 border-b border-slate-200 bg-slate-50 rounded-t-lg relative">

      {/* Headings */}
      {tbBtn(editor.isActive('heading', { level: 1 }), () => editor.chain().focus().toggleHeading({ level: 1 }).run(), Heading1, 'Heading 1')}
      {tbBtn(editor.isActive('heading', { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run(), Heading2, 'Heading 2')}
      {tbBtn(editor.isActive('heading', { level: 3 }), () => editor.chain().focus().toggleHeading({ level: 3 }).run(), Heading3, 'Heading 3')}
      {sep}

      {/* Inline styles */}
      {tbBtn(editor.isActive('bold'),      () => editor.chain().focus().toggleBold().run(),      Bold,          'Bold (Ctrl+B)')}
      {tbBtn(editor.isActive('italic'),    () => editor.chain().focus().toggleItalic().run(),    Italic,        'Italic (Ctrl+I)')}
      {tbBtn(editor.isActive('underline'), () => editor.chain().focus().toggleUnderline().run(), UnderlineIcon, 'Underline (Ctrl+U)')}
      {sep}

      {/* Lists */}
      {tbBtn(editor.isActive('bulletList'),  () => editor.chain().focus().toggleBulletList().run(),  List,        'Bullet list')}
      {tbBtn(editor.isActive('orderedList'), () => editor.chain().focus().toggleOrderedList().run(), ListOrdered, 'Ordered list')}
      {sep}

      {/* Color picker */}
      <div className="relative">
        <button
          type="button"
          title="Text color"
          onMouseDown={(e) => { e.preventDefault(); setColorOpen((o) => !o); setLinkOpen(false); }}
          className={`p-1.5 rounded transition-colors flex flex-col items-center gap-0 ${
            currentColor ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
          }`}
        >
          <Type className="h-3 w-3" />
          <div
            className="w-3 h-0.5 rounded-sm"
            style={{ backgroundColor: currentColor ?? '#64748b' }}
          />
        </button>
        {colorOpen && (
          <>
            {/* Click-away backdrop */}
            <div className="fixed inset-0 z-40" onMouseDown={() => setColorOpen(false)} />
            <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-xl p-3 min-w-[140px]">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Text color</p>
              <div className="grid grid-cols-5 gap-1.5">
                {TEXT_COLORS.map((c) => (
                  <button
                    key={c.label}
                    type="button"
                    title={c.label}
                    onMouseDown={(e) => { e.preventDefault(); applyColor(c.value); }}
                    className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
                      (c.value === null && !currentColor) || currentColor === c.value
                        ? 'border-slate-500 scale-110'
                        : 'border-transparent hover:border-slate-300'
                    }`}
                    style={{ backgroundColor: c.display }}
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Link */}
      <div className="relative">
        {tbBtn(editor.isActive('link'), openLink, Link2, 'Insert link')}
        {linkOpen && (
          <>
            <div className="fixed inset-0 z-40" onMouseDown={() => setLinkOpen(false)} />
            <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-xl p-3 w-72">
              <p className="text-xs font-semibold text-slate-700 mb-2">Insert link</p>
              <input
                type="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); applyLink(); }
                  if (e.key === 'Escape') setLinkOpen(false);
                }}
                placeholder="https://..."
                autoFocus
                className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
              />
              <div className="flex gap-1.5">
                <Button size="sm" onClick={applyLink}>Apply</Button>
                {editor.isActive('link') && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => { editor.chain().focus().unsetLink().run(); setLinkOpen(false); }}
                  >
                    <Link2Off className="h-3.5 w-3.5 mr-1" />
                    Remove
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => setLinkOpen(false)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

    </div>
  );
}

// ---------------------------------------------------------------------------
// ReplyEditor — lightweight TipTap editor for log replies with mentions
// ---------------------------------------------------------------------------

interface ReplyEditorProps {
  getMentionItems: () => MentionItem[];
  onSubmit: (jsonContent: string) => void;
  onCancel: () => void;
  disabled?: boolean;
}

function ReplyEditor({ getMentionItems, onSubmit, onCancel, disabled }: ReplyEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false, blockquote: false, codeBlock: false }),
      LinkExt.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: 'Write a reply… Use @ to mention people or teams.' }),
      buildMentionExtension(getMentionItems),
    ],
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[48px] px-2.5 py-2 text-xs text-slate-700',
      },
    },
  });

  function handleSubmit() {
    if (!editor || editor.isEmpty) return;
    const json = editor.getJSON();
    onSubmit(JSON.stringify(json));
    editor.commands.clearContent();
  }

  return (
    <div className="space-y-1.5">
      <div
        className="border border-slate-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-indigo-400 focus-within:border-indigo-400 bg-white"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleSubmit(); }
          if (e.key === 'Escape') onCancel();
        }}
      >
        <EditorContent editor={editor} />
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" onClick={handleSubmit} disabled={disabled || !editor || editor.isEmpty}>
          {disabled ? 'Posting…' : 'Post Reply'}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          <X className="h-3.5 w-3.5" />
        </Button>
        <span className="text-[10px] text-slate-400">Ctrl+Enter to post · @ to mention</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LogEntry — renders a single log entry (read-only) using TipTap
// ---------------------------------------------------------------------------

interface LogEntryProps {
  log: ProjectLog;
  replies: ProjectLogReply[];
  teamMembers: TeamMember[];
  getMentionItems: () => MentionItem[];
  onEdit: () => void;
  onDelete: () => void;
  onReplyAdded: (reply: ProjectLogReply) => void;
}

function AuthorAvatar({ name, className = '' }: { name: string; className?: string }) {
  const initials = name.split(' ').map((n) => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  return (
    <div className={`rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 ${className}`}>
      <span className="text-[9px] font-bold text-indigo-600 uppercase leading-none">{initials}</span>
    </div>
  );
}

function LogEntry({ log, replies, teamMembers, getMentionItems, onEdit, onDelete, onReplyAdded }: LogEntryProps) {
  const navigate = useNavigate();
  const { member: currentMember } = useCurrentMember();
  const logType = (log.log_type as LogType) || 'note';
  const cfg = LOG_TYPES[logType] || LOG_TYPES.note;
  const { Icon } = cfg;

  const [showReplyForm, setShowReplyForm] = useState(false);
  const [postingReply, setPostingReply] = useState(false);

  const htmlContent = useMemo(() => renderContent(log.comment), [log.comment]);

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement;
    const anchor = target.closest('a[data-mention-id]') as HTMLAnchorElement | null;
    if (anchor) {
      e.preventDefault();
      const href = anchor.getAttribute('href');
      if (href) navigate(href);
    }
  }

  function formatTimestamp(ts: string | null): string {
    if (!ts) return '';
    try { return format(new Date(ts), "d MMM yyyy · h:mm a"); } catch { return ts; }
  }

  function formatShortTimestamp(ts: string | null): string {
    if (!ts) return '';
    try { return format(new Date(ts), "d MMM · h:mm a"); } catch { return ts ?? ''; }
  }

  async function handlePostReply(content: string) {
    if (!content.trim() || postingReply) return;
    setPostingReply(true);

    const authorId = currentMember?.id ?? null;
    const authorName = currentMember?.name ?? null;

    const optimistic: ProjectLogReply = {
      id: crypto.randomUUID(),
      log_id: log.id,
      comment: content,
      author_id: authorId,
      author_name: authorName,
      created_at: new Date().toISOString(),
    };
    onReplyAdded(optimistic);
    setShowReplyForm(false);

    try {
      await supabase.from('project_log_replies').insert({
        log_id: log.id,
        comment: content,
        author_id: authorId,
        author_name: authorName,
      });
    } catch (err) {
      console.error('Error posting reply:', err);
    } finally {
      setPostingReply(false);
    }
  }

  return (
    <div className={`group relative rounded-lg border-l-4 ${cfg.border} ${cfg.bg} border border-slate-200/60 p-4 transition-shadow hover:shadow-sm`}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${cfg.badgeBg} ${cfg.color}`}>
          <Icon className="h-3 w-3" />
          {cfg.label}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="text-right">
            <p className="text-xs text-slate-400 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatTimestamp(log.created_at)}
            </p>
            {log.updated_at && (
              <p className="text-[10px] text-slate-400 italic">edited</p>
            )}
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => setShowReplyForm((v) => !v)}
              className="text-slate-400 hover:text-indigo-600 p-1 rounded hover:bg-white/80"
              title="Reply"
            >
              <CornerDownRight className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onEdit}
              className="text-slate-400 hover:text-blue-600 p-1 rounded hover:bg-white/80"
              title="Edit entry"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onDelete}
              className="text-slate-400 hover:text-red-500 p-1 rounded hover:bg-white/80"
              title="Delete entry"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Rich content rendered via generateHTML */}
      <div
        className="bitacora-content text-sm text-slate-700"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: htmlContent }}
        onClick={handleClick}
      />

      {/* Author footer */}
      {log.author_name && (
        <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center gap-1.5">
          <AuthorAvatar name={log.author_name} className="w-5 h-5" />
          <span className="text-xs text-slate-500">{log.author_name}</span>
        </div>
      )}

      {/* Thread replies */}
      {(replies.length > 0 || showReplyForm) && (
        <div className="mt-3 pt-3 border-t border-slate-200/60 space-y-2.5">
          {replies.length > 0 && (
            <div className="flex items-center gap-1.5 mb-1">
              <MessageSquare className="h-3 w-3 text-slate-400" />
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
              </span>
            </div>
          )}

          {replies.map((reply) => (
            <div key={reply.id} className="flex gap-2.5 pl-1">
              <div className="flex-shrink-0 mt-0.5">
                {reply.author_name
                  ? <AuthorAvatar name={reply.author_name} className="w-5 h-5" />
                  : <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center"><User className="h-2.5 w-2.5 text-slate-400" /></div>
                }
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-xs font-medium text-slate-700">{reply.author_name ?? 'Anonymous'}</span>
                  <span className="text-[10px] text-slate-400">{formatShortTimestamp(reply.created_at)}</span>
                </div>
                {isRichContent(reply.comment) ? (
                  <div className="text-xs text-slate-600 mt-0.5 prose prose-sm max-w-none [&_.mention-link]:text-purple-600 [&_.mention-link]:no-underline" dangerouslySetInnerHTML={{ __html: renderContent(reply.comment) }} />
                ) : (
                  <p className="text-xs text-slate-600 mt-0.5 whitespace-pre-wrap">{reply.comment}</p>
                )}
              </div>
            </div>
          ))}

          {showReplyForm && (
            <div className="flex gap-2.5 pl-1 pt-1">
              <div className="flex-shrink-0 mt-0.5">
                {currentMember?.name
                  ? <AuthorAvatar name={currentMember.name} className="w-5 h-5" />
                  : <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center"><User className="h-2.5 w-2.5 text-slate-400" /></div>
                }
              </div>
              <div className="flex-1">
                <ReplyEditor
                  getMentionItems={getMentionItems}
                  onSubmit={handlePostReply}
                  onCancel={() => setShowReplyForm(false)}
                  disabled={postingReply}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Reply button shown at bottom when no replies and form is hidden */}
      {replies.length === 0 && !showReplyForm && (
        <button
          onClick={() => setShowReplyForm(true)}
          className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-slate-400 hover:text-indigo-600 flex items-center gap-1"
        >
          <CornerDownRight className="h-3 w-3" />
          Reply
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Edit / Create form
// ---------------------------------------------------------------------------

interface EntryFormProps {
  getMentionItems: () => MentionItem[];  // getter so it always reads fresh data from a ref
  initialContent?: string;
  initialType?: LogType;
  initialAuthorId?: string | null;
  initialAuthorName?: string | null;
  saving: boolean;
  onSave: (content: string, logType: LogType, authorId: string | null, authorName: string | null) => void;
  onCancel?: () => void;
  isEdit?: boolean;
}

function EntryForm({ getMentionItems, initialContent, initialType = 'note', initialAuthorId, initialAuthorName, saving, onSave, onCancel, isEdit }: EntryFormProps) {
  const { member: currentMember } = useCurrentMember();
  const [logType, setLogType] = useState<LogType>(initialType);

  const startContent = initialContent && isRichContent(initialContent)
    ? JSON.parse(initialContent)
    : initialContent
      ? { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: initialContent }] }] }
      : '';

  const [isEmpty, setIsEmpty] = useState(() => !startContent);

  const editor = useEditor({
    extensions: [
      StarterKit,
      UnderlineExt,
      TextStyle,
      Color,
      LinkExt.configure({
        openOnClick: false,
        HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer', class: 'bitacora-link' },
      }),
      Placeholder.configure({ placeholder: 'Add an observation, change, decision… Use @ to mention people, teams, projects or products.' }),
      buildMentionExtension(getMentionItems),
    ],
    content: startContent,
    onCreate: ({ editor }) => setIsEmpty(editor.getText().trim() === ''),
    onUpdate: ({ editor }) => setIsEmpty(editor.getText().trim() === ''),
  });

  // For edits, preserve the original author; for new entries, use the current logged-in user
  const authorId = isEdit ? (initialAuthorId ?? null) : (currentMember?.id ?? null);
  const authorName = isEdit ? (initialAuthorName ?? null) : (currentMember?.name ?? null);

  function handleSave() {
    if (!editor) return;
    const json = editor.getJSON();
    // Check if there's actual text content
    const text = editor.getText().trim();
    if (!text) return;
    onSave(JSON.stringify(json), logType, authorId, authorName);
    if (!isEdit) {
      editor.commands.clearContent();
      setLogType('note');
      setIsEmpty(true);
    }
  }

  return (
    <div className="space-y-3">
      {/* Log type selector */}
      <div className="flex flex-wrap gap-1.5">
        {LOG_TYPE_ORDER.map((type) => {
          const cfg = LOG_TYPES[type];
          const { Icon } = cfg;
          const isActive = logType === type;
          return (
            <button
              key={type}
              type="button"
              onClick={() => setLogType(type)}
              className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border transition-colors ${
                isActive
                  ? `${cfg.badgeBg} ${cfg.color} ${cfg.border} font-semibold`
                  : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700'
              }`}
            >
              <Icon className="h-3 w-3" />
              {cfg.label}
            </button>
          );
        })}
      </div>

      {/* Editor */}
      <div className="border border-slate-300 rounded-lg focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
        <Toolbar editor={editor} />
        <div
          className="px-3 py-2 min-h-[80px] text-sm"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSave();
          }}
        >
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* Author + Actions row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {/* Current author (auto-set from session) */}
        <div className="flex items-center gap-2 min-w-0">
          {authorName ? (
            <>
              <AuthorAvatar name={authorName} className="w-5 h-5" />
              <span className="text-xs text-slate-600">{authorName}</span>
            </>
          ) : (
            <>
              <User className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
              <span className="text-xs text-slate-400 italic">No user session</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <p className="text-xs text-slate-400 hidden sm:block">Ctrl+Enter to save · @ to mention</p>
          {onCancel && (
            <Button size="sm" variant="ghost" onClick={onCancel}>
              <X className="h-3.5 w-3.5 mr-1" />
              Cancel
            </Button>
          )}
          <Button size="sm" onClick={handleSave} disabled={isEmpty || saving}>
            {saving ? 'Saving...' : isEdit ? (
              <><Check className="h-3.5 w-3.5 mr-1" />Save</>
            ) : (
              'Add Entry'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface Props {
  projectId: string;
}

export function BitacoraSection({ projectId }: Props) {
  const [logs, setLogs] = useState<ProjectLog[]>([]);
  const [repliesByLog, setRepliesByLog] = useState<Record<string, ProjectLogReply[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<LogType | 'all'>('all');
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  // Mention data is stored only in a ref so the editor's getter closure always reads fresh items
  const mentionItemsRef = useRef<MentionItem[]>([]);
  const getMentionItems = useRef(() => mentionItemsRef.current).current;

  // Load mention candidates + team members once
  useEffect(() => {
    async function loadMentions() {
      const [{ data: projects }, { data: quotations }, { data: cabinets }, { data: priceItems }, { data: members }, { data: depts }] = await Promise.all([
        supabase.from('projects').select('id, name, customer').order('name'),
        supabase.from('quotations').select('id, name, project_id, version_number, version_label').order('name'),
        supabase.from('products_catalog').select('id, sku, description').order('description'),
        supabase.from('price_list').select('id, concept_description').eq('is_active', true).order('concept_description'),
        supabase.from('team_members').select('*').eq('is_active', true).order('display_order'),
        supabase.from('departments').select('id, name, slug').order('display_order'),
      ]);

      setTeamMembers(members || []);

      const items: MentionItem[] = [
        ...(projects || []).map((p) => ({
          id: `project:${p.id}`,
          label: p.name,
          type: 'project' as const,
          subtitle: p.customer || undefined,
        })),
        ...(quotations || []).map((q) => ({
          id: `quotation:${q.project_id}:${q.id}`,
          label: q.name,
          type: 'quotation' as const,
          subtitle: q.version_label || (q.version_number ? `v${q.version_number}` : undefined),
        })),
        ...(cabinets || []).map((c) => ({
          id: `cabinet:${c.id}`,
          label: c.description,
          type: 'cabinet' as const,
          subtitle: c.sku,
        })),
        ...(priceItems || []).map((i) => ({
          id: `price_item:${i.id}`,
          label: i.concept_description,
          type: 'price_item' as const,
        })),
        ...(depts || []).map((d) => ({
          id: `department:${d.id}`,
          label: d.name,
          type: 'department' as const,
        })),
        ...(members || []).map((m) => ({
          id: `team_member:${m.id}`,
          label: m.name,
          type: 'team_member' as const,
          subtitle: m.job_title || m.role || undefined,
        })),
      ];

      mentionItemsRef.current = items;
    }

    loadMentions().catch(console.error);
  }, []);

  useEffect(() => {
    loadLogs();
  }, [projectId]);

  async function loadLogs() {
    try {
      const { data, error } = await supabase
        .from('project_logs')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const logsData = data || [];
      setLogs(logsData);

      // Load all replies for these logs in one query
      if (logsData.length > 0) {
        const { data: replyData } = await supabase
          .from('project_log_replies')
          .select('*')
          .in('log_id', logsData.map((l) => l.id))
          .order('created_at', { ascending: true });

        const grouped: Record<string, ProjectLogReply[]> = {};
        for (const reply of replyData || []) {
          if (!grouped[reply.log_id]) grouped[reply.log_id] = [];
          grouped[reply.log_id].push(reply);
        }
        setRepliesByLog(grouped);
      }
    } catch (err) {
      console.error('Error loading logs:', err);
    } finally {
      setLoading(false);
    }
  }

  async function addLog(content: string, logType: LogType, authorId: string | null, authorName: string | null) {
    if (saving) return;
    setSaving(true);

    const optimistic: ProjectLog = {
      id: crypto.randomUUID(),
      project_id: projectId,
      comment: content,
      log_type: logType,
      author_id: authorId,
      author_name: authorName,
      created_at: new Date().toISOString(),
      updated_at: null,
    };

    setLogs((prev) => [optimistic, ...prev]);

    try {
      const { error } = await supabase.from('project_logs').insert({
        project_id: projectId,
        comment: content,
        log_type: logType,
        author_id: authorId,
        author_name: authorName,
      });
      if (error) throw error;
      loadLogs();
    } catch (err) {
      console.error('Error adding log:', err);
      setLogs((prev) => prev.filter((l) => l.id !== optimistic.id));
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(logId: string, content: string, logType: LogType, authorId: string | null, authorName: string | null) {
    const prev = [...logs];
    setLogs((l) =>
      l.map((x) => x.id === logId ? { ...x, comment: content, log_type: logType, author_id: authorId, author_name: authorName, updated_at: new Date().toISOString() } : x)
    );
    setEditingId(null);

    try {
      const { error } = await supabase
        .from('project_logs')
        .update({ comment: content, log_type: logType, author_id: authorId, author_name: authorName, updated_at: new Date().toISOString() })
        .eq('id', logId);
      if (error) throw error;
    } catch (err) {
      console.error('Error updating log:', err);
      setLogs(prev);
    }
  }

  async function deleteLog(id: string) {
    const prev = [...logs];
    setLogs((l) => l.filter((x) => x.id !== id));
    try {
      const { error } = await supabase.from('project_logs').delete().eq('id', id);
      if (error) throw error;
    } catch (err) {
      console.error('Error deleting log:', err);
      setLogs(prev);
    }
  }

  function handleReplyAdded(logId: string, reply: ProjectLogReply) {
    setRepliesByLog((prev) => ({
      ...prev,
      [logId]: [...(prev[logId] ?? []), reply],
    }));
  }

  const filteredLogs = filterType === 'all' ? logs : logs.filter((l) => (l.log_type || 'note') === filterType);

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-3">
        <div className="animate-pulse h-6 bg-slate-100 rounded w-40" />
        <div className="animate-pulse h-24 bg-slate-100 rounded" />
        <div className="animate-pulse h-20 bg-slate-100 rounded" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <ScrollText className="h-5 w-5 text-amber-600" />
        <h3 className="text-lg font-semibold text-slate-900">Project Log</h3>
        {logs.length > 0 && (
          <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
            {logs.length} {logs.length === 1 ? 'entry' : 'entries'}
          </span>
        )}
      </div>

      {/* New entry form */}
      <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50">
        <EntryForm
          getMentionItems={getMentionItems}
          saving={saving}
          onSave={addLog}
        />
      </div>

      {/* Filter bar */}
      {logs.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
          <button
            onClick={() => setFilterType('all')}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
              filterType === 'all'
                ? 'bg-slate-800 text-white border-slate-800'
                : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
            }`}
          >
            All ({logs.length})
          </button>
          {LOG_TYPE_ORDER.map((type) => {
            const count = logs.filter((l) => (l.log_type || 'note') === type).length;
            if (count === 0) return null;
            const cfg = LOG_TYPES[type];
            return (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  filterType === type
                    ? `${cfg.badgeBg} ${cfg.color} ${cfg.border} font-semibold`
                    : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                }`}
              >
                {cfg.label} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Log entries */}
      {filteredLogs.length === 0 ? (
        <div className="py-10 text-center text-slate-400">
          <ScrollText className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">{filterType === 'all' ? 'No entries yet' : 'No entries of this type'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredLogs.map((log) =>
            editingId === log.id ? (
              <div key={log.id} className="border border-blue-200 rounded-lg p-4 bg-blue-50/30">
                <p className="text-xs text-slate-400 mb-3">Editing entry</p>
                <EntryForm
                  getMentionItems={getMentionItems}
                  initialContent={log.comment}
                  initialType={(log.log_type as LogType) || 'note'}
                  initialAuthorId={log.author_id ?? null}
                  initialAuthorName={log.author_name ?? null}
                  saving={saving}
                  onSave={(content, type, aId, aName) => saveEdit(log.id, content, type, aId, aName)}
                  onCancel={() => setEditingId(null)}
                  isEdit
                />
              </div>
            ) : (
              <LogEntry
                key={log.id}
                log={log}
                replies={repliesByLog[log.id] ?? []}
                teamMembers={teamMembers}
                getMentionItems={getMentionItems}
                onEdit={() => setEditingId(log.id)}
                onDelete={() => deleteLog(log.id)}
                onReplyAdded={(reply) => handleReplyAdded(log.id, reply)}
              />
            )
          )}
        </div>
      )}
    </div>
  );
}
