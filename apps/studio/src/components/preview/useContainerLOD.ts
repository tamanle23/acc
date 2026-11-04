import { useState, useEffect, useLayoutEffect, type RefObject } from 'react';

export type PreviewLOD = 'compact' | 'medium' | 'full';
export type TitlebarLOD = 'compact' | 'medium' | 'full';

/**
 * Determine Preview container LOD tier strictly from pixel width:
 * - 'compact' (< 640px)
 * - 'medium' (640px - 959px)
 * - 'full' (>= 960px)
 */
export function getLODTierFromWidth(width: number): PreviewLOD {
  if (width < 640) return 'compact';
  if (width < 960) return 'medium';
  return 'full';
}

/**
 * Determine Titlebar LOD tier strictly from pixel width:
 * - 'compact' (< 800px)
 * - 'medium' (800px - 1279px)
 * - 'full' (>= 1280px)
 */
export function getTitlebarLODTier(width: number): TitlebarLOD {
  if (width < 800) return 'compact';
  if (width < 1280) return 'medium';
  return 'full';
}

/**
 * useContainerLOD - Adaptive Level of Detail Hook for Preview Viewport
 * Observes container element width and computes the appropriate responsive LOD tier:
 * - 'compact' (< 640px)
 * - 'medium' (640px - 959px)
 * - 'full' (>= 960px)
 */
export function useContainerLOD(
  target: RefObject<HTMLElement | null> | HTMLElement | null
): PreviewLOD {
  const [lod, setLod] = useState<PreviewLOD>('full');

  // Helper to extract the element whether a RefObject or direct HTMLElement was provided
  const getElement = (): HTMLElement | null => {
    if (!target) return null;
    if ('current' in target) {
      return target.current;
    }
    return target;
  };

  const updateTier = (width: number) => {
    if (width <= 0) return;
    const nextLod = getLODTierFromWidth(width);
    setLod((prev) => (prev !== nextLod ? nextLod : prev));
  };

  // Immediate layout effect measurement for synchronous first paint
  useLayoutEffect(() => {
    const el = getElement();
    if (!el) return;
    const initialWidth = el.getBoundingClientRect().width || el.clientWidth;
    if (initialWidth > 0) {
      updateTier(initialWidth);
    }
  });

  useEffect(() => {
    const el = getElement();
    if (!el) return;

    // Measure immediately in effect
    const initialWidth = el.getBoundingClientRect().width || el.clientWidth;
    if (initialWidth > 0) {
      updateTier(initialWidth);
    }

    if (typeof ResizeObserver === 'undefined') {
      const handleWindowResize = () => {
        const w = el.getBoundingClientRect().width || el.clientWidth;
        updateTier(w);
      };
      window.addEventListener('resize', handleWindowResize);
      return () => window.removeEventListener('resize', handleWindowResize);
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const width = entry.contentRect.width || el.getBoundingClientRect().width || el.clientWidth;
      updateTier(width);
    });

    observer.observe(el);

    const handleWindowResize = () => {
      const w = el.getBoundingClientRect().width || el.clientWidth;
      updateTier(w);
    };
    window.addEventListener('resize', handleWindowResize);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', handleWindowResize);
    };
  }, [target]);

  return lod;
}

/**
 * useTitlebarLOD - Adaptive Level of Detail Hook for Titlebar
 * Observes header element width (or window width fallback) and computes:
 * - 'compact' (< 800px)
 * - 'medium' (800px - 1279px)
 * - 'full' (>= 1280px)
 */
export function useTitlebarLOD(
  target?: RefObject<HTMLElement | null> | HTMLElement | null
): TitlebarLOD {
  const [lod, setLod] = useState<TitlebarLOD>(() => {
    if (typeof window !== 'undefined') {
      return getTitlebarLODTier(window.innerWidth);
    }
    return 'full';
  });

  const getElement = (): HTMLElement | null => {
    if (!target) return null;
    if ('current' in target) {
      return target.current;
    }
    return target;
  };

  const updateTier = (width: number) => {
    if (width <= 0) return;
    const nextLod = getTitlebarLODTier(width);
    setLod((prev) => (prev !== nextLod ? nextLod : prev));
  };

  useLayoutEffect(() => {
    const el = getElement();
    const initialWidth = el ? el.getBoundingClientRect().width || el.clientWidth : window.innerWidth;
    if (initialWidth > 0) {
      updateTier(initialWidth);
    }
  });

  useEffect(() => {
    const el = getElement();

    const handleResize = () => {
      const w = el ? el.getBoundingClientRect().width || el.clientWidth : window.innerWidth;
      updateTier(w);
    };

    handleResize();

    window.addEventListener('resize', handleResize);

    if (el && typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry) return;
        const width = entry.contentRect.width || el.getBoundingClientRect().width || el.clientWidth;
        updateTier(width);
      });
      observer.observe(el);
      return () => {
        observer.disconnect();
        window.removeEventListener('resize', handleResize);
      };
    }

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [target]);

  return lod;
}
