import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Post } from '../types';
import { createUnipostClient } from '@acc/client';
import { useMobileContextStore } from './useMobileContextStore';
import { resetMobileSandboxPosts } from '../sandbox/mobile-sandbox';

const mobileApiClient = createUnipostClient({
  baseURL: '/api',
  fetch: (url, init) => globalThis.fetch(url, init),
  tenantId: () => useMobileContextStore.getState().activeTenantId,
  workspaceId: () => useMobileContextStore.getState().activeWorkspaceId,
  token: () => useMobileContextStore.getState().authToken,
});

interface PostState {
  posts: Post[];
  isLoading: boolean;
  error: string | null;
  fetchPosts: () => Promise<void>;
  addPost: (post: Omit<Post, 'id' | 'timestamp'> & { id?: string; timestamp?: number }) => Promise<void>;
  clearPosts: () => void;
  resetPosts: () => Promise<void>;
}

export const usePostStore = create<PostState>()(
  persist(
    (set, get) => ({
      posts: [],
      isLoading: false,
      error: null,

      fetchPosts: async () => {
        set({ isLoading: true, error: null });
        try {
          const res = await mobileApiClient.get<any>('/v1/metadata/records', {
            params: { entityType: 'post' },
          });
          const list: Post[] = Array.isArray(res) ? res : res?.content || [];
          set({ posts: list, isLoading: false });
        } catch (err: any) {
          set({ error: err.message || 'Failed to fetch posts', isLoading: false });
        }
      },

      addPost: async (postData) => {
        set({ isLoading: true, error: null });
        const localId = postData.id || `local-${Date.now()}`;
        const newPost: Post = {
          id: localId,
          timestamp: postData.timestamp || Date.now(),
          ...postData,
        };

        // 1. Optimistic local state update
        set((state) => ({ posts: [newPost, ...state.posts] }));

        // 2. Enqueue mutation job in zero-data-loss outbox
        const { useOutboxStore } = await import('./useOutboxStore');
        const idempotencyKey = `idemp_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        const clientTransactionId = `tx_${Date.now()}`;

        useOutboxStore.getState().enqueueMutation({
          idempotencyKey,
          clientTransactionId,
          entityType: 'post',
          operation: 'CREATE',
          targetId: localId,
          payload: newPost as any,
        });

        // 3. Attempt synchronous dispatch via outbox
        try {
          await useOutboxStore.getState().processOutbox();
          set({ isLoading: false });
        } catch (err: any) {
          // Safe: job remains persisted in outbox for subsequent sync attempts
          set({ isLoading: false, error: err.message });
        }
      },

      clearPosts: () => set({ posts: [] }),

      resetPosts: async () => {
        resetMobileSandboxPosts(useMobileContextStore.getState().activeTenantId);
        await get().fetchPosts();
      },
    }),
    {
      name: 'post-storage-v3',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
