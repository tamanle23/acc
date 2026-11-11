import { createSignal, createMemo, onMount, onCleanup } from 'solid-js';

export type HeaderLodLevel = 0 | 1 | 2 | 3;
export type LodDensityMode = 'auto' | 'full' | 'standard' | 'compact' | 'minimal';

export interface AdaptiveLodOptions {
  breakpoints?: {
    full: number;      // >= 1360px -> LOD 0
    standard: number;  // >= 1060px -> LOD 1
    compact: number;   // >= 780px  -> LOD 2
                       // < 780px   -> LOD 3
  };
  initialMode?: LodDensityMode;
  storageKey?: string;
}

export interface AdaptiveLodState {
  containerRef: (el: HTMLElement | null) => void;
  lod: HeaderLodLevel;
  lodName: 'full' | 'standard' | 'compact' | 'minimal';
  densityMode: LodDensityMode;
  setDensityMode: (mode: LodDensityMode) => void;
  width: number;
  isFull: boolean;
  isStandard: boolean;
  isCompact: boolean;
  isMinimal: boolean;
}

const DEFAULT_BREAKPOINTS = {
  full: 1360,
  standard: 1060,
  compact: 780,
};

const STORAGE_KEY = 'kx_studio_header_lod_mode';

function calculateLodFromWidth(
  w: number,
  bp = DEFAULT_BREAKPOINTS
): HeaderLodLevel {
  if (w >= bp.full) return 0;
  if (w >= bp.standard) return 1;
  if (w >= bp.compact) return 2;
  return 3;
}

function mapModeToLod(mode: LodDensityMode): HeaderLodLevel | null {
  switch (mode) {
    case 'full':
      return 0;
    case 'standard':
      return 1;
    case 'compact':
      return 2;
    case 'minimal':
      return 3;
    case 'auto':
    default:
      return null;
  }
}

function getInitialDensityMode(storageKey: string, initialMode: LodDensityMode): LodDensityMode {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const saved = window.localStorage.getItem(storageKey) as LodDensityMode | null;
      if (saved && ['auto', 'full', 'standard', 'compact', 'minimal'].includes(saved)) {
        return saved;
      }
    } catch {
      // Ignore localStorage errors
    }
  }
  return initialMode;
}

export function useAdaptiveLod(options: AdaptiveLodOptions = {}): AdaptiveLodState {
  const breakpoints = options.breakpoints || DEFAULT_BREAKPOINTS;
  const initialMode = options.initialMode || 'auto';
  const storageKey = options.storageKey || STORAGE_KEY;

  const [containerEl, setContainerEl] = createSignal<HTMLElement | null>(null);

  const [densityMode, setDensityModeState] = createSignal<LodDensityMode>(
    getInitialDensityMode(storageKey, initialMode)
  );

  const [measuredWidth, setMeasuredWidth] = createSignal<number>(
    typeof window !== 'undefined' ? window.innerWidth || 1280 : 1280
  );

  const setDensityMode = (mode: LodDensityMode) => {
    setDensityModeState(mode);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(storageKey, mode);
      } catch {
        // Ignore write errors
      }
    }
  };

  onMount(() => {
    const handleResize = (w: number) => {
      setMeasuredWidth((prev) => (Math.abs(prev - w) > 2 ? w : prev));
    };

    let observer: ResizeObserver | null = null;
    const el = containerEl();
    if (typeof ResizeObserver !== 'undefined' && el) {
      observer = new ResizeObserver((entries) => {
        if (!entries || entries.length === 0) return;
        const entry = entries[0];
        const cr = entry.contentRect;
        if (cr && cr.width > 0) {
          handleResize(cr.width);
        }
      });
      observer.observe(el);
    }

    const onWinResize = () => handleResize(window.innerWidth);
    window.addEventListener('resize', onWinResize, { passive: true });

    onCleanup(() => {
      if (observer) observer.disconnect();
      window.removeEventListener('resize', onWinResize);
    });
  });

  const effectiveLod = createMemo<HeaderLodLevel>(() => {
    const manual = mapModeToLod(densityMode());
    if (manual !== null) return manual;
    return calculateLodFromWidth(measuredWidth(), breakpoints);
  });

  const lodName = createMemo<'full' | 'standard' | 'compact' | 'minimal'>(() => {
    const l = effectiveLod();
    return l === 0 ? 'full' : l === 1 ? 'standard' : l === 2 ? 'compact' : 'minimal';
  });

  return {
    containerRef: (el: HTMLElement | null) => { setContainerEl(el); },
    get lod() { return effectiveLod(); },
    get lodName() { return lodName(); },
    get densityMode() { return densityMode(); },
    setDensityMode,
    get width() { return measuredWidth(); },
    get isFull() { return effectiveLod() === 0; },
    get isStandard() { return effectiveLod() <= 1; },
    get isCompact() { return effectiveLod() >= 2; },
    get isMinimal() { return effectiveLod() === 3; },
  };
}
