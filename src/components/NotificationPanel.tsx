import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Bell, ClipboardList, ScrollText, MessageSquare, CheckCheck } from 'lucide-react';
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

function getIconColor(type: string) {
  if (TASK_TYPES.includes(type)) return 'text-blue-600 bg-blue-100';
  if (type.includes('task_comment')) return 'text-amber-600 bg-amber-100';
  return 'text-violet-600 bg-violet-100';
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
    if (n.project_id) {
      navigate(`/projects/${n.project_id}`);
    }
    onClose();
  }

  function formatTime(ts: string | null) {
    if (!ts) return '';
    try { return formatDistanceToNow(new Date(ts), { addSuffix: true }); } catch { return ''; }
  }

  const tabs: { key: TabFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'tasks', label: 'Tasks' },
    { key: 'logs', label: 'Logs' },
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60] bg-black/20 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 z-[61] h-full w-full sm:w-96 bg-white shadow-2xl flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-900">Notifications</h2>
            {unreadCount > 0 && (
              <span className="text-[10px] font-bold bg-red-500 text-white rounded-full px-1.5 py-0.5 leading-none">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 py-2 border-b border-slate-100">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
                tab === t.key
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-5 h-5 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Bell className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-sm">No notifications</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filtered.map((n) => {
                const Icon = getIcon(n.type);
                const iconColor = getIconColor(n.type);
                return (
                  <button
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={`w-full text-left px-4 py-3 flex gap-3 transition-colors hover:bg-slate-50 ${
                      !n.is_read ? 'bg-blue-50/40' : ''
                    }`}
                  >
                    <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${iconColor}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2">
                        <p className={`text-sm leading-snug ${!n.is_read ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>
                          {n.title}
                        </p>
                        {!n.is_read && (
                          <span className="flex-shrink-0 w-2 h-2 rounded-full bg-blue-500 mt-1.5" />
                        )}
                      </div>
                      {n.actor_name && (
                        <p className="text-xs text-slate-500 mt-0.5">by {n.actor_name}</p>
                      )}
                      {n.body && (
                        <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{n.body}</p>
                      )}
                      <p className="text-[10px] text-slate-400 mt-1">{formatTime(n.created_at)}</p>
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
