import { useEffect } from 'react';
import { useSpringAuthStore } from '../store';
import { springApiClient } from '../api-client';

export function useAuthHydration() {
  const { refreshToken, setTokens, clearTokens, setHydrating, isHydrating } = useSpringAuthStore();

  useEffect(() => {
    let mounted = true;

    const hydrate = async () => {
      // If we don't have a refresh token (even in cookies, though we check local state here), we can skip.
      // In a real prod app with HttpOnly cookies, you might always attempt this on boot.
      if (!refreshToken) {
        if (mounted) setHydrating(false);
        return;
      }

      // try {
      //   const { data } = await springApiClient.post('/auth/refresh', {
      //     refreshToken,
      //   });

      //   if (mounted) {
      //     setTokens(data.accessToken, data.refreshToken || refreshToken);
      //   }
      // } catch (_error) {
      //   if (mounted) {
      //     clearTokens();
      //   }
      // } finally {
      //   if (mounted) {
      //     setHydrating(false);
      //   }
      // }
    };

    hydrate();

    return () => {
      mounted = false;
    };
  }, []); // Run exactly once on mount

  return { isHydrating };
}
