import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Bell, ClipboardList, ScrollText, MessageSquare, CheckCheck, FolderOpen } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useNotifications } from '../lib/useNotifications';
import type { AppNotification } from '../types';

type TabFilter = 'all' | 'tasks' | 'logs';

const TASK_TYPES = ['task_assigned'];
const LOG_TYPES = ['mention_log', 'mention_log_reply', 'mention_task_comment', 'mention_task_comment_reply'];

function getIcon(type: string) {
  if (TASK_TYPES.includes(type)) return ClipboardList;
  if (type.includes('task_comment')) return MessageSquare;
  return ScrollText;
}

function getIconStyle(type: string) {
  // Status tokens give us themed fills; blue/violet notification types
  // map onto the existing accent/status palette.
  if (TASK_TYPES.includes(type)) {
    return {
      bg: 'bg-accent-tint-strong',
      text: 'text-accent-text',
      ring: 'ring-[color:var(--accent-tint-border)]',
    };
  }
  if (type.includes('task_comment')) {
    return {
      bg: 'bg-status-amber-bg',
      text: 'text-status-amber-fg',
      ring: 'ring-[color:var(--status-amber-brd)]',
    };
  }
  return {
    bg: 'bg-accent-tint-soft',
    text: 'text-accent-text',
    ring: 'ring-[color:var(--accent-tint-border)]',
  };
}

function getActionLabel(type: string): string {
  switch (type) {
    case 'task_assigned': return 'assigned you a task';
    case 'mention_log': return 'mentioned you in a log entry';
    case 'mention_log_reply': return 'mentioned you in a log reply';
    case 'mention_task_comment': return 'mentioned you in a task comment';
    case 'mention_task_comment_reply': return 'mentioned you in a task reply';
    default: return 'sent you a notification';
  }
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function NotificationPanel({ open, onClose }: Props) {
  const navigate = useNavigate();
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead } = useNotifications();
  const [tab, setTab] = useState<TabFilter>('all');

  if (!open) return null;

  const filtered = notifications.filter((n) => {
    if (tab === 'tasks') return TASK_TYPES.includes(n.type);
    if (tab === 'logs') return LOG_TYPES.includes(n.type);
    return true;
  });

  function handleClick(n: AppNotification) {
    markAsRead(n.id);
    if (n.project_id) navigate(`/projects/${n.project_id}`);
    onClose();
  }

  function formatTime(ts: string | null) {
    if (!ts) return '';
    try { return formatDistanceToNow(new Date(ts), { addSuffix: true }); } catch { return ''; }
  }

  const tabs: { key: TabFilter; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: notifications.length },
    { key: 'tasks', label: 'Tasks', count: notifications.filter((n) => TASK_TYPES.includes(n.type)).length },
    { key: 'logs', label: 'Logs', count: notifications.filter((n) => LOG_TYPES.includes(n.type)).length },
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60] bg-modal-backdrop"
        style={{ backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed right-0 top-0 z-[61] h-full w-full sm:w-[400px] flex flex-col animate-slide-in-right overflow-hidden bg-surf-card border-l border-border-soft"
        style={{
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 bg-accent-tint-card border-b border-accent-tint-border"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-accent-tint-strong flex items-center justify-center">
              <Bell className="h-4 w-4 text-accent-text" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-fg-900">Notifications</h2>
              {unreadCount > 0 && (
                <p className="text-[10px] text-accent-text font-medium">{unreadCount} unread</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-[11px] text-accent-text hover:text-fg-900 font-medium flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-accent-tint-soft transition-colors"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Read all
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-fg-400 hover:text-fg-700 hover:bg-surf-hover transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-5 py-2.5 border-b border-border-hair">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`text-[11px] font-semibold px-3 py-1.5 rounded-full transition-all duration-200 ${
                tab === t.key
                  ? 'bg-accent-primary text-accent-on shadow-btn'
                  : 'text-fg-500 hover:bg-surf-btn-hover hover:text-fg-700'
              }`}
            >
              {t.label}
              {t.count > 0 && (
                <span className={`ml-1.5 ${tab === t.key ? 'opacity-75' : 'text-fg-400'}`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-3 py-2">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-6 h-6 border-2 border-accent-tint-strong border-t-accent-a rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-fg-400">
              <div className="w-14 h-14 rounded-2xl bg-surf-muted flex items-center justify-center mb-3">
                <Bell className="h-6 w-6 opacity-40" />
              </div>
              <p className="text-sm font-medium text-fg-500">All caught up</p>
              <p className="text-xs text-fg-400 mt-0.5">No notifications yet</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {filtered.map((n) => {
                const Icon = getIcon(n.type);
                const style = getIconStyle(n.type);
                const isUnread = !n.is_read;
                return (
                  <button
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={`w-full text-left px-3.5 py-3 flex gap-3 rounded-xl transition-all duration-200 group ${
                      isUnread
                        ? 'bg-surf-card shadow-card border border-accent-tint-border hover:shadow-card'
                        : 'hover:bg-surf-hover border border-transparent'
                    }`}
                  >
                    <div className={`flex-shrink-0 w-9 h-9 rounded-xl ${style.bg} ring-1 ${style.ring} flex items-center justify-center`}>
                      <Icon className={`h-4 w-4 ${style.text}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      {/* Actor + action */}
                      <div className="flex items-start gap-2">
                        <p className={`text-[13px] leading-snug ${isUnread ? 'font-semibold text-fg-900' : 'font-medium text-fg-600'}`}>
                          {n.actor_name ? (
                            <><span className="text-accent-text">{n.actor_name}</span>{' '}{getActionLabel(n.type)}</>
                          ) : (
                            getActionLabel(n.type)
                          )}
                        </p>
                        {isUnread && (
                          <span className="flex-shrink-0 w-2 h-2 rounded-full bg-accent-a mt-1.5 ring-2 ring-[color:var(--accent-tint-strong)]" />
                        )}
                      </div>

                      {/* Title (task name, log title, etc.) */}
                      {n.title && (
                        <p className={`text-xs mt-0.5 leading-snug font-medium truncate ${isUnread ? 'text-fg-800' : 'text-fg-500'}`}>
                          {n.title}
                        </p>
                      )}

                      {/* Body detail (status/priority for tasks, content preview for logs) */}
                      {n.body && (
                        <p className="text-[11px] text-fg-500 mt-0.5 line-clamp-2 leading-relaxed">{n.body}</p>
                      )}

                      {/* Footer: project name + time */}
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        {n.project_name && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-accent-text bg-accent-tint-soft px-1.5 py-0.5 rounded-md border border-accent-tint-border">
                            <FolderOpen className="h-2.5 w-2.5" />
                            {n.project_name}
                          </span>
                        )}
                        <span className="text-[10px] text-fg-400 font-medium">{formatTime(n.created_at)}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
