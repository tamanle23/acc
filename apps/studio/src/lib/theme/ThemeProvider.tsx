import {
  createContext,
  useContext,
  createSignal,
  createMemo,
  createEffect,
  type ParentProps,
} from 'solid-js';
import {
  STUDIO_THEME_PRESETS,
  getThemePreset,
  type StudioThemePreset,
  type ThemeMode,
  type GlassStyle,
  type BlurIntensity,
  type AccentColor,
  type ThemePreferences,
  DEFAULT_THEME_PREFERENCES,
  DEFAULT_PREFERENCES,
  THEME_STORAGE_KEY,
  applyThemeToDocument,
} from './themePresets';

export {
  type ThemeMode,
  type GlassStyle,
  type BlurIntensity,
  type AccentColor,
  type ThemePreferences,
  type StudioThemePreset,
  DEFAULT_THEME_PREFERENCES,
  DEFAULT_PREFERENCES,
  THEME_STORAGE_KEY,
  applyThemeToDocument,
};

export interface ThemeContextValue {
  preferences: ThemePreferences;
  activePreset: StudioThemePreset;
  setTheme: (updates: Partial<ThemePreferences>) => void;
  selectPreset: (presetId: string) => void;
  toggleMode: () => void;
  resetTheme: () => void;
  isSettingsOpen: boolean;
  setIsSettingsOpen: (open: boolean) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    return null;
  }
  return null;
}

function loadSavedPreferences(): ThemePreferences {
  const storage = getStorage();
  if (!storage) {
    return { ...DEFAULT_THEME_PREFERENCES, presetId: 'obsidian' };
  }
  try {
    const raw = storage.getItem(THEME_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_THEME_PREFERENCES, presetId: 'obsidian' };
    const parsed = JSON.parse(raw);
    const validPreset = STUDIO_THEME_PRESETS.some((p) => p.id === parsed.presetId)
      ? parsed.presetId
      : 'obsidian';

    return {
      presetId: validPreset,
      mode: parsed.mode === 'light' ? 'light' : 'dark',
      glassStyle: ['specular', 'frosted', 'cyber'].includes(parsed.glassStyle)
        ? parsed.glassStyle
        : DEFAULT_THEME_PREFERENCES.glassStyle,
      blurIntensity: ['low', 'medium', 'high'].includes(parsed.blurIntensity)
        ? parsed.blurIntensity
        : DEFAULT_THEME_PREFERENCES.blurIntensity,
    };
  } catch {
    return { ...DEFAULT_THEME_PREFERENCES, presetId: 'obsidian' };
  }
}

export function ThemeProvider(props: ParentProps) {
  const [preferences, setPreferences] = createSignal<ThemePreferences>(loadSavedPreferences());
  const [isSettingsOpen, setIsSettingsOpen] = createSignal<boolean>(false);

  // Initialize immediately
  applyThemeToDocument(preferences());

  // Sync state to DOM, html attributes, colorScheme, CSS variables, and localStorage
  createEffect(() => {
    const prefs = preferences();
    applyThemeToDocument(prefs);

    try {
      const storage = getStorage();
      if (storage) {
        storage.setItem(THEME_STORAGE_KEY, JSON.stringify(prefs));
      }
    } catch (e) {
      console.warn('Failed to save theme preferences to localStorage:', e);
    }
  });

  const activePreset = createMemo(() => getThemePreset(preferences().presetId || 'obsidian'));

  const setTheme = (updates: Partial<ThemePreferences>) => {
    setPreferences((prev) => {
      const next = { ...prev, ...updates };
      applyThemeToDocument(next);
      return next;
    });
  };

  const selectPreset = (presetId: string) => {
    const targetPreset = getThemePreset(presetId);
    setPreferences((prev) => {
      const next = {
        ...prev,
        presetId,
        mode: targetPreset.mode,
      };
      applyThemeToDocument(next);
      return next;
    });
  };

  const toggleMode = () => {
    setPreferences((prev) => {
      const nextMode: ThemeMode = prev.mode === 'dark' ? 'light' : 'dark';
      let nextPresetId = prev.presetId;
      if (nextMode === 'light' && prev.mode === 'dark') {
        const curPreset = getThemePreset(prev.presetId || 'obsidian');
        if (curPreset.mode === 'dark') {
          nextPresetId = 'catppuccin-latte';
        }
      } else if (nextMode === 'dark' && prev.mode === 'light') {
        const curPreset = getThemePreset(prev.presetId || 'catppuccin-latte');
        if (curPreset.mode === 'light') {
          nextPresetId = 'obsidian';
        }
      }
      const next: ThemePreferences = {
        ...prev,
        mode: nextMode,
        presetId: nextPresetId,
      };
      applyThemeToDocument(next);
      return next;
    });
  };

  const resetTheme = () => {
    const next: ThemePreferences = { ...DEFAULT_THEME_PREFERENCES, presetId: 'obsidian' };
    applyThemeToDocument(next);
    setPreferences(next);
  };

  const value: ThemeContextValue = {
    get preferences() {
      return preferences();
    },
    get activePreset() {
      return activePreset();
    },
    setTheme,
    selectPreset,
    toggleMode,
    resetTheme,
    get isSettingsOpen() {
      return isSettingsOpen();
    },
    setIsSettingsOpen,
  };

  return <ThemeContext.Provider value={value}>{props.children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}
