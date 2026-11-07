import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useNotificationStore } from '../store/use-notification-store';
import { NotificationDropdown } from '../components/notification-dropdown';
import { useNotificationStream } from '../hooks/use-notification-stream';
import { useSpringAuthStore } from '@/features/spring-auth';
import { FetchEventSource } from '@/core/sse/fetch-sse';
import type { ConsoleNotification } from '../types';

vi.mock('@/core/sse/fetch-sse', () => {
  class MockFetchEventSource {
    public static instances: MockFetchEventSource[] = [];
    public url: string;
    public options: any;
    public onopen: (() => void) | null = null;
    public onerror: ((err: any) => void) | null = null;
    private listeners: Map<string, Array<(e: any) => void>> = new Map();

    constructor(url: string, options: any = {}) {
      this.url = url;
      this.options = options;
      MockFetchEventSource.instances.push(this);
    }

    addEventListener(type: string, listener: (e: any) => void) {
      if (!this.listeners.has(type)) {
        this.listeners.set(type, []);
      }
      this.listeners.get(type)!.push(listener);
    }

    emit(type: string, data: any) {
      const list = this.listeners.get(type) || [];
      list.forEach((cb) => cb({ type, data: typeof data === 'string' ? data : JSON.stringify(data) }));
    }

    close() {
      // closed
    }
  }

  return {
    FetchEventSource: MockFetchEventSource,
    createFetchEventSource: (url: string, options: any) => new MockFetchEventSource(url, options),
  };
});

vi.mock('@/features/settings/profile/api/use-user-profile', () => ({
  useUserProfileQuery: () => ({ data: null }),
  USER_PROFILE_QUERY_KEY: ['user', 'profile'],
}));

vi.mock('sonner', () => ({
  toast: {
    info: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
  },
}));

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

describe('useNotificationStream', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    (FetchEventSource as any).instances = [];
    useNotificationStore.getState().clearAll();
    useNotificationStore.getState().setConnected(false);
  });

  afterEach(() => {
    queryClient.clear();
    vi.unstubAllGlobals();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('does not connect when user is not authenticated', () => {
    useSpringAuthStore.setState({
      isAuthenticated: false,
      isSandbox: false,
      accessToken: null,
    });

    renderHook(() => useNotificationStream(), { wrapper });

    expect((FetchEventSource as any).instances.length).toBe(0);
    expect(useNotificationStore.getState().isConnected).toBe(false);
  });

  it('passes isSandbox flag to FetchEventSource in offline sandbox mode', () => {
    useSpringAuthStore.setState({
      isAuthenticated: true,
      isSandbox: true,
      accessToken: 'mock-sandbox-token',
    });

    renderHook(() => useNotificationStream(), { wrapper });

    expect((FetchEventSource as any).instances.length).toBe(1);
    expect((FetchEventSource as any).instances[0].options.isSandbox).toBe(true);
  });

  it('connects to SSE endpoint with token option and zero tokens in URL when authenticated', () => {
    useSpringAuthStore.setState({
      isAuthenticated: true,
      isSandbox: false,
      accessToken: 'secure-bearer-jwt-token',
    });

    renderHook(() => useNotificationStream(), { wrapper });

    expect((FetchEventSource as any).instances.length).toBe(1);
    const es = (FetchEventSource as any).instances[0];
    expect(es.url).toContain('/api/v1/notifications/stream');
    // Zero token parameter in the URL (prevents log leakage)
    expect(es.url).not.toContain('token=');
    expect(es.url).toContain('tenantId=');
    // Token supplied securely in options for Authorization header
    expect(es.options.token).toBe('secure-bearer-jwt-token');
  });

  it('receives INIT event and sets connected to true', () => {
    useSpringAuthStore.setState({
      isAuthenticated: true,
      isSandbox: false,
      accessToken: 'token-abc',
    });

    renderHook(() => useNotificationStream(), { wrapper });

    const es = (FetchEventSource as any).instances[0];
    act(() => {
      es.emit('INIT', { status: 'OK' });
    });

    expect(useNotificationStore.getState().isConnected).toBe(true);
  });

  it('receives APPROVAL_REQUESTED event and creates notification', () => {
    useSpringAuthStore.setState({
      isAuthenticated: true,
      isSandbox: false,
      accessToken: 'token-abc',
    });

    renderHook(() => useNotificationStream(), { wrapper });

    const es = (FetchEventSource as any).instances[0];
    act(() => {
      es.emit('APPROVAL_REQUESTED', {
        taskId: 'task-99',
        title: 'Pending Budget Signoff',
        message: 'Review required for budget exceedance',
        actionUrl: '/approvals/task-99',
      });
    });

    const notifications = useNotificationStore.getState().notifications;
    expect(notifications.length).toBe(1);
    expect(notifications[0].title).toBe('Pending Budget Signoff');
    expect(notifications[0].category).toBe('approval');
    expect(useNotificationStore.getState().unreadCount).toBe(1);
  });
});
