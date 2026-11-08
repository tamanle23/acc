import { createSignal, onMount, onCleanup, type Accessor } from 'solid-js';

export type PreviewLOD = 'compact' | 'medium' | 'full';
export type TitlebarLOD = 'compact' | 'medium' | 'full';

export function getLODTierFromWidth(width: number): PreviewLOD {
  if (width < 640) return 'compact';
  if (width < 960) return 'medium';
  return 'full';
}

export function getTitlebarLODTier(width: number): TitlebarLOD {
  if (width < 800) return 'compact';
  if (width < 1280) return 'medium';
  return 'full';
}

function resolveTarget(target: any): HTMLElement | null {
  if (!target) return null;
  if (typeof target === 'function') return target();
  if ('current' in target) return target.current;
  return target;
}

export function useContainerLOD(
  target: any
): Accessor<PreviewLOD> {
  const [lod, setLod] = createSignal<PreviewLOD>('full');

  onMount(() => {
    const el = resolveTarget(target);
    if (!el) return;

    const updateTier = (width: number) => {
      if (width <= 0) return;
      const nextLod = getLODTierFromWidth(width);
      setLod(nextLod);
    };

    const initialWidth = el.getBoundingClientRect().width || el.clientWidth;
    if (initialWidth > 0) updateTier(initialWidth);

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry) return;
        const width = entry.contentRect.width || el.getBoundingClientRect().width || el.clientWidth;
        updateTier(width);
      });
      observer.observe(el);
      onCleanup(() => observer.disconnect());
    } else {
      const handleWindowResize = () => {
        const w = el.getBoundingClientRect().width || el.clientWidth;
        updateTier(w);
      };
      window.addEventListener('resize', handleWindowResize);
      onCleanup(() => window.removeEventListener('resize', handleWindowResize));
    }
  });

  return lod;
}

export function useTitlebarLOD(
  target?: any
): Accessor<TitlebarLOD> {
  const [lod, setLod] = createSignal<TitlebarLOD>(
    typeof window !== 'undefined' ? getTitlebarLODTier(window.innerWidth) : 'full'
  );

  onMount(() => {
    const el = resolveTarget(target);

    const updateTier = (width: number) => {
      if (width <= 0) return;
      const nextLod = getTitlebarLODTier(width);
      setLod(nextLod);
    };

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
      onCleanup(() => observer.disconnect());
    }

    onCleanup(() => window.removeEventListener('resize', handleResize));
  });

  return lod;
}
