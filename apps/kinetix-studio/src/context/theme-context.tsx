import {
  createContext,
  useContext,
  createSignal,
  createEffect,
  createMemo,
  onMount,
  onCleanup,
  type Component,
  type JSX,
} from 'solid-js';
import type {
  ThemeMode,
  StudioThemeTokens,
  StudioThemePreset,
  ThemeContextValue,
} from '@/types/theme';
import { STUDIO_THEME_PRESETS } from '@/constants/theme-presets';
import {
  THEME_STORAGE_KEY,
  THEME_MODE_KEY,
  applyThemeToDom,
  getSystemModePreference,
  loadCustomThemesFromStorage,
  saveCustomThemesToStorage,
  findThemePresetById,
  getInitialThemeState,
} from '@/lib/theme-utils';

const ThemeContext = createContext<ThemeContextValue | null>(null);

export interface ThemeProviderProps {
  children: JSX.Element;
}

export const ThemeProvider: Component<ThemeProviderProps> = (props) => {
  const initial = getInitialThemeState();
  const [mode, setModeState] = createSignal<ThemeMode>(initial.mode);
  const [activeThemeId, setActiveThemeIdState] = createSignal<string>(initial.themeId);
  const [customThemes, setCustomThemes] = createSignal<StudioThemePreset[]>(
    loadCustomThemesFromStorage()
  );

  // System media query state
  const [systemPreference, setSystemPreference] = createSignal<'dark' | 'light'>(
    typeof window !== 'undefined' ? getSystemModePreference() : 'dark'
  );

  onMount(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      setSystemPreference(e.matches ? 'dark' : 'light');
    };
    media.addEventListener('change', handler);
    onCleanup(() => media.removeEventListener('change', handler));
  });

  // Compute resolved mode ('dark' | 'light')
  const resolvedMode = createMemo<'dark' | 'light'>(() => {
    if (mode() === 'system') return systemPreference();
    return mode() as 'dark' | 'light';
  });

  // Combine curated and custom presets
  const allPresets = createMemo<StudioThemePreset[]>(() => {
    return [...STUDIO_THEME_PRESETS, ...customThemes()];
  });

  // Resolve currently active theme preset
  const activeTheme = createMemo<StudioThemePreset>(() => {
    const found = findThemePresetById(activeThemeId(), customThemes());
    if (found) return found;

    // Fallback based on resolved mode
    const fallbackId = resolvedMode() === 'dark' ? 'carbon-noir' : 'zinc-clean';
    return (
      STUDIO_THEME_PRESETS.find((p) => p.id === fallbackId) ||
      STUDIO_THEME_PRESETS[0]
    );
  });

  // Apply DOM classes and CSS variables whenever active theme or resolved mode changes
  createEffect(() => {
    applyThemeToDom(activeTheme().tokens, resolvedMode());
  });

  // Switch Theme Preset
  const setThemePreset = (id: string) => {
    setActiveThemeIdState(id);
    if (typeof window !== 'undefined') {
      localStorage.setItem(THEME_STORAGE_KEY, id);
    }

    // Auto-align mode with theme's designated mode
    const target = STUDIO_THEME_PRESETS.find((p) => p.id === id);
    if (target) {
      setModeState(target.mode);
      if (typeof window !== 'undefined') {
        localStorage.setItem(THEME_MODE_KEY, target.mode);
      }
    }
  };

  // Switch Mode (dark | light | system)
  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
    if (typeof window !== 'undefined') {
      localStorage.setItem(THEME_MODE_KEY, newMode);
    }

    const targetResolved = newMode === 'system' ? systemPreference() : newMode;
    // If current theme does not match new mode, switch to the default for that mode
    if (activeTheme().mode !== targetResolved) {
      const nextId = targetResolved === 'dark' ? 'carbon-noir' : 'zinc-clean';
      setActiveThemeIdState(nextId);
      if (typeof window !== 'undefined') {
        localStorage.setItem(THEME_STORAGE_KEY, nextId);
      }
    }
  };

  // Toggle Mode between dark and light
  const toggleMode = () => {
    const nextMode: ThemeMode = resolvedMode() === 'dark' ? 'light' : 'dark';
    setMode(nextMode);
  };

  // Save new Custom Theme
  const saveCustomTheme = (name: string, tokens: StudioThemeTokens): StudioThemePreset => {
    const id = `custom-${Date.now()}`;
    const newPreset: StudioThemePreset = {
      id,
      name: name.trim() || 'Custom Studio Theme',
      mode: resolvedMode(),
      category: 'custom',
      description: 'User-customized Studio Chrome Theme with custom tokens.',
      isCustom: true,
      tokens,
    };

    setCustomThemes((prev) => {
      const updated = [...prev, newPreset];
      saveCustomThemesToStorage(updated);
      return updated;
    });

    setThemePreset(id);
    return newPreset;
  };

  // Delete Custom Theme
  const deleteCustomTheme = (id: string) => {
    setCustomThemes((prev) => {
      const updated = prev.filter((t) => t.id !== id);
      saveCustomThemesToStorage(updated);
      return updated;
    });

    if (activeThemeId() === id) {
      const fallbackId = resolvedMode() === 'dark' ? 'carbon-noir' : 'zinc-clean';
      setThemePreset(fallbackId);
    }
  };

  // Update Custom Theme in place
  const updateCustomTheme = (id: string, tokens: StudioThemeTokens) => {
    setCustomThemes((prev) => {
      const updated = prev.map((t) => (t.id === id ? { ...t, tokens } : t));
      saveCustomThemesToStorage(updated);
      return updated;
    });
  };

  const contextValue: ThemeContextValue = {
    get activeTheme() {
      return activeTheme();
    },
    get activeThemeId() {
      return activeThemeId();
    },
    get mode() {
      return mode();
    },
    get resolvedMode() {
      return resolvedMode();
    },
    get customThemes() {
      return customThemes();
    },
    get allPresets() {
      return allPresets();
    },
    setThemePreset,
    setMode,
    toggleMode,
    saveCustomTheme,
    deleteCustomTheme,
    updateCustomTheme,
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      {props.children}
    </ThemeContext.Provider>
  );
};

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
