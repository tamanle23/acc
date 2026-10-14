import { useEffect } from 'react';
import { useSpringAuthStore } from '../store';

export function useAuthHydration() {
  const { refreshToken, setHydrating, isHydrating } = useSpringAuthStore();

  useEffect(() => {
    let mounted = true;

    const hydrate = async () => {
      if (!refreshToken) {
        if (mounted) setHydrating(false);
        return;
      }
    };

    hydrate();

    return () => {
      mounted = false;
    };
  }, [refreshToken, setHydrating]);

  return { isHydrating };
}
