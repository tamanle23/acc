import { create } from 'zustand';
import { decodeJwt } from './utils/jwt';
import type { AuthState } from './types';
import { persist, createJSONStorage } from 'zustand/middleware';

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
        const user = decodeJwt(access);
        if (refresh) {
          localStorage.setItem(REFRESH_STORAGE_KEY, refresh);
        }
        const isSandbox = Boolean(
          user?.isSandbox ||
          access?.endsWith('.mock_signature') ||
          refresh?.startsWith('mock_refresh_token_')
        );
        const tenantId = (user?.tenantId as string) || (user?.tid as string) || null;
        set({
          accessToken: access,
          refreshToken: refresh,
          user,
          currentTenantId: tenantId,
          isAuthenticated: !!user,
          isSandbox,
        });
      },
    }),
    {
      name: 'sandbox_auth_store',
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);
