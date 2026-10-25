import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useOutboxStore, computeBackoffMs, BACKOFF_BASE_MS, BACKOFF_CAP_MS } from '../store/useOutboxStore';
import { initMobileSandbox, resetMobileSandboxPosts } from '../sandbox/mobile-sandbox';
import { sandboxRegistry } from '@acc/sandbox';
import { mockAsyncStorage } from '../test/setup';

describe('mobile-ui Outbox Chaos, Stress Hardening & Sequential Replay', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sandboxRegistry.clear();
    initMobileSandbox();
    resetMobileSandboxPosts('tenant-us-east-1');
    useOutboxStore.getState().resetQueue();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('1. Backoff & Jitter Algorithm Correctness', () => {
    it('computes bounded exponential backoff with equal jitter', () => {
      // 0 retries or 1 retry: 2^0 * base = 1000ms. With jitter [500ms, 1000ms]
      const minJitter = computeBackoffMs(1, () => 0);
      const maxJitter = computeBackoffMs(1, () => 1);
      const midJitter = computeBackoffMs(1, () => 0.5);

      expect(minJitter).toBe(500);
      expect(maxJitter).toBe(1000);
      expect(midJitter).toBe(750);

      // Retry 2: base * 2^1 = 2000ms -> [1000ms, 2000ms]
      expect(computeBackoffMs(2, () => 0)).toBe(1000);
      expect(computeBackoffMs(2, () => 1)).toBe(2000);

      // Retry 3: base * 2^2 = 4000ms -> [2000ms, 4000ms]
      expect(computeBackoffMs(3, () => 0)).toBe(2000);
      expect(computeBackoffMs(3, () => 1)).toBe(4000);

      // Cap at BACKOFF_CAP_MS (300000ms)
      expect(computeBackoffMs(20, () => 0)).toBe(BACKOFF_CAP_MS / 2);
      expect(computeBackoffMs(20, () => 1)).toBe(BACKOFF_CAP_MS);
    });
  });

  describe('2. Network Severance & 50-Mutation Queue Durability', () => {
    it('enqueues 50 offline mutations, persists queue in durable storage, and survives simulated offline retry', async () => {
      // Sever the network via high priority 503 handler
      let isNetworkOnline = false;
      const executedRequestKeys: string[] = [];

      sandboxRegistry.register({
        id: 'chaos-network-gate',
        name: 'Chaos Network Gate',
        priority: 1000,
        matcher: (ctx) => ctx.pathname.includes('/v1/metadata/records'),
        handler: (ctx) => {
          if (!isNetworkOnline) {
            return {
              status: 503,
              data: { error: 'Service Unavailable (Offline)' },
            };
          }
          const idempKey = ctx.headers['idempotency-key'] || ctx.headers['Idempotency-Key'] || 'unknown';
          executedRequestKeys.push(idempKey);
          return {
            status: 200,
            data: { id: `rec-${executedRequestKeys.length}`, status: 'PERSISTED' },
          };
        },
      });

      // 1. Enqueue 50 distinct mutations while network is completely dead
      for (let i = 1; i <= 50; i++) {
        useOutboxStore.getState().enqueueMutation({
          idempotencyKey: `idemp-batch-${i}`,
          clientTransactionId: `tx-batch-${i}`,
          entityType: 'post',
          operation: 'CREATE',
          payload: { title: `Offline Post #${i}`, index: i },
        });
      }

      const initialQueue = useOutboxStore.getState().queue;
      expect(initialQueue.length).toBe(50);
      expect(initialQueue.every((job) => job.status === 'PENDING')).toBe(true);

      // 2. Attempt sync while offline -> all 50 fail gracefully, receive nextRetryAt
      const offlineResult = await useOutboxStore.getState().processOutbox();
      expect(offlineResult.failed).toBe(50);
      expect(offlineResult.succeeded).toBe(0);

      const failedQueue = useOutboxStore.getState().queue;
      expect(failedQueue.length).toBe(50);
      expect(failedQueue.every((job) => job.status === 'FAILED')).toBe(true);
      expect(failedQueue.every((job) => typeof job.nextRetryAt === 'number' && job.nextRetryAt > Date.now())).toBe(true);
      expect(failedQueue.every((job) => job.retries === 1)).toBe(true);

      // 3. Immediate sync while inside backoff window skips all jobs
      const skippedResult = await useOutboxStore.getState().processOutbox();
      expect(skippedResult.succeeded).toBe(0);
      expect(skippedResult.failed).toBe(0); // None attempted because all are skipped due to nextRetryAt

      // 4. Verify durable persistence layer
      expect(mockAsyncStorage.setItem).toHaveBeenCalled();

      // 5. Restore network & advance clock past backoff window
      isNetworkOnline = true;
      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now + BACKOFF_CAP_MS + 1000);

      // 6. Sync again -> all 50 replay sequentially in FIFO order
      const onlineResult = await useOutboxStore.getState().processOutbox();
      expect(onlineResult.succeeded).toBe(50);
      expect(onlineResult.failed).toBe(0);

      // Verify strict sequential replay order
      expect(executedRequestKeys.length).toBe(50);
      for (let i = 0; i < 50; i++) {
        expect(executedRequestKeys[i]).toBe(`idemp-batch-${i + 1}`);
      }

      // Verify all jobs in queue are marked SYNCED
      const syncedQueue = useOutboxStore.getState().queue;
      expect(syncedQueue.every((job) => job.status === 'SYNCED')).toBe(true);
    });
  });

  describe('3. Idempotency Preservation Across Retries', () => {
    it('maintains identical Idempotency-Key and Client-Transaction-Id across retries to prevent duplicate processing', async () => {
      let callCount = 0;
      const receivedHeaders: Array<{ idempotencyKey: string; clientTransactionId: string }> = [];

      sandboxRegistry.register({
        id: 'idempotency-verifier',
        name: 'Idempotency Verifier',
        priority: 1000,
        matcher: (ctx) => ctx.pathname.includes('/v1/metadata/records'),
        handler: (ctx) => {
          callCount++;
          receivedHeaders.push({
            idempotencyKey: ctx.headers['idempotency-key'] || ctx.headers['Idempotency-Key'],
            clientTransactionId: ctx.headers['client-transaction-id'] || ctx.headers['Client-Transaction-Id'],
          });

          if (callCount === 1) {
            return { status: 500, data: { error: 'Temporary Server Hiccup' } };
          }
          return { status: 200, data: { id: 'rec-success', success: true } };
        },
      });

      useOutboxStore.getState().enqueueMutation({
        idempotencyKey: 'idemp-constant-key-12345',
        clientTransactionId: 'tx-constant-tx-67890',
        entityType: 'post',
        operation: 'CREATE',
        payload: { title: 'Idempotency Test' },
      });

      // First run: fails
      const run1 = await useOutboxStore.getState().processOutbox();
      expect(run1.failed).toBe(1);

      // Advance clock past backoff
      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now + 10000);

      // Second run: succeeds
      const run2 = await useOutboxStore.getState().processOutbox();
      expect(run2.succeeded).toBe(1);

      expect(receivedHeaders.length).toBe(2);
      expect(receivedHeaders[0].idempotencyKey).toBe('idemp-constant-key-12345');
      expect(receivedHeaders[1].idempotencyKey).toBe('idemp-constant-key-12345');
      expect(receivedHeaders[0].clientTransactionId).toBe('tx-constant-tx-67890');
      expect(receivedHeaders[1].clientTransactionId).toBe('tx-constant-tx-67890');
    });
  });

  describe('4. 3-Way Conflict Merging & Recovery Flow', () => {
    it('manages OCC 409 conflict, pauses affected job, and replays seamlessly on CUSTOM_MERGE', async () => {
      let isConflicted = true;
      let lastReceivedPayload: any = null;

      sandboxRegistry.register({
        id: 'occ-conflict-handler',
        name: 'OCC Conflict Handler',
        priority: 1000,
        matcher: (ctx) => ctx.pathname.includes('/v1/metadata/records/post-999'),
        handler: (_req, ctx) => {
          lastReceivedPayload = typeof _req?.data === 'object' ? _req.data : (_req?.body ? JSON.parse(_req.body) : {});
          if (isConflicted) {
            return {
              status: 409,
              data: {
                error: 'Optimistic Concurrency Conflict: Version mismatch',
                serverState: {
                  title: 'Server Title Modified by Bob',
                  views: 150,
                  version: 3,
                },
              },
            };
          }
          return {
            status: 200,
            data: { id: 'post-999', ...(lastReceivedPayload || {}), version: 4 },
          };
        },
      });

      const jobId = useOutboxStore.getState().enqueueMutation({
        idempotencyKey: 'idemp-conflict-flow',
        clientTransactionId: 'tx-conflict-flow',
        entityType: 'post',
        operation: 'UPDATE',
        targetId: 'post-999',
        expectedVersion: 2,
        payload: {
          title: 'Alice Offline Title Edit',
          views: 120,
        },
      });

      // 1. Process outbox -> hits 409
      const result1 = await useOutboxStore.getState().processOutbox();
      expect(result1.conflicts).toBe(1);

      const state1 = useOutboxStore.getState();
      expect(state1.activeConflictJob?.id).toBe(jobId);
      expect(state1.activeConflictJob?.serverState).toEqual({
        title: 'Server Title Modified by Bob',
        views: 150,
        version: 3,
      });

      // 2. Resolve conflict with CUSTOM_MERGE
      isConflicted = false; // Server allows subsequent merge resolution
      const mergedPayload = {
        title: 'Alice & Bob Merged Title',
        views: 150, // Keep higher server view count
        resolutionNotes: 'Merged offline edits with Bob changes',
      };

      await useOutboxStore.getState().resolveConflict(jobId, 'CUSTOM_MERGE', mergedPayload);

      const state2 = useOutboxStore.getState();
      expect(state2.activeConflictJob).toBeNull();
      const resolvedJob = state2.queue.find((j) => j.id === jobId);
      expect(resolvedJob?.status).toBe('SYNCED');
      expect(resolvedJob?.payload).toEqual(mergedPayload);
      expect(lastReceivedPayload).toEqual(mergedPayload);
    });

    it('discards local mutation cleanly on ACCEPT_SERVER resolution', async () => {
      const jobId = useOutboxStore.getState().enqueueMutation({
        idempotencyKey: 'idemp-discard',
        clientTransactionId: 'tx-discard',
        entityType: 'post',
        operation: 'UPDATE',
        targetId: 'post-discard',
        payload: { title: 'Local to discard' },
      });

      // Set job to conflict state
      useOutboxStore.setState({
        queue: useOutboxStore.getState().queue.map((j) => (j.id === jobId ? { ...j, status: 'CONFLICT' } : j)),
        activeConflictJob: useOutboxStore.getState().queue[0],
      });

      await useOutboxStore.getState().resolveConflict(jobId, 'ACCEPT_SERVER');

      expect(useOutboxStore.getState().activeConflictJob).toBeNull();
      expect(useOutboxStore.getState().queue.find((j) => j.id === jobId)).toBeUndefined();
    });
  });
});
