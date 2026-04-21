import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { createNotifications } from '../lib/notifications';
import {
  X, ExternalLink, Clock, Send,
  FileText, RefreshCw, CheckCircle, AlertTriangle, XCircle, Trophy, Radio,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { Button } from './Button';

// ── Log type config (mirrors BitacoraSection) ─────────────────────────────────

type LogType = 'note' | 'change' | 'decision' | 'risk' | 'issue' | 'milestone' | 'update';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const LOG_TYPES: Record<LogType, { label: string; Icon: any; color: string; bg: string; border: string; badgeBg: string }> = {
  note:      { label: 'Note',      Icon: FileText,       color: 'text-fg-600',  bg: 'bg-surf-app',    border: 'border-l-slate-300',   badgeBg: 'bg-surf-muted'  },
  change:    { label: 'Change',    Icon: RefreshCw,      color: 'text-status-amber-fg',  bg: 'bg-status-amber-bg',    border: 'border-l-amber-400',   badgeBg: 'bg-status-amber-bg'  },
  decision:  { label: 'Decision',  Icon: CheckCircle,    color: 'text-accent-text',   bg: 'bg-accent-tint-soft',     border: 'border-l-blue-400',    badgeBg: 'bg-accent-tint-soft'   },
  risk:      { label: 'Risk',      Icon: AlertTriangle,  color: 'text-status-orange-fg', bg: 'bg-status-orange-bg',   border: 'border-l-orange-400',  badgeBg: 'bg-status-orange-bg' },
  issue:     { label: 'Issue',     Icon: XCircle,        color: 'text-status-red-fg',    bg: 'bg-status-red-bg',      border: 'border-l-red-400',     badgeBg: 'bg-status-red-bg'    },
  milestone: { label: 'Milestone', Icon: Trophy,         color: 'text-status-emerald-fg',  bg: 'bg-status-emerald-bg',    border: 'border-l-green-400',   badgeBg: 'bg-status-emerald-bg'  },
  update:    { label: 'Update',    Icon: Radio,          color: 'text-accent-text', bg: 'bg-accent-tint-soft',   border: 'border-l-purple-400',  badgeBg: 'bg-accent-tint-soft' },
};

// ── TipTap JSON helpers ───────────────────────────────────────────────────────

function getLogText(comment: string): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const doc = JSON.parse(comment) as any;
    if (!doc || doc.type !== 'doc') return comment;
    const texts: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function walk(node: any) {
      if (node.type === 'text' && node.text) texts.push(node.text);
      if (node.content) node.content.forEach(walk);
    }
    walk(doc);
    return texts.join(' ').trim();
  } catch {
    return comment;
  }
}

function plainToTipTapJSON(text: string): string {
  const paragraphs = text.split('\n').map(line => ({
    type: 'paragraph' as const,
    ...(line.trim()
      ? { content: [{ type: 'text' as const, text: line }] }
      : {}),
  }));
  return JSON.stringify({ type: 'doc', content: paragraphs });
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface LogEntry {
  id: string;
  project_id: string;
  project_name: string;
  log_type: string;
  comment: string;
  author_id: string | null;
  author_name: string | null;
  created_at: string;
}

interface Reply {
  id: string;
  log_id: string;
  comment: string;
  author_id: string | null;
  author_name: string | null;
  created_at: string | null;
}

interface Props {
  log: LogEntry;
  currentMemberId: string | null;
  currentMemberName: string | null;
  onClose: () => void;
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
}

const AVATAR_COLORS = [
  'bg-accent-tint-soft text-accent-text', 'bg-accent-tint-soft text-accent-text',
  'bg-status-amber-bg text-status-amber-fg',   'bg-status-emerald-bg text-status-emerald-fg',
  'bg-status-red-bg text-status-red-fg',     'bg-cyan-100 text-cyan-700',
];

function avatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function HomeLogDetailModal({ log, currentMemberId, currentMemberName, onClose }: Props) {
  const [replies, setReplies] = useState<Reply[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

  const cfg = LOG_TYPES[(log.log_type as LogType)] ?? LOG_TYPES.note;
  const { Icon } = cfg;
  const fullText = getLogText(log.comment);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Load replies on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingReplies(true);
      const { data } = await supabase
        .from('project_log_replies')
        .select('*')
        .eq('log_id', log.id)
        .order('created_at', { ascending: true });
      if (!cancelled) {
        setReplies((data ?? []) as Reply[]);
        setLoadingReplies(false);
      }
    })();
    return () => { cancelled = true; };
  }, [log.id]);

  async function sendReply() {
    const text = replyText.trim();
    if (!text || sending) return;
    setSending(true);

    const tiptapContent = plainToTipTapJSON(text);

    const { data, error } = await supabase
      .from('project_log_replies')
      .insert({
        log_id: log.id,
        comment: tiptapContent,
        author_id: currentMemberId,
        author_name: currentMemberName,
      })
      .select()
      .single();

    setSending(false);
    if (error || !data) return;
    setReplies(prev => [...prev, data as Reply]);
    setReplyText('');

    // Notify the original log author that someone replied (skip if replying to own log)
    if (log.author_id && log.author_id !== currentMemberId) {
      const preview = text.length > 120 ? text.slice(0, 117) + '…' : text;
      createNotifications({
        recipientIds: [log.author_id],
        actorId: currentMemberId,
        actorName: currentMemberName,
        type: 'log_reply',
        title: `Replied to your ${(LOG_TYPES[(log.log_type as LogType)] ?? LOG_TYPES.note).label.toLowerCase()} entry`,
        body: preview,
        projectId: log.project_id,
        referenceType: 'project_log',
        referenceId: log.id,
      }).catch(console.error);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div className="bg-surf-card backdrop-blur-xl rounded-2xl shadow-2xl border border-white/70 w-full max-w-lg max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-rail bg-accent-tint-card flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="text-base font-semibold text-fg-900 truncate">Log Entry</h3>
            <Link
              to={`/projects/${log.project_id}`}
              onClick={onClose}
              className="inline-flex items-center gap-1 text-[11px] text-accent-text hover:text-accent-text font-medium flex-shrink-0"
            >
              {log.project_name} <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
          <button onClick={onClose} className="text-fg-400 hover:text-fg-600 transition-colors flex-shrink-0">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          {/* Log entry */}
          <div className={`mx-4 mt-4 mb-3 p-4 rounded-xl border-l-4 ${cfg.bg} ${cfg.border}`}>
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md ${cfg.badgeBg} ${cfg.color}`}>
                <Icon className="h-3 w-3" />
                {cfg.label}
              </span>
              {log.author_name && (
                <span className="text-[11px] text-fg-600 font-medium">{log.author_name}</span>
              )}
              <span className="text-[11px] text-fg-400 flex items-center gap-0.5 ml-auto">
                <Clock className="h-2.5 w-2.5" />
                {format(new Date(log.created_at), 'MMM d, yyyy HH:mm')}
              </span>
            </div>
            <p className="text-sm text-fg-700 leading-relaxed whitespace-pre-wrap">{fullText}</p>
          </div>

          {/* Replies */}
          <div className="px-4 pb-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-semibold text-fg-500 uppercase tracking-wide">
                Replies
              </span>
              {!loadingReplies && (
                <span className="text-[10px] font-semibold bg-surf-muted text-fg-400 px-1.5 py-0.5 rounded-full">
                  {replies.length}
                </span>
              )}
            </div>

            {loadingReplies ? (
              <div className="space-y-3">
                <div className="h-12 rounded-lg bg-surf-muted animate-pulse" />
                <div className="h-12 rounded-lg bg-surf-muted animate-pulse" />
              </div>
            ) : replies.length === 0 ? (
              <p className="text-xs text-fg-400 text-center py-4">No replies yet — be the first</p>
            ) : (
              <div className="space-y-3">
                {replies.map(reply => {
                  const replyText = getLogText(reply.comment);
                  const authorName = reply.author_name ?? 'Unknown';
                  return (
                    <div key={reply.id} className="flex gap-2.5">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5 ${avatarColor(authorName)}`}>
                        {getInitials(authorName)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-semibold text-fg-700">{authorName}</span>
                          <span className="text-[10px] text-fg-400 flex items-center gap-0.5">
                            <Clock className="h-2.5 w-2.5" />
                            {reply.created_at ? format(new Date(reply.created_at), 'MMM d, HH:mm') : ''}
                          </span>
                        </div>
                        <p className="text-xs text-fg-600 leading-relaxed whitespace-pre-wrap">{replyText}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Reply input — sticky at bottom */}
        <div className="flex-shrink-0 px-4 py-3 border-t border-border-rail bg-surf-card backdrop-blur-sm">
          <div className="flex gap-2">
            <textarea
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              placeholder="Write a reply…"
              rows={2}
              className="flex-1 text-xs border border-border-soft rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500 bg-surf-card"
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) sendReply(); }}
            />
            <Button
              size="sm"
              onClick={sendReply}
              disabled={!replyText.trim() || sending}
              className="self-end flex-shrink-0"
            >
              {sending ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
          <p className="text-[10px] text-fg-400 mt-1">Cmd+Enter to send</p>
        </div>
      </div>
    </div>,
    document.body
  );
}
