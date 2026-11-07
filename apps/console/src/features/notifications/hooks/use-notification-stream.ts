import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useSpringAuthStore } from '@/features/spring-auth';
import { useMetadataUiStore } from '@/features/metadata/store/use-metadata-ui-store';
import { useSandboxStore } from '@/core/sandbox/store/sandbox-store';
import { useUserProfileQuery } from '@/features/settings/profile/api/use-user-profile';
import { useNotificationStore } from '../store/use-notification-store';
import type { NotificationItem, NotificationSeverity, NotificationCategory } from '../types';

/**
 * Global SSE notification stream hook.
 * Connects to /api/v1/notifications/stream, listens for real-time domain events,
 * writes to useNotificationStore, invalidates React Query caches, and dispatches Sonner toasts.
 */
export function useNotificationStream() {
  const queryClient = useQueryClient();
  const { isAuthenticated, isSandbox, accessToken } = useSpringAuthStore();
  const activeTenantId = useMetadataUiStore((s) => s.activeTenantId);
  const sandboxTenantId = useSandboxStore((s) => s.activeTenantId);
  const { data: userProfile } = useUserProfileQuery();

  const addNotification = useNotificationStore((s) => s.addNotification);
  const setConnected = useNotificationStore((s) => s.setConnected);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);

  const preferences = userProfile?.preferences?.notifications as
    | {
        type?: 'all' | 'mentions' | 'none';
        browserToasts?: boolean;
        workflowAlerts?: boolean;
        securityAlerts?: boolean;
      }
    | undefined;

  const assumedTenant =
    typeof window !== 'undefined' ? localStorage.getItem('acc_assumed_tenant') : null;
  const effectiveTenantId =
    assumedTenant && assumedTenant !== 'SYSTEM'
      ? assumedTenant
      : activeTenantId || sandboxTenantId || 'DEFAULT';

  useEffect(() => {
    // Only connect when user is actively authenticated
    if (!isAuthenticated) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setConnected(false);
      return;
    }

    // In offline sandbox mode, simulate a connected notification stream without failing backend requests
    if (isSandbox) {
      setConnected(true);
      return;
    }

    let isSubscribed = true;

    const connectSSE = () => {
      if (!isSubscribed) return;

      try {
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
        }

        const queryParams = new URLSearchParams();
        queryParams.set('tenantId', effectiveTenantId);
        if (accessToken) {
          queryParams.set('token', accessToken);
        }

        const streamUrl = `/api/v1/notifications/stream?${queryParams.toString()}`;
        const es = new EventSource(streamUrl);
        eventSourceRef.current = es;

        es.addEventListener('INIT', (e) => {
          if (!isSubscribed) return;
          setConnected(true);
          reconnectAttemptsRef.current = 0;
        });

        // 1. Task Approval Alerts
        es.addEventListener('APPROVAL_REQUESTED', (e) => {
          if (!isSubscribed) return;
          try {
            const data = JSON.parse(e.data);
            const title = data.title || 'Task Approval Required';
            const message = data.message || `Workflow task ${data.taskId || ''} requires review.`;
            const actionUrl = data.actionUrl || '/approvals';

            addNotification({
              title,
              message,
              severity: 'warning',
              category: 'approval',
              actionUrl,
              metadata: data,
            });

            queryClient.invalidateQueries({ queryKey: ['workflows', 'approvals'] });
            queryClient.invalidateQueries({ queryKey: ['approvals'] });

            if (preferences?.browserToasts !== false) {
              toast.warning(title, {
                description: message,
                action: {
                  label: 'Review',
                  onClick: () => {
                    if (typeof window !== 'undefined') window.location.href = actionUrl;
                  },
                },
              });
            }
          } catch {
            /* ignore malformed payload */
          }
        });

        // 2. Workflow Execution Status Updates
        es.addEventListener('WORKFLOW_STATUS_CHANGED', (e) => {
          if (!isSubscribed) return;
          try {
            const data = JSON.parse(e.data);
            const status = (data.status || 'UPDATED').toUpperCase();
            const title = `Workflow ${status}`;
            const message = data.message || `Execution ${data.executionId || ''} transitioned to ${status}.`;
            const severity: NotificationSeverity =
              status === 'COMPLETED' ? 'success' : status === 'FAILED' || status === 'TAMPERED' ? 'error' : 'info';
            const actionUrl = data.executionId ? `/workflow-executions` : undefined;

            addNotification({
              title,
              message,
              severity,
              category: 'workflow',
              actionUrl,
              metadata: data,
            });

            queryClient.invalidateQueries({ queryKey: ['workflow-executions'] });
            queryClient.invalidateQueries({ queryKey: ['workflows'] });

            if (preferences?.browserToasts !== false && preferences?.workflowAlerts !== false) {
              if (severity === 'success') toast.success(title, { description: message });
              else if (severity === 'error') toast.error(title, { description: message });
              else toast.info(title, { description: message });
            }
          } catch {
            /* ignore */
          }
        });

        // 3. Dead-Letter Poison Queue Alerts
        es.addEventListener('DLQ_ALERT', (e) => {
          if (!isSubscribed) return;
          try {
            const data = JSON.parse(e.data);
            const title = 'DLQ Task Isolated';
            const message = data.message || `Task ${data.taskId || ''} was quarantined to dead-letter queue.`;

            addNotification({
              title,
              message,
              severity: 'error',
              category: 'system',
              actionUrl: '/system/dlq',
              metadata: data,
            });

            queryClient.invalidateQueries({ queryKey: ['dlq'] });

            if (preferences?.browserToasts !== false) {
              toast.error(title, {
                description: message,
                action: {
                  label: 'Inspect DLQ',
                  onClick: () => {
                    if (typeof window !== 'undefined') window.location.href = '/system/dlq';
                  },
                },
              });
            }
          } catch {
            /* ignore */
          }
        });

        // 4. Security & Role Revocation Alarms
        es.addEventListener('REVOCATION', (e) => {
          if (!isSubscribed) return;
          try {
            const data = JSON.parse(e.data);
            const title = 'Security Authority Updated';
            const message = data.message || 'Assumed role delegation or authority credentials updated.';

            addNotification({
              title,
              message,
              severity: 'warning',
              category: 'security',
              actionUrl: '/system/roles',
              metadata: data,
            });

            queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
            queryClient.invalidateQueries({ queryKey: ['user', 'profile'] });

            if (preferences?.browserToasts !== false) {
              toast.warning(title, { description: message });
            }
          } catch {
            /* ignore */
          }
        });

        // Generic fallback message handler
        es.onmessage = (event) => {
          if (!isSubscribed) return;
          try {
            const data = JSON.parse(event.data);
            if (data.title && data.message) {
              addNotification({
                title: data.title,
                message: data.message,
                severity: data.severity || 'info',
                category: data.category || 'system',
                actionUrl: data.actionUrl,
                metadata: data.metadata,
              });
              if (preferences?.browserToasts !== false) {
                toast.info(data.title, { description: data.message });
              }
            }
          } catch {
            /* ignore non-json pings */
          }
        };

        es.onerror = () => {
          if (!isSubscribed) return;
          setConnected(false);
          es.close();

          // Exponential backoff reconnection capped at 30 seconds
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          reconnectAttemptsRef.current += 1;

          reconnectTimeoutRef.current = setTimeout(() => {
            connectSSE();
          }, delay);
        };
      } catch (err) {
        setConnected(false);
      }
    };

    connectSSE();

    return () => {
      isSubscribed = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setConnected(false);
    };
  }, [
    isAuthenticated,
    isSandbox,
    accessToken,
    effectiveTenantId,
    queryClient,
    addNotification,
    setConnected,
    preferences?.browserToasts,
    preferences?.workflowAlerts,
  ]);
}
