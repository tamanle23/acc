import { useState, useEffect, type RefObject } from 'react';

export type PreviewLOD = 'compact' | 'medium' | 'full';

/**
 * useContainerLOD - Adaptive Level of Detail Hook
 * Observes container element width and computes the appropriate responsive LOD tier:
 * - 'compact' (< 640px)
 * - 'medium' (640px - 959px)
 * - 'full' (>= 960px)
 */
export function useContainerLOD(ref: RefObject<HTMLElement | null>): PreviewLOD {
  const [lod, setLod] = useState<PreviewLOD>('full');

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (typeof ResizeObserver === 'undefined') {
      // Safe fallback for SSR or headless environments
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const width = entry.contentRect.width;
      if (width < 640) {
        setLod('compact');
      } else if (width < 960) {
        setLod('medium');
      } else {
        setLod('full');
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return lod;
}
