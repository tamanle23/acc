import { useEffect } from 'react';
import { useSpringAuthStore } from '../store';
import { fetchAuthenticationProfile } from '../api-client';

export function useAuthHydration() {
  const { accessToken, refreshToken, setUser, clearTokens, setHydrating, isHydrating } = useSpringAuthStore();

  useEffect(() => {
    let mounted = true;

    const hydrate = async () => {
      if (!accessToken && !refreshToken) {
        if (mounted) setHydrating(false);
        return;
      }

      try {
        const profile = await fetchAuthenticationProfile();
        if (mounted) {
          setUser(profile);
        }
      } catch (_error) {
        if (mounted) {
          clearTokens();
        }
      } finally {
        if (mounted) {
          setHydrating(false);
        }
      }
    };

    hydrate();

    return () => {
      mounted = false;
    };
  }, []); // Run exactly once on mount

  return { isHydrating };
}
