import { create } from 'zustand';
import type { AuthState, AuthenticationProfile } from './types';
import { persist, createJSONStorage } from 'zustand/middleware';
import { decodeJwt } from './utils/jwt';
import { useSandboxStore } from '../../core/sandbox/store/sandbox-store';

const REFRESH_STORAGE_KEY = 'sandbox_refresh_token';

export const useSpringAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: localStorage.getItem(REFRESH_STORAGE_KEY),
      user: null,
      currentTenantId: null,
      isAuthenticated: false,
      isHydrating: true, // Start in hydrating mode
      isSandbox: false,
      setTokens: (access: string, refresh: string) => {
        if (refresh) {
          localStorage.setItem(REFRESH_STORAGE_KEY, refresh);
        }
        const isSandbox = Boolean(
          access?.endsWith('.mock_signature') ||
          refresh?.startsWith('mock_refresh_token_')
        );
        let decodedUser: any = null;
        if (access) {
          try {
            decodedUser = decodeJwt(access);
          } catch {
            /* ignore */
          }
        }
        set((state) => ({
          accessToken: access,
          refreshToken: refresh,
          user: decodedUser || state.user,
          currentTenantId: decodedUser?.tenantId || state.currentTenantId,
          isAuthenticated: Boolean(access),
          isSandbox,
        }));
      },
      setUser: (user: AuthenticationProfile | null) => {
        set({
          user,
          currentTenantId: user?.tenantId || null,
          isAuthenticated: Boolean(user),
          isHydrating: false,
        });
      },
      setHydrating: (val: boolean) => set({ isHydrating: val }),
      clearTokens: () => {
        localStorage.removeItem(REFRESH_STORAGE_KEY);
        // Deactivate sandbox mode when logging out
        try {
          useSandboxStore.getState().setEnabled(false);
        } catch {
          /* ignore */
        }
        set({
          accessToken: null,
          refreshToken: null,
          user: null,
          currentTenantId: null,
          isAuthenticated: false,
          isHydrating: false,
          isSandbox: false,
        });
      },
      expireAccessToken: () => {
        const { accessToken } = get();
        if (accessToken) {
          set({ accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJleHBpcmVkIiwiZXhwIjoxMDAwMDAwfQ.invalid' });
        }
      },
      expireRefreshToken: () => {
        localStorage.setItem(REFRESH_STORAGE_KEY, 'expired_mock_refresh_token');
        set({ refreshToken: 'expired_mock_refresh_token' });
      },
    }),
    {
      name: 'sandbox_auth_store',
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);
