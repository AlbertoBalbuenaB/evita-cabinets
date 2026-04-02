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
  if (TASK_TYPES.includes(type)) return { bg: 'bg-blue-100/70', text: 'text-blue-600', ring: 'ring-blue-200/50' };
  if (type.includes('task_comment')) return { bg: 'bg-amber-100/70', text: 'text-amber-600', ring: 'ring-amber-200/50' };
  return { bg: 'bg-violet-100/70', text: 'text-violet-600', ring: 'ring-violet-200/50' };
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
        className="fixed inset-0 z-[60]"
        style={{ background: 'rgba(15, 23, 42, 0.18)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed right-0 top-0 z-[61] h-full w-full sm:w-[400px] flex flex-col animate-slide-in-right overflow-hidden"
        style={{
          background: 'rgba(255, 255, 255, 0.78)',
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          borderLeft: '1px solid rgba(255, 255, 255, 0.6)',
          boxShadow: '-8px 0 40px rgba(99, 102, 241, 0.08), -2px 0 12px rgba(0, 0, 0, 0.04)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{
            background: 'linear-gradient(135deg, rgba(224, 231, 255, 0.4), rgba(219, 234, 254, 0.25))',
            borderBottom: '1px solid rgba(165, 180, 252, 0.2)',
          }}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-100/70 flex items-center justify-center">
              <Bell className="h-4 w-4 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Notifications</h2>
              {unreadCount > 0 && (
                <p className="text-[10px] text-indigo-600 font-medium">{unreadCount} unread</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-[11px] text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-indigo-50/60 transition-colors"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Read all
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-white/60 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-5 py-2.5" style={{ borderBottom: '1px solid rgba(0, 0, 0, 0.05)' }}>
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`text-[11px] font-semibold px-3 py-1.5 rounded-full transition-all duration-200 ${
                tab === t.key
                  ? 'bg-gradient-to-r from-indigo-500 to-blue-500 text-white shadow-sm shadow-indigo-200/50'
                  : 'text-slate-500 hover:bg-white/70 hover:text-slate-700'
              }`}
            >
              {t.label}
              {t.count > 0 && (
                <span className={`ml-1.5 ${tab === t.key ? 'text-white/70' : 'text-slate-400'}`}>
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
              <div className="w-6 h-6 border-2 border-indigo-100 border-t-indigo-500 rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <div className="w-14 h-14 rounded-2xl bg-slate-100/60 flex items-center justify-center mb-3">
                <Bell className="h-6 w-6 opacity-40" />
              </div>
              <p className="text-sm font-medium text-slate-500">All caught up</p>
              <p className="text-xs text-slate-400 mt-0.5">No notifications yet</p>
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
                        ? 'bg-white/70 shadow-sm shadow-indigo-100/30 border border-indigo-100/40 hover:shadow-md hover:shadow-indigo-100/40'
                        : 'hover:bg-white/50 border border-transparent'
                    }`}
                  >
                    <div className={`flex-shrink-0 w-9 h-9 rounded-xl ${style.bg} ring-1 ${style.ring} flex items-center justify-center`}>
                      <Icon className={`h-4 w-4 ${style.text}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      {/* Actor + action */}
                      <div className="flex items-start gap-2">
                        <p className={`text-[13px] leading-snug ${isUnread ? 'font-semibold text-slate-900' : 'font-medium text-slate-600'}`}>
                          {n.actor_name ? (
                            <><span className="text-indigo-600">{n.actor_name}</span>{' '}{getActionLabel(n.type)}</>
                          ) : (
                            getActionLabel(n.type)
                          )}
                        </p>
                        {isUnread && (
                          <span className="flex-shrink-0 w-2 h-2 rounded-full bg-indigo-500 mt-1.5 ring-2 ring-indigo-200/50" />
                        )}
                      </div>

                      {/* Title (task name, log title, etc.) */}
                      {n.title && (
                        <p className={`text-xs mt-0.5 leading-snug font-medium truncate ${isUnread ? 'text-slate-800' : 'text-slate-500'}`}>
                          {n.title}
                        </p>
                      )}

                      {/* Body detail (status/priority for tasks, content preview for logs) */}
                      {n.body && (
                        <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">{n.body}</p>
                      )}

                      {/* Footer: project name + time */}
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        {n.project_name && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-indigo-600/80 bg-indigo-50/70 px-1.5 py-0.5 rounded-md border border-indigo-100/50">
                            <FolderOpen className="h-2.5 w-2.5" />
                            {n.project_name}
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400/80 font-medium">{formatTime(n.created_at)}</span>
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
