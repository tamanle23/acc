import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createUnipostClient } from '@unipost/client';
import { useMobileContextStore } from './useMobileContextStore';

export type OutboxJobStatus = 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED' | 'CONFLICT';
export type MutationOperation = 'CREATE' | 'UPDATE' | 'DELETE';

export interface OutboxMutationJob {
  id: string; // Internal outbox job UUID
  idempotencyKey: string;
  clientTransactionId: string;
  entityType: string;
  operation: MutationOperation;
  targetId?: string | number;
  payload: Record<string, unknown>;
  expectedVersion?: number;
  serverState?: Record<string, unknown>;
  conflictReason?: string;
  createdAt: number;
  retries: number;
  status: OutboxJobStatus;
  errorMessage?: string;
  nextRetryAt?: number;
}

export const BACKOFF_BASE_MS = 1000;
export const BACKOFF_CAP_MS = 300000;

/** Equal-jitter exponential backoff: avoids thundering-herd on reconnect. */
export function computeBackoffMs(retries: number, random: () => number = Math.random): number {
  const exp = Math.min(BACKOFF_CAP_MS, BACKOFF_BASE_MS * 2 ** Math.max(0, retries - 1));
  return Math.round(exp / 2 + random() * (exp / 2));
}

interface OutboxState {
  queue: OutboxMutationJob[];
  isSyncing: boolean;
  activeConflictJob: OutboxMutationJob | null;
  enqueueMutation: (job: Omit<OutboxMutationJob, 'id' | 'createdAt' | 'retries' | 'status'>) => string;
  processOutbox: () => Promise<{ succeeded: number; failed: number; conflicts: number }>;
  resolveConflict: (jobId: string, resolution: 'KEEP_LOCAL' | 'ACCEPT_SERVER' | 'CUSTOM_MERGE', mergedData?: Record<string, unknown>) => Promise<void>;
  clearSyncedJobs: () => void;
  resetQueue: () => void;
}

const outboxClient = createUnipostClient({
  baseURL: '/api',
  fetch: (url, init) => globalThis.fetch(url, init),
  tenantId: () => useMobileContextStore.getState().activeTenantId,
  workspaceId: () => useMobileContextStore.getState().activeWorkspaceId,
  token: () => useMobileContextStore.getState().authToken,
});

export const useOutboxStore = create<OutboxState>()(
  persist(
    (set, get) => ({
      queue: [],
      isSyncing: false,
      activeConflictJob: null,

      enqueueMutation: (jobData) => {
        const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const job: OutboxMutationJob = {
          ...jobData,
          id: jobId,
          createdAt: Date.now(),
          retries: 0,
          status: 'PENDING',
        };

        set((state) => ({ queue: [...state.queue, job] }));
        return jobId;
      },

      processOutbox: async () => {
        if (get().isSyncing) {
          return { succeeded: 0, failed: 0, conflicts: 0 };
        }

        set({ isSyncing: true });
        let succeeded = 0;
        let failed = 0;
        let conflicts = 0;

        const currentQueue = [...get().queue];

        for (const job of currentQueue) {
          if (job.status === 'SYNCED' || job.status === 'CONFLICT') {
            continue;
          }
          if (job.status === 'FAILED' && job.nextRetryAt !== undefined && job.nextRetryAt > Date.now()) {
            continue;
          }

          // Mark job as syncing
          set((state) => ({
            queue: state.queue.map((j) => (j.id === job.id ? { ...j, status: 'SYNCING' } : j)),
          }));

          try {
            const endpoint =
              job.operation === 'CREATE'
                ? `/v1/metadata/records`
                : `/v1/metadata/records/${job.targetId}`;

            const headers: Record<string, string> = {
              'Idempotency-Key': job.idempotencyKey,
              'Client-Transaction-Id': job.clientTransactionId,
            };

            let method: 'POST' | 'PUT' | 'DELETE' = 'POST';
            if (job.operation === 'UPDATE') method = 'PUT';
            if (job.operation === 'DELETE') method = 'DELETE';

            await outboxClient.request(endpoint, {
              method,
              headers,
              params: { entityType: job.entityType },
              body: JSON.stringify(job.payload),
            });

            // Mark job as synced
            set((state) => ({
              queue: state.queue.map((j) => (j.id === job.id ? { ...j, status: 'SYNCED', errorMessage: undefined } : j)),
            }));
            succeeded++;
          } catch (err: any) {
            // Check for OCC 409 conflict
            if (err.status === 409) {
              conflicts++;
              const serverState = err.rawResponse?.serverState || err.problemDetail?.properties?.serverState;
              const conflictJob: OutboxMutationJob = {
                ...job,
                status: 'CONFLICT',
                conflictReason: err.message || 'Optimistic Concurrency Conflict',
                serverState,
              };

              set((state) => ({
                activeConflictJob: conflictJob,
                queue: state.queue.map((j) => (j.id === job.id ? conflictJob : j)),
              }));
            } else {
              failed++;
              set((state) => ({
                queue: state.queue.map((j) =>
                  j.id === job.id
                    ? {
                        ...j,
                        retries: j.retries + 1,
                        status: 'FAILED',
                        nextRetryAt: Date.now() + computeBackoffMs(j.retries + 1),
                        errorMessage: err.message || 'Network sync failed',
                      }
                    : j
                ),
              }));
            }
          }
        }

        set({ isSyncing: false });
        return { succeeded, failed, conflicts };
      },

      resolveConflict: async (jobId, resolution, mergedData) => {
        const job = get().queue.find((j) => j.id === jobId);
        if (!job) return;

        if (resolution === 'ACCEPT_SERVER') {
          // Discard local mutation
          set((state) => ({
            activeConflictJob: state.activeConflictJob?.id === jobId ? null : state.activeConflictJob,
            queue: state.queue.filter((j) => j.id !== jobId),
          }));
          return;
        }

        const resolvedPayload =
          resolution === 'CUSTOM_MERGE' && mergedData
            ? mergedData
            : job.payload;

        // Force overwrite with incremented retries
        set((state) => ({
          activeConflictJob: state.activeConflictJob?.id === jobId ? null : state.activeConflictJob,
          queue: state.queue.map((j) =>
            j.id === jobId
              ? {
                  ...j,
                  payload: resolvedPayload,
                  status: 'PENDING',
                  conflictReason: undefined,
                }
              : j
          ),
        }));

        await get().processOutbox();
      },

      clearSyncedJobs: () => {
        set((state) => ({
          queue: state.queue.filter((j) => j.status !== 'SYNCED'),
        }));
      },

      resetQueue: () => {
        set({ queue: [], isSyncing: false, activeConflictJob: null });
      },
    }),
    {
      name: 'outbox-mutation-storage-v1',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
