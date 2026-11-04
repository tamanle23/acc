import { useEffect } from 'react';
import { useSpringAuthStore } from '../store';
import { fetchAuthenticationProfile } from '../api-client';

export function useAuthHydration() {
  const { setUser, clearTokens, setHydrating, isHydrating } = useSpringAuthStore();

  useEffect(() => {
    let mounted = true;

    const runHydration = async () => {
      const { accessToken, refreshToken, user } = useSpringAuthStore.getState();

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
        // Only clear tokens if we didn't already have a valid user profile restored
        if (mounted && !user) {
          clearTokens();
        }
      } finally {
        if (mounted) {
          setHydrating(false);
        }
      }
    };

    if (useSpringAuthStore.persist.hasHydrated()) {
      runHydration();
    } else {
      const unsub = useSpringAuthStore.persist.onFinishHydration(() => {
        runHydration();
      });
      return () => {
        mounted = false;
        unsub();
      };
    }

    return () => {
      mounted = false;
    };
  }, [setUser, clearTokens, setHydrating]);

  return { isHydrating };
}
