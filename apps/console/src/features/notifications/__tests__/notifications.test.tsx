import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useNotificationStore } from '../store/use-notification-store';
import { NotificationDropdown } from '../components/notification-dropdown';
import type { ConsoleNotification } from '../types';

describe('useNotificationStore', () => {
  beforeEach(() => {
    useNotificationStore.getState().clearAll();
  });

  it('initializes with empty notifications and 0 unreadCount', () => {
    const state = useNotificationStore.getState();
    expect(state.notifications).toEqual([]);
    expect(state.unreadCount).toBe(0);
  });

  it('adds notifications and computes unread count correctly', () => {
    const notif: ConsoleNotification = {
      id: 'notif-1',
      title: 'Workflow Execution Succeeded',
      message: 'Run #42 completed successfully',
      category: 'workflows',
      severity: 'info',
      read: false,
      timestamp: Date.now(),
      actionUrl: '/workflows/runs/42',
    };

    useNotificationStore.getState().addNotification(notif);

    const state = useNotificationStore.getState();
    expect(state.notifications.length).toBe(1);
    expect(state.notifications[0].title).toBe('Workflow Execution Succeeded');
    expect(state.unreadCount).toBe(1);
  });

  it('marks a single notification as read', () => {
    const notif1: ConsoleNotification = {
      id: 'notif-1',
      title: 'Task Waiting',
      message: 'Needs human review',
      category: 'approvals',
      severity: 'warning',
      read: false,
      timestamp: Date.now(),
    };
    const notif2: ConsoleNotification = {
      id: 'notif-2',
      title: 'DLQ Alert',
      message: 'Dead letter task isolated',
      category: 'system',
      severity: 'error',
      read: false,
      timestamp: Date.now(),
    };

    useNotificationStore.getState().addNotification(notif1);
    useNotificationStore.getState().addNotification(notif2);
    expect(useNotificationStore.getState().unreadCount).toBe(2);

    useNotificationStore.getState().markAsRead('notif-1');

    const state = useNotificationStore.getState();
    expect(state.unreadCount).toBe(1);
    expect(state.notifications.find((n) => n.id === 'notif-1')?.read).toBe(true);
    expect(state.notifications.find((n) => n.id === 'notif-2')?.read).toBe(false);
  });

  it('marks all notifications as read', () => {
    useNotificationStore.getState().addNotification({
      id: '1',
      title: 'A',
      message: 'A',
      category: 'system',
      severity: 'info',
      read: false,
      timestamp: Date.now(),
    });
    useNotificationStore.getState().addNotification({
      id: '2',
      title: 'B',
      message: 'B',
      category: 'system',
      severity: 'info',
      read: false,
      timestamp: Date.now(),
    });

    expect(useNotificationStore.getState().unreadCount).toBe(2);
    useNotificationStore.getState().markAllAsRead();

    const state = useNotificationStore.getState();
    expect(state.unreadCount).toBe(0);
    expect(state.notifications.every((n) => n.read)).toBe(true);
  });

  it('clears all notifications', () => {
    useNotificationStore.getState().addNotification({
      id: '1',
      title: 'A',
      message: 'A',
      category: 'system',
      severity: 'info',
      read: false,
      timestamp: Date.now(),
    });
    useNotificationStore.getState().clearAll();

    expect(useNotificationStore.getState().notifications).toEqual([]);
    expect(useNotificationStore.getState().unreadCount).toBe(0);
  });
});

describe('NotificationDropdown Component', () => {
  beforeEach(() => {
    useNotificationStore.getState().clearAll();
  });

  it('renders notification trigger button', () => {
    render(<NotificationDropdown />);
    const triggerBtn = screen.getByRole('button', { name: /notifications/i });
    expect(triggerBtn).toBeDefined();
  });

  it('displays badge count when there are unread notifications', () => {
    useNotificationStore.getState().addNotification({
      id: 'notif-x',
      title: 'Approval Required',
      message: 'HITL action required',
      category: 'approvals',
      severity: 'warning',
      read: false,
      timestamp: Date.now(),
    });

    render(<NotificationDropdown />);
    expect(screen.getByText('1')).toBeDefined();
  });
});
