import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';

export type ThemeMode = 'dark' | 'light';
export type GlassStyle = 'specular' | 'frosted' | 'cyber';
export type BlurIntensity = 'low' | 'medium' | 'high';
export type AccentColor = 'cyan' | 'violet' | 'emerald' | 'amber' | 'rose';

export interface ThemePreferences {
  mode: ThemeMode;
  glassStyle: GlassStyle;
  blurIntensity: BlurIntensity;
  accentColor: AccentColor;
}

export interface ThemeContextValue {
  preferences: ThemePreferences;
  setTheme: (updates: Partial<ThemePreferences>) => void;
  toggleMode: () => void;
  resetTheme: () => void;
  isSettingsOpen: boolean;
  setIsSettingsOpen: (open: boolean) => void;
}

export const DEFAULT_THEME_PREFERENCES: ThemePreferences = {
  mode: 'dark',
  glassStyle: 'specular',
  blurIntensity: 'medium',
  accentColor: 'cyan',
};

export const THEME_STORAGE_KEY = 'acc_studio_theme_prefs';

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
    return { ...DEFAULT_THEME_PREFERENCES };
  }
  try {
    const raw = storage.getItem(THEME_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_THEME_PREFERENCES };
    const parsed = JSON.parse(raw);
    return {
      mode: parsed.mode === 'light' ? 'light' : 'dark',
      glassStyle: ['specular', 'frosted', 'cyber'].includes(parsed.glassStyle)
        ? parsed.glassStyle
        : DEFAULT_THEME_PREFERENCES.glassStyle,
      blurIntensity: ['low', 'medium', 'high'].includes(parsed.blurIntensity)
        ? parsed.blurIntensity
        : DEFAULT_THEME_PREFERENCES.blurIntensity,
      accentColor: ['cyan', 'violet', 'emerald', 'amber', 'rose'].includes(parsed.accentColor)
        ? parsed.accentColor
        : DEFAULT_THEME_PREFERENCES.accentColor,
    };
  } catch {
    return { ...DEFAULT_THEME_PREFERENCES };
  }
}

export const ACCENT_CONFIGS: Record<AccentColor, { label: string; hex: string; hsl: string }> = {
  cyan: { label: 'Cyan', hex: '#06b6d4', hsl: '189 94% 43%' },
  violet: { label: 'Violet', hex: '#8b5cf6', hsl: '258 90% 66%' },
  emerald: { label: 'Emerald', hex: '#10b981', hsl: '160 84% 39%' },
  amber: { label: 'Amber', hex: '#f59e0b', hsl: '38 92% 50%' },
  rose: { label: 'Rose', hex: '#f43f5e', hsl: '350 89% 60%' },
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState<ThemePreferences>(loadSavedPreferences);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Sync state to DOM, html attributes, colorScheme, and localStorage
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;
    root.classList.toggle('dark', preferences.mode === 'dark');
    root.style.colorScheme = preferences.mode;
    root.setAttribute('data-glass-style', preferences.glassStyle);
    root.setAttribute('data-blur-intensity', preferences.blurIntensity);
    root.setAttribute('data-accent', preferences.accentColor);

    try {
      const storage = getStorage();
      if (storage) {
        storage.setItem(THEME_STORAGE_KEY, JSON.stringify(preferences));
      }
    } catch (e) {
      console.warn('Failed to save theme preferences to localStorage:', e);
    }
  }, [preferences]);

  const setTheme = (updates: Partial<ThemePreferences>) => {
    setPreferences((prev) => ({ ...prev, ...updates }));
  };

  const toggleMode = () => {
    setPreferences((prev) => ({
      ...prev,
      mode: prev.mode === 'dark' ? 'light' : 'dark',
    }));
  };

  const resetTheme = () => {
    setPreferences({ ...DEFAULT_THEME_PREFERENCES });
  };

  const value = useMemo(
    () => ({
      preferences,
      setTheme,
      toggleMode,
      resetTheme,
      isSettingsOpen,
      setIsSettingsOpen,
    }),
    [preferences, isSettingsOpen]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}
