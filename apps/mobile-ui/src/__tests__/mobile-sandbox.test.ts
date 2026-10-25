import { describe, it, expect, beforeEach } from 'vitest';
import {
  initMobileSandbox,
  resetMobileSandboxPosts,
  mobilePostsSandboxHandler,
} from '../sandbox/mobile-sandbox';
import { usePostStore } from '../store/usePostStore';
import { useMobileContextStore } from '../store/useMobileContextStore';
import { defaultSandboxEngine, sandboxRegistry } from '@acc/sandbox';

describe('mobile-ui Sandbox & Context Store Integration', () => {
  beforeEach(() => {
    sandboxRegistry.clear();
    initMobileSandbox();
    resetMobileSandboxPosts('tenant-us-east-1');
    useMobileContextStore.getState().setActiveTenant('tenant-us-east-1');
    usePostStore.getState().clearPosts();
  });

  it('registers mobile posts sandbox handler with expected matcher', () => {
    const match = sandboxRegistry.findHandler('/api/v1/metadata/records?entityType=post', 'GET');
    expect(match).not.toBeNull();
    expect(match?.handler.id).toBe('mobile-posts-handler');
  });

  it('fetches posts through AccClient intercepted by Unified Sandbox', async () => {
    await usePostStore.getState().fetchPosts();
    const posts = usePostStore.getState().posts;

    expect(posts.length).toBeGreaterThan(0);
    expect(posts[0].content).toContain('Chasing the neon sunsets in Tokyo');
  });

  it('adds a new post via sandbox mutation and prepends to store', async () => {
    await usePostStore.getState().fetchPosts();
    const countBefore = usePostStore.getState().posts.length;

    await usePostStore.getState().addPost({
      author: { id: 'user-op', username: 'FieldOperator' },
      content: 'Live update from field operations!',
      tags: ['field', 'mobile'],
    });

    const postsAfter = usePostStore.getState().posts;
    expect(postsAfter.length).toBe(countBefore + 1);
    expect(postsAfter[0].content).toBe('Live update from field operations!');
  });

  it('synchronizes active tenant between useMobileContextStore and defaultSandboxStore', () => {
    useMobileContextStore.getState().setActiveTenant('tenant-apac-1');
    expect(defaultSandboxEngine.getStore().getState().activeTenantId).toBe('tenant-apac-1');

    useMobileContextStore.getState().setActivePersona('creator');
    expect(useMobileContextStore.getState().activePersonaId).toBe('creator');
    expect(useMobileContextStore.getState().activeTenantId).toBe('tenant-eu-central-1');
  });

  it('resets in-memory posts deterministically on resetPosts()', async () => {
    await usePostStore.getState().addPost({
      author: { id: 'temp-1', username: 'Temp' },
      content: 'Temporary draft',
      tags: [],
    });

    await usePostStore.getState().resetPosts();
    const posts = usePostStore.getState().posts;
    expect(posts.some((p) => p.content === 'Temporary draft')).toBe(false);
  });
});
