import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';
import { useCurrentMember } from './useCurrentMember';
import type { AppNotification } from '../types';

interface UseNotificationsResult {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useNotifications(): UseNotificationsResult {
  const { member } = useCurrentMember();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const memberId = member?.id;

  const refresh = useCallback(async () => {
    if (!memberId) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('recipient_id', memberId)
      .order('created_at', { ascending: false })
      .limit(50);
    setNotifications(data || []);
    setLoading(false);
  }, [memberId]);

  // Initial load
  useEffect(() => {
    if (!memberId) {
      setLoading(false);
      return;
    }
    refresh();
  }, [memberId, refresh]);

  // Realtime subscription for new notifications
  useEffect(() => {
    if (!memberId) return;

    const channel = supabase
      .channel(`notifications:${memberId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${memberId}`,
        },
        (payload) => {
          const newNotif = payload.new as AppNotification;
          setNotifications((prev) => [newNotif, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [memberId]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  async function markAsRead(id: string) {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
  }

  async function markAllAsRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    if (memberId) {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('recipient_id', memberId)
        .eq('is_read', false);
    }
  }

  return { notifications, unreadCount, loading, markAsRead, markAllAsRead, refresh };
}
