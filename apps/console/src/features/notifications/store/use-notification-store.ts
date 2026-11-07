import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { NotificationItem } from '../types';

interface NotificationState {
  notifications: NotificationItem[];
  unreadCount: number;
  isConnected: boolean;
  addNotification: (
    item: Omit<NotificationItem, 'id' | 'timestamp' | 'read'> & {
      id?: string;
      timestamp?: number;
      read?: boolean;
    }
  ) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
  setConnected: (connected: boolean) => void;
}

const MAX_NOTIFICATIONS = 100;

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      notifications: [],
      unreadCount: 0,
      isConnected: false,

      addNotification: (item) => {
        const id = item.id || `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const timestamp = item.timestamp || Date.now();
        const read = item.read ?? false;

        const newNotification: NotificationItem = {
          ...item,
          id,
          timestamp,
          read,
        };

        const existing = get().notifications.filter((n) => n.id !== id);
        const updated = [newNotification, ...existing].slice(0, MAX_NOTIFICATIONS);
        const unreadCount = updated.filter((n) => !n.read).length;

        set({
          notifications: updated,
          unreadCount,
        });
      },

      markAsRead: (id: string) => {
        const updated = get().notifications.map((n) =>
          n.id === id ? { ...n, read: true } : n
        );
        const unreadCount = updated.filter((n) => !n.read).length;
        set({
          notifications: updated,
          unreadCount,
        });
      },

      markAllAsRead: () => {
        const updated = get().notifications.map((n) => ({ ...n, read: true }));
        set({
          notifications: updated,
          unreadCount: 0,
        });
      },

      removeNotification: (id: string) => {
        const updated = get().notifications.filter((n) => n.id !== id);
        const unreadCount = updated.filter((n) => !n.read).length;
        set({
          notifications: updated,
          unreadCount,
        });
      },

      clearAll: () => {
        set({
          notifications: [],
          unreadCount: 0,
        });
      },

      setConnected: (connected: boolean) => {
        set({ isConnected: connected });
      },
    }),
    {
      name: 'acc_notifications_store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        notifications: state.notifications,
        unreadCount: state.unreadCount,
      }),
    }
  )
);
