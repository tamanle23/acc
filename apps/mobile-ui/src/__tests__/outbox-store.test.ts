import { describe, it, expect, beforeEach } from 'vitest';
import { useOutboxStore } from '../store/useOutboxStore';
import { usePostStore } from '../store/usePostStore';
import { initMobileSandbox, resetMobileSandboxPosts } from '../sandbox/mobile-sandbox';
import { sandboxRegistry } from '@acc/sandbox';

describe('mobile-ui Zero-Data-Loss Outbox & Conflict Resolution', () => {
  beforeEach(() => {
    sandboxRegistry.clear();
    initMobileSandbox();
    resetMobileSandboxPosts('tenant-us-east-1');
    useOutboxStore.getState().resetQueue();
    usePostStore.getState().clearPosts();
  });

  it('enqueues a mutation job into outbox with PENDING status', () => {
    const jobId = useOutboxStore.getState().enqueueMutation({
      idempotencyKey: 'idemp-1',
      clientTransactionId: 'tx-1',
      entityType: 'post',
      operation: 'CREATE',
      payload: { title: 'Offline Post' },
    });

    const queue = useOutboxStore.getState().queue;
    expect(queue.length).toBe(1);
    expect(queue[0].id).toBe(jobId);
    expect(queue[0].status).toBe('PENDING');
    expect(queue[0].idempotencyKey).toBe('idemp-1');
  });

  it('processes outbox mutations and marks jobs as SYNCED', async () => {
    useOutboxStore.getState().enqueueMutation({
      idempotencyKey: 'idemp-2',
      clientTransactionId: 'tx-2',
      entityType: 'post',
      operation: 'CREATE',
      payload: {
        id: 'post-synced-1',
        content: 'Post synced through outbox pipeline',
      },
    });

    const result = await useOutboxStore.getState().processOutbox();
    expect(result.succeeded).toBe(1);

    const queue = useOutboxStore.getState().queue;
    expect(queue[0].status).toBe('SYNCED');

    // Clears synced jobs cleanly
    useOutboxStore.getState().clearSyncedJobs();
    expect(useOutboxStore.getState().queue.length).toBe(0);
  });

  it('flags job as CONFLICT on HTTP 409 and prompts conflict resolution', async () => {
    // Register mock endpoint that throws 409 conflict
    sandboxRegistry.register({
      id: 'conflict-trigger-handler',
      name: 'Conflict Handler',
      priority: 999,
      matcher: (ctx) => ctx.pathname.includes('/v1/metadata/records/post-conflict'),
      handler: () => ({
        status: 409,
        data: {
          error: 'OCC Conflict',
          serverState: { content: 'Server Remote Updated Version' },
        },
      }),
    });

    useOutboxStore.getState().enqueueMutation({
      idempotencyKey: 'idemp-conflict',
      clientTransactionId: 'tx-conflict',
      entityType: 'post',
      operation: 'UPDATE',
      targetId: 'post-conflict',
      payload: { content: 'Local Offline Version' },
    });

    const result = await useOutboxStore.getState().processOutbox();
    expect(result.conflicts).toBe(1);

    const activeConflict = useOutboxStore.getState().activeConflictJob;
    expect(activeConflict).not.toBeNull();
    expect(activeConflict?.status).toBe('CONFLICT');
    expect(activeConflict?.serverState).toEqual({ content: 'Server Remote Updated Version' });

    // Test resolving conflict by accepting server
    await useOutboxStore.getState().resolveConflict(activeConflict!.id, 'ACCEPT_SERVER');
    expect(useOutboxStore.getState().activeConflictJob).toBeNull();
    expect(useOutboxStore.getState().queue.length).toBe(0);
  });

  it('integrates usePostStore addPost() seamlessly with outbox', async () => {
    await usePostStore.getState().addPost({
      author: { id: 'u1', username: 'FieldOperator' },
      content: 'Outbox integrated post',
      tags: ['field'],
    });

    // Check optimistic state
    const posts = usePostStore.getState().posts;
    expect(posts.length).toBe(1);
    expect(posts[0].content).toBe('Outbox integrated post');

    // Check that an outbox job was enqueued and synced
    const queue = useOutboxStore.getState().queue;
    expect(queue.length).toBe(1);
    expect(queue[0].status).toBe('SYNCED');
  });
});
