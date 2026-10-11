import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Post } from '../types';
import { createUnipostClient } from '@unipost/client';
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
        try {
          const created = await mobileApiClient.post<Post>(
            '/v1/metadata/records',
            postData,
            { params: { entityType: 'post' } }
          );
          set((state) => ({ posts: [created, ...state.posts], isLoading: false }));
        } catch (err: any) {
          // Optimistic fallback for offline / disconnected states
          const fallbackPost: Post = {
            id: postData.id || `local-${Date.now()}`,
            timestamp: postData.timestamp || Date.now(),
            ...postData,
          };
          set((state) => ({
            posts: [fallbackPost, ...state.posts],
            isLoading: false,
            error: err.message,
          }));
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
